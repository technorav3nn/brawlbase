//! SC v5 container, scene graph, and embedded high-resolution KTX textures.
use crate::binary::{Bytes, Table};
use anyhow::{Context, Result, bail, ensure};
use image::{Rgba, RgbaImage};
use std::{collections::BTreeMap, io::Read};

pub const MAX_INPUT_BYTES: usize = 128 * 1024 * 1024;
const MAX_INNER_BYTES: usize = 256 * 1024 * 1024;

#[derive(Clone, Copy, Debug)]
pub struct Matrix(pub [f32; 6]);

impl Matrix {
    pub const IDENTITY: Self = Self([1., 0., 0., 1., 0., 0.]);

    pub fn point(self, x: f32, y: f32) -> [f32; 2] {
        let [a, b, c, d, tx, ty] = self.0;
        [a * x + b * y + tx, c * x + d * y + ty]
    }

    pub fn compose(self, child: Self) -> Self {
        let [a, b, c, d, tx, ty] = self.0;
        let [e, f, g, h, ux, uy] = child.0;
        Self([
            a * e + b * g,
            a * f + b * h,
            c * e + d * g,
            c * f + d * h,
            a * ux + b * uy + tx,
            c * ux + d * uy + ty,
        ])
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Color(pub [u8; 7]);
impl Color {
    pub const IDENTITY: Self = Self([255, 255, 255, 255, 0, 0, 0]);
}

pub struct Bank {
    pub matrices: Vec<Matrix>,
    pub colors: Vec<Color>,
}
#[derive(Clone, Copy)]
pub struct Vertex {
    pub x: f32,
    pub y: f32,
    pub u: f32,
    pub v: f32,
}
pub struct Command {
    pub texture: usize,
    pub vertices: Vec<Vertex>,
}
pub struct Clip {
    pub children: Vec<u16>,
    pub blends: Vec<u8>,
    pub elements: Vec<[u16; 3]>,
    pub bank: usize,
}
pub struct Scene {
    pub exports: BTreeMap<String, u16>,
    pub shapes: BTreeMap<u16, Vec<Command>>,
    pub clips: BTreeMap<u16, Clip>,
    pub modifiers: BTreeMap<u16, u8>,
    pub text_fields: BTreeMap<u16, String>,
    pub banks: Vec<Bank>,
    pub textures: Vec<RgbaImage>,
}

fn decompress(data: &[u8]) -> Result<Vec<u8>> {
    let frame_size = zstd::zstd_safe::find_frame_compressed_size(data).map_err(|code| {
        anyhow::anyhow!(
            "Invalid ZSTD frame: {}",
            zstd::zstd_safe::get_error_name(code)
        )
    })?;
    ensure!(
        data[frame_size..].iter().all(|byte| *byte == 0),
        "Unexpected data after the SC ZSTD frame"
    );
    // SC's compressed-size field can include trailing zero padding after the single ZSTD frame.
    let decoder = zstd::stream::read::Decoder::new(data)?.single_frame();
    let mut output = Vec::new();
    decoder
        .take(MAX_INNER_BYTES as u64 + 1)
        .read_to_end(&mut output)?;
    ensure!(
        output.len() <= MAX_INNER_BYTES,
        "Decompressed SC exceeds 256 MiB"
    );
    Ok(output)
}

fn chunk<'a>(data: Bytes<'a>, position: &mut usize) -> Result<&'a [u8]> {
    let length = data.u32(*position)? as usize;
    let result = data.slice(*position + 4, length)?;
    *position += 4 + length;
    Ok(result)
}

fn divisor(precision: u32) -> Result<f32> {
    match precision {
        0 | 1 => Ok(1.),
        2 => Ok(20.),
        3 => Ok(1024.),
        _ => bail!("Unsupported matrix precision {precision}"),
    }
}

impl Scene {
    pub fn parse(raw: &[u8]) -> Result<Self> {
        ensure!(raw.len() <= MAX_INPUT_BYTES, "SC input exceeds 128 MiB");
        let bytes = Bytes(raw);
        ensure!(bytes.slice(0, 2)? == b"SC", "Not a Supercell SC file");
        ensure!(bytes.u32(2)? == 5, "Only SC version 5 is supported");
        let descriptor_size = bytes.u32(6)? as usize;
        let descriptor = Table::root(bytes.slice(10, descriptor_size)?)?;
        ensure!(
            descriptor.u32(12, 0)? == 0,
            "External matrix banks are not supported"
        );
        let translation_divisor = divisor(descriptor.u32(0, 0)?)?;
        let scale_divisor = divisor(descriptor.u32(1, 0)?)?;
        let compressed_start = 10 + descriptor_size;
        let compressed_size = descriptor.u32(11, 0)? as usize;
        let compressed_size = if compressed_size == 0 {
            raw.len() - compressed_start
        } else {
            compressed_size
        };
        let inner = decompress(bytes.slice(compressed_start, compressed_size)?)
            .context("Decompressing SC payload")?;
        let data = Bytes(&inner);
        let storage = Table::root(chunk(data, &mut 0)?)?;
        let string_vector = storage.vector(0, 4)?;
        let strings = (0..string_vector.len)
            .map(|i| string_vector.bytes.string(string_vector.offset(i)?))
            .collect::<Result<Vec<_>>>()?;
        let points = storage.vector(5, 1)?.data()?;
        ensure!(
            points.len().is_multiple_of(12),
            "Invalid vertex buffer length"
        );
        let vertices = points
            .as_chunks::<12>()
            .0
            .iter()
            .map(|vertex| {
                let bytes = Bytes(vertex);
                Ok(Vertex {
                    x: bytes.f32(0)?,
                    y: bytes.f32(4)?,
                    u: bytes.u16(8)? as f32 / 65535.,
                    v: bytes.u16(10)? as f32 / 65535.,
                })
            })
            .collect::<Result<Vec<_>>>()?;
        let frame_elements = storage.vector(4, 2)?;
        let mut banks = Vec::new();
        let bank_vector = storage.vector(6, 4)?;
        for index in 0..bank_vector.len {
            let bank = bank_vector.table(index)?;
            let full = bank.vector(0, 24)?;
            let half = bank.vector(2, 12)?;
            let matrix_vector = if full.len > 0 { full } else { half };
            let mut matrices = Vec::with_capacity(matrix_vector.len);
            for i in 0..matrix_vector.len {
                let start = matrix_vector.offset(i)?;
                let mut values = [0.; 6];
                for (component, value) in values.iter_mut().enumerate() {
                    *value = if full.len > 0 {
                        matrix_vector.bytes.f32(start + component * 4)?
                    } else {
                        matrix_vector.bytes.i16(start + component * 2)? as f32
                            / if component < 4 {
                                scale_divisor
                            } else {
                                translation_divisor
                            }
                    };
                }
                matrices.push(Matrix(values));
            }
            let colors = bank
                .vector(1, 7)?
                .data()?
                .as_chunks::<7>()
                .0
                .iter()
                .map(|color| Color(*color))
                .collect::<Vec<_>>();
            banks.push(Bank { matrices, colors });
        }
        let mut position = descriptor.u32(8, 0)? as usize;
        let exports_table = Table::root(chunk(data, &mut position)?)?;
        let ids = exports_table.vector(0, 2)?;
        let names = exports_table.vector(1, 4)?;
        ensure!(
            ids.len == names.len,
            "Export names and IDs have different lengths"
        );
        let mut exports = BTreeMap::new();
        for i in 0..ids.len {
            // This Brawl Stars format uses zero-based string references, including an empty string at index 0.
            let reference = names.bytes.u32(names.offset(i)?)? as usize;
            let name = strings
                .get(reference)
                .context("Invalid export name reference")?;
            ensure!(!name.is_empty(), "Empty export name");
            ensure!(
                exports
                    .insert(name.clone(), ids.bytes.u16(ids.offset(i)?)?)
                    .is_none(),
                "Duplicate export {name}"
            );
        }
        let text_data = chunk(data, &mut position)?;
        let mut text_fields = BTreeMap::new();
        if !text_data.is_empty() {
            let fields = Table::root(text_data)?.vector(0, 40)?;
            for i in 0..fields.len {
                let offset = fields.offset(i)?;
                let reference = fields.bytes.u32(offset + 24)? as usize;
                text_fields.insert(
                    fields.bytes.u16(offset)?,
                    strings
                        .get(reference)
                        .context("Invalid text reference")?
                        .clone(),
                );
            }
        }
        let shape_table = Table::root(chunk(data, &mut position)?)?;
        let shape_vector = shape_table.vector(0, 4)?;
        let mut shapes = BTreeMap::new();
        for i in 0..shape_vector.len {
            let shape = shape_vector.table(i)?;
            let commands = shape.vector(1, 16)?;
            let mut draws = Vec::new();
            for j in 0..commands.len {
                let command = commands.offset(j)?;
                let data = commands.bytes;
                let start = data.u32(command + 12)? as usize;
                let count = data.u32(command + 8)? as usize;
                let end = start.checked_add(count).context("Vertex range overflow")?;
                draws.push(Command {
                    texture: data.u32(command + 4)? as usize,
                    vertices: vertices
                        .get(start..end)
                        .context("Shape references missing vertices")?
                        .to_vec(),
                });
            }
            ensure!(
                shapes.insert(shape.u16(0, 0)?, draws).is_none(),
                "Duplicate shape ID"
            );
        }
        let clip_table = Table::root(chunk(data, &mut position)?)?;
        let clip_vector = clip_table.vector(0, 4)?;
        let mut clips = BTreeMap::new();
        for i in 0..clip_vector.len {
            let clip = clip_vector.table(i)?;
            let data = clip.bytes;
            let children = clip
                .vector(5, 2)?
                .data()?
                .as_chunks::<2>()
                .0
                .iter()
                .map(|bytes| u16::from_le_bytes(*bytes))
                .collect::<Vec<_>>();
            let blends = clip.vector(7, 1)?.data()?.to_vec();
            ensure!(blends.len() <= children.len(), "Too many child blend modes");
            let frames = clip.vector(8, 8)?;
            let short_frames = clip.vector(12, 2)?;
            let count = if frames.len > 0 {
                data.u32(frames.offset(0)?)? as usize
            } else if short_frames.len > 0 {
                data.u16(short_frames.offset(0)?)? as usize
            } else {
                0
            };
            let offset = clip.u32(9, u32::MAX)?;
            let mut elements = Vec::new();
            if offset != u32::MAX {
                for j in 0..count {
                    let index = offset as usize + j * 3;
                    elements.push([
                        frame_elements.bytes.u16(frame_elements.offset(index)?)?,
                        frame_elements
                            .bytes
                            .u16(frame_elements.offset(index + 1)?)?,
                        frame_elements
                            .bytes
                            .u16(frame_elements.offset(index + 2)?)?,
                    ]);
                }
            } else {
                ensure!(count == 0, "Compressed frame elements are not supported");
            }
            let id = clip.u16(0, 0)?;
            ensure!(
                clips
                    .insert(
                        id,
                        Clip {
                            children,
                            blends,
                            elements,
                            bank: clip.u32(10, 0)? as usize
                        }
                    )
                    .is_none(),
                "Duplicate movie clip ID"
            );
        }
        let modifier_data = chunk(data, &mut position)?;
        let mut modifiers = BTreeMap::new();
        if !modifier_data.is_empty() {
            let modifier_vector = Table::root(modifier_data)?.vector(0, 4)?;
            for i in 0..modifier_vector.len {
                let offset = modifier_vector.offset(i)?;
                modifiers.insert(
                    modifier_vector.bytes.u16(offset)?,
                    modifier_vector.bytes.u8(offset + 2)?,
                );
            }
        }
        let texture_table = Table::root(chunk(data, &mut position)?)?;
        let texture_vector = texture_table.vector(0, 4)?;
        let mut textures = Vec::new();
        let mut texture_pixels = 0_usize;
        for i in 0..texture_vector.len {
            let texture = texture_vector
                .table(i)?
                .table(1)?
                .context("Missing high-resolution texture; refusing a low-resolution fallback")?;
            texture_pixels += usize::from(texture.u16(2, 0)?) * usize::from(texture.u16(3, 0)?);
            ensure!(
                texture_pixels <= 32 * 1024 * 1024,
                "Texture atlas pixel budget exceeds 32 megapixels"
            );
            ensure!(
                texture.field(5)?.is_none(),
                "External textures are not supported; use the embedded KTX asset archive"
            );
            ensure!(texture.u8(0, 0)? == 8, "Expected an embedded KTX texture");
            let image = decode_ktx(texture.vector(4, 1)?.data()?)
                .with_context(|| format!("Decoding high-resolution texture {i}"))?;
            ensure!(
                image.width() == u32::from(texture.u16(2, 0)?)
                    && image.height() == u32::from(texture.u16(3, 0)?),
                "Texture dimensions disagree with SC metadata"
            );
            textures.push(image);
        }
        Ok(Self {
            exports,
            shapes,
            clips,
            modifiers,
            text_fields,
            banks,
            textures,
        })
    }
}

fn decode_ktx(raw: &[u8]) -> Result<RgbaImage> {
    let data = Bytes(raw);
    ensure!(
        data.slice(0, 12)? == b"\xABKTX 11\xBB\r\n\x1A\n",
        "Invalid KTX 1 identifier"
    );
    ensure!(
        data.u32(12)? == 0x04030201,
        "Only little-endian KTX is supported"
    );
    ensure!(
        data.u32(16)? == 0 && data.u32(24)? == 0,
        "Expected a compressed KTX texture"
    );
    let width = data.u32(36)?;
    let height = data.u32(40)?;
    ensure!(
        width > 0 && height > 0 && width <= 8192 && height <= 8192,
        "Invalid texture dimensions"
    );
    ensure!(
        u64::from(width) * u64::from(height) <= 32 * 1024 * 1024,
        "KTX texture exceeds pixel budget"
    );
    ensure!(
        data.u32(44)? == 0 && data.u32(48)? == 0 && data.u32(52)? == 1,
        "Only 2D KTX textures are supported"
    );
    let dimensions = [
        (4, 4),
        (5, 4),
        (5, 5),
        (6, 5),
        (6, 6),
        (8, 5),
        (8, 6),
        (8, 8),
        (10, 5),
        (10, 6),
        (10, 8),
        (10, 10),
        (12, 10),
        (12, 12),
    ];
    let format = data.u32(28)?;
    let base = match format {
        0x93B0..=0x93BD => 0x93B0,
        0x93D0..=0x93DD => 0x93D0,
        _ => bail!("Unsupported KTX format {format:#x}; expected ASTC"),
    };
    let (block_width, block_height) = dimensions[(format - base) as usize];
    let position = 64 + data.u32(60)? as usize;
    let length = data.u32(position)? as usize;
    let expected =
        (width as usize).div_ceil(block_width) * (height as usize).div_ceil(block_height) * 16;
    ensure!(
        length == expected,
        "Invalid ASTC mip size: expected {expected}, found {length}"
    );
    let mut pixels = vec![0; width as usize * height as usize];
    texture2ddecoder::decode_astc(
        data.slice(position + 4, length)?,
        width as usize,
        height as usize,
        block_width,
        block_height,
        &mut pixels,
    )
    .map_err(|message| anyhow::anyhow!(message))?;
    // The decoder returns packed 0xAARRGGBB, independent of host byte order.
    Ok(RgbaImage::from_fn(width, height, |x, y| {
        let pixel = pixels[(y * width + x) as usize];
        Rgba([
            (pixel >> 16) as u8,
            (pixel >> 8) as u8,
            pixel as u8,
            (pixel >> 24) as u8,
        ])
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sc_fixture_preserves_export_name_texture_color_and_quad_seams() {
        let scene = Scene::parse(include_bytes!("../tests/fixtures/minimal.sc")).unwrap();
        assert_eq!(scene.exports.get("event_fixture_banner"), Some(&1));
        assert!(!scene.exports.contains_key("decoy_name"));
        assert_eq!(scene.textures[0].get_pixel(0, 0).0, [255, 0, 0, 255]);
        let image =
            crate::render::Renderer::render(&scene, "event_fixture_banner", 200, 64).unwrap();
        assert!(image.pixels().all(|pixel| pixel.0 == [255, 0, 0, 255]));
    }

    #[test]
    fn invalid_containers_fail_without_panics() {
        for input in [
            &b""[..],
            &b"SC\x05\0\0\0\xFF\xFF\xFF\xFF"[..],
            &[0; 100][..],
        ] {
            assert!(Scene::parse(input).is_err());
        }
    }

    #[test]
    fn parent_transform_preserves_rotation_and_translation() {
        let parent = Matrix([0., -2., 2., 0., 10., 20.]);
        let child = Matrix([1., 0., 0., 1., 3., 4.]);
        assert_eq!(parent.compose(child).point(1., 2.), parent.point(4., 6.));
    }
}
