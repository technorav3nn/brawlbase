//! Checked readers for the subset of FlatBuffers used by SC v5.
use anyhow::{Context, Result, ensure};

#[derive(Clone, Copy)]
pub struct Bytes<'a>(pub &'a [u8]);

impl<'a> Bytes<'a> {
    pub fn slice(self, offset: usize, length: usize) -> Result<&'a [u8]> {
        let end = offset
            .checked_add(length)
            .context("Binary range overflow")?;
        self.0.get(offset..end).context("Truncated binary data")
    }

    pub fn u8(self, offset: usize) -> Result<u8> {
        Ok(self.slice(offset, 1)?[0])
    }

    pub fn u16(self, offset: usize) -> Result<u16> {
        Ok(u16::from_le_bytes(self.slice(offset, 2)?.try_into()?))
    }

    pub fn i16(self, offset: usize) -> Result<i16> {
        Ok(i16::from_le_bytes(self.slice(offset, 2)?.try_into()?))
    }

    pub fn u32(self, offset: usize) -> Result<u32> {
        Ok(u32::from_le_bytes(self.slice(offset, 4)?.try_into()?))
    }

    pub fn f32(self, offset: usize) -> Result<f32> {
        let value = f32::from_le_bytes(self.slice(offset, 4)?.try_into()?);
        ensure!(value.is_finite(), "Non-finite transform or vertex");
        Ok(value)
    }

    pub fn indirect(self, offset: usize) -> Result<usize> {
        let target = offset
            .checked_add(self.u32(offset)? as usize)
            .context("Offset overflow")?;
        self.slice(target, 1)?;
        Ok(target)
    }

    pub fn string(self, offset: usize) -> Result<String> {
        let target = self.indirect(offset)?;
        let length = self.u32(target)? as usize;
        Ok(std::str::from_utf8(self.slice(target + 4, length)?)?.to_owned())
    }
}

#[derive(Clone, Copy)]
pub struct Table<'a> {
    pub bytes: Bytes<'a>,
    offset: usize,
    vtable: usize,
    vtable_size: usize,
    object_size: usize,
}

impl<'a> Table<'a> {
    pub fn root(data: &'a [u8]) -> Result<Self> {
        let bytes = Bytes(data);
        Self::at(bytes, bytes.indirect(0)?)
    }

    pub fn at(bytes: Bytes<'a>, offset: usize) -> Result<Self> {
        let relative = i32::from_le_bytes(bytes.slice(offset, 4)?.try_into()?);
        let vtable = usize::try_from(offset as i64 - i64::from(relative))?;
        let vtable_size = bytes.u16(vtable)? as usize;
        let object_size = bytes.u16(vtable + 2)? as usize;
        ensure!(
            vtable_size >= 4 && vtable_size.is_multiple_of(2) && object_size >= 4,
            "Invalid FlatBuffer table"
        );
        bytes.slice(vtable, vtable_size)?;
        bytes.slice(offset, object_size)?;
        Ok(Self {
            bytes,
            offset,
            vtable,
            vtable_size,
            object_size,
        })
    }

    pub fn field(self, index: usize) -> Result<Option<usize>> {
        let slot = 4 + index * 2;
        if slot >= self.vtable_size {
            return Ok(None);
        }
        let relative = self.bytes.u16(self.vtable + slot)? as usize;
        if relative == 0 {
            return Ok(None);
        }
        ensure!(
            relative >= 4 && relative < self.object_size,
            "Invalid FlatBuffer field"
        );
        Ok(Some(self.offset + relative))
    }

    pub fn u32(self, index: usize, default: u32) -> Result<u32> {
        self.field(index)?
            .map_or(Ok(default), |offset| self.bytes.u32(offset))
    }

    pub fn u16(self, index: usize, default: u16) -> Result<u16> {
        self.field(index)?
            .map_or(Ok(default), |offset| self.bytes.u16(offset))
    }

    pub fn u8(self, index: usize, default: u8) -> Result<u8> {
        self.field(index)?
            .map_or(Ok(default), |offset| self.bytes.u8(offset))
    }

    pub fn table(self, index: usize) -> Result<Option<Self>> {
        self.field(index)?
            .map(|offset| Self::at(self.bytes, self.bytes.indirect(offset)?))
            .transpose()
    }

    pub fn vector(self, index: usize, stride: usize) -> Result<Vector<'a>> {
        let Some(field) = self.field(index)? else {
            return Ok(Vector {
                bytes: self.bytes,
                start: 0,
                len: 0,
                stride,
            });
        };
        let vector = self.bytes.indirect(field)?;
        let len = self.bytes.u32(vector)? as usize;
        let size = len.checked_mul(stride).context("Vector size overflow")?;
        self.bytes.slice(vector + 4, size)?;
        Ok(Vector {
            bytes: self.bytes,
            start: vector + 4,
            len,
            stride,
        })
    }
}

#[derive(Clone, Copy)]
pub struct Vector<'a> {
    pub bytes: Bytes<'a>,
    pub start: usize,
    pub len: usize,
    stride: usize,
}

impl<'a> Vector<'a> {
    pub fn offset(self, index: usize) -> Result<usize> {
        ensure!(
            index < self.len,
            "Vector index {index} out of bounds ({})",
            self.len
        );
        Ok(self.start + index * self.stride)
    }

    pub fn table(self, index: usize) -> Result<Table<'a>> {
        Table::at(self.bytes, self.bytes.indirect(self.offset(index)?)?)
    }

    pub fn data(self) -> Result<&'a [u8]> {
        self.bytes.slice(self.start, self.len * self.stride)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn malformed_offsets_are_errors() {
        assert!(Table::root(&[255; 16]).is_err());
        assert!(Bytes(&[0; 4]).slice(usize::MAX, 2).is_err());
        assert!(Table::root(&[]).is_err());
    }
}
