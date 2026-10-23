//! Direct scene rasterization. UVs are sampled from native atlases, never from an enlarged intermediate sprite.
use crate::sc::{Color, Command, Matrix, Scene};
use anyhow::{Context, Result, bail, ensure};
use image::{Rgba, RgbaImage};

#[derive(Clone)]
struct Surface {
    image: RgbaImage,
    x: u32,
    y: u32,
}

impl Surface {
    fn composite(&mut self, top: Self, blend: u8) -> Result<()> {
        ensure!(matches!(blend, 0 | 8), "Unsupported blend mode {blend}");
        let x = self.x.min(top.x);
        let y = self.y.min(top.y);
        let right = (self.x + self.image.width()).max(top.x + top.image.width());
        let bottom = (self.y + self.image.height()).max(top.y + top.image.height());
        if x != self.x
            || y != self.y
            || right - x != self.image.width()
            || bottom - y != self.image.height()
        {
            let mut image = RgbaImage::new(right - x, bottom - y);
            image::imageops::replace(
                &mut image,
                &self.image,
                i64::from(self.x - x),
                i64::from(self.y - y),
            );
            self.image = image;
            self.x = x;
            self.y = y;
        }
        for (tx, ty, pixel) in top.image.enumerate_pixels() {
            if pixel[3] == 0 {
                continue;
            }
            let base = self
                .image
                .get_pixel_mut(top.x + tx - self.x, top.y + ty - self.y);
            let a = pixel[3] as f32 / 255.;
            let b = base[3] as f32 / 255.;
            let alpha = a + b * (1. - a);
            for channel in 0..3 {
                let premultiplied = if blend == 8 {
                    pixel[channel] as f32 * a + base[channel] as f32 * b
                } else {
                    pixel[channel] as f32 * a + base[channel] as f32 * b * (1. - a)
                };
                base[channel] = (premultiplied / alpha).round().clamp(0., 255.) as u8;
            }
            base[3] = (alpha * 255.).round() as u8;
        }
        Ok(())
    }

    fn color(&mut self, color: Color) {
        if color.0 == Color::IDENTITY.0 {
            return;
        }
        for pixel in self.image.pixels_mut() {
            for channel in 0..3 {
                pixel[channel] = (pixel[channel] as f32 * color.0[channel] as f32 / 255.
                    + color.0[channel + 4] as f32)
                    .round()
                    .clamp(0., 255.) as u8;
            }
            pixel[3] = ((u32::from(pixel[3]) * u32::from(color.0[3]) + 127) / 255) as u8;
        }
    }

    fn mask(&mut self, mask: Option<&Self>) {
        for (x, y, pixel) in self.image.enumerate_pixels_mut() {
            let alpha = mask
                .and_then(|mask| {
                    let mx = (x + self.x).checked_sub(mask.x)?;
                    let my = (y + self.y).checked_sub(mask.y)?;
                    mask.image.get_pixel_checked(mx, my).map(|pixel| pixel[3])
                })
                .unwrap_or(0);
            pixel[3] = ((u32::from(pixel[3]) * u32::from(alpha) + 127) / 255) as u8;
        }
    }
}

fn merge(base: &mut Option<Surface>, top: Option<Surface>, blend: u8) -> Result<()> {
    if let Some(top) = top {
        if let Some(base) = base {
            base.composite(top, blend)?;
        } else {
            *base = Some(top);
        }
    }
    Ok(())
}

/// Returns premultiplied RGBA. Transparent texels cannot create dark fringes when interpolated.
fn sample(texture: &RgbaImage, u: f32, v: f32) -> [f32; 4] {
    let x = (u * texture.width() as f32 - 0.5).clamp(0., (texture.width() - 1) as f32);
    let y = (v * texture.height() as f32 - 0.5).clamp(0., (texture.height() - 1) as f32);
    let left = x.floor() as i32;
    let top = y.floor() as i32;
    let mut output = [0.; 4];
    // Catmull-Rom preserves thin outlines better than bilinear filtering when sprites are magnified.
    for row in -1..=2 {
        let py = (top + row).clamp(0, texture.height() as i32 - 1) as u32;
        let vertical = cubic_weight(y - (top + row) as f32);
        for column in -1..=2 {
            let px = (left + column).clamp(0, texture.width() as i32 - 1) as u32;
            let weight = vertical * cubic_weight(x - (left + column) as f32);
            let color = texture.get_pixel(px, py);
            let alpha = color[3] as f32 / 255.;
            for channel in 0..3 {
                output[channel] += color[channel] as f32 * alpha * weight;
            }
            output[3] += alpha * weight;
        }
    }
    // Cubic kernels have negative lobes; keep interpolated premultiplied colors physically valid.
    output[3] = output[3].clamp(0., 1.);
    for channel in 0..3 {
        output[channel] = output[channel].clamp(0., output[3] * 255.);
    }
    output
}

fn cubic_weight(distance: f32) -> f32 {
    let distance = distance.abs();
    if distance <= 1. {
        (1.5 * distance - 2.5) * distance * distance + 1.
    } else if distance < 2. {
        ((-0.5 * distance + 2.5) * distance - 4.) * distance + 2.
    } else {
        0.
    }
}

pub struct Renderer<'a> {
    scene: &'a Scene,
    width: u32,
    height: u32,
    visits: usize,
}

impl<'a> Renderer<'a> {
    pub fn render(scene: &'a Scene, export: &str, width: u32, height: u32) -> Result<RgbaImage> {
        ensure!(
            (64..=4096).contains(&width) && (32..=2048).contains(&height),
            "Output size must be 64..4096 by 32..2048"
        );
        let object = *scene
            .exports
            .get(export)
            .with_context(|| format!("Unknown export {export}"))?;
        let mut renderer = Self {
            scene,
            width,
            height,
            visits: 0,
        };
        // A fixed 200 × 64 game-unit viewport keeps framing identical at all pixel densities.
        let transform = Matrix([
            width as f32 / 200.,
            0.,
            0.,
            height as f32 / 64.,
            width as f32 / 2.,
            height as f32 / 2.,
        ]);
        let surface = renderer
            .object(object, transform, &mut Vec::new())
            .with_context(|| format!("Rendering {export}"))?
            .context("Export rendered no visible geometry")?;
        ensure!(
            surface.image.pixels().any(|pixel| pixel[3] > 0),
            "Export rendered fully transparent"
        );
        let mut output = RgbaImage::new(width, height);
        image::imageops::replace(
            &mut output,
            &surface.image,
            i64::from(surface.x),
            i64::from(surface.y),
        );
        Ok(output)
    }

    fn object(
        &mut self,
        id: u16,
        transform: Matrix,
        ancestors: &mut Vec<u16>,
    ) -> Result<Option<Surface>> {
        self.visits += 1;
        ensure!(
            self.visits <= 100_000 && ancestors.len() < 64,
            "Scene complexity exceeds limit"
        );
        ensure!(
            !ancestors.contains(&id),
            "Cyclic scene reference at object {id}"
        );
        if let Some(text) = self.scene.text_fields.get(&id) {
            // Empty runtime labels occur in banner clips; visible text requires the game's font renderer.
            ensure!(
                text.trim().is_empty(),
                "Text rendering is unsupported for object {id}: {text:?}"
            );
            return Ok(None);
        }
        if let Some(commands) = self.scene.shapes.get(&id) {
            let mut result = None;
            for command in commands {
                merge(&mut result, self.command(command, transform)?, 0)?;
            }
            return Ok(result);
        }
        let clip = self
            .scene
            .clips
            .get(&id)
            .with_context(|| format!("Unsupported or missing object {id}"))?;
        ancestors.push(id);
        let bank = self
            .scene
            .banks
            .get(clip.bank)
            .context("Missing matrix bank")?;
        let mut result = None;
        let mut mask = None;
        let mut capture_mask = false;
        let mut masked = false;
        for element in &clip.elements {
            let child_index = element[0] as usize;
            let child = *clip
                .children
                .get(child_index)
                .context("Missing child object")?;
            if let Some(modifier) = self.scene.modifiers.get(&child) {
                match modifier {
                    38 => capture_mask = true,
                    39 => masked = true,
                    40 => {
                        masked = false;
                        mask = None;
                    }
                    _ => bail!("Unsupported modifier {modifier}"),
                }
                continue;
            }
            let matrix = if element[1] == u16::MAX {
                Matrix::IDENTITY
            } else {
                *bank
                    .matrices
                    .get(element[1] as usize)
                    .context("Missing transform")?
            };
            let color = if element[2] == u16::MAX {
                Color::IDENTITY
            } else {
                *bank
                    .colors
                    .get(element[2] as usize)
                    .context("Missing color transform")?
            };
            let blend = clip.blends.get(child_index).copied().unwrap_or(0);
            ensure!(matches!(blend, 0 | 8), "Unsupported blend mode {blend}");
            let mut surface = self.object(child, transform.compose(matrix), ancestors)?;
            if let Some(surface) = &mut surface {
                surface.color(color);
            }
            if capture_mask {
                mask = surface;
                capture_mask = false;
                continue;
            }
            if masked && let Some(surface) = &mut surface {
                surface.mask(mask.as_ref());
            }
            merge(&mut result, surface, blend)?;
        }
        ensure!(!capture_mask, "Mask modifier is missing its mask object");
        ancestors.pop();
        Ok(result)
    }

    fn command(&self, command: &Command, transform: Matrix) -> Result<Option<Surface>> {
        if command.vertices.len() < 3 {
            return Ok(None);
        }
        let texture = self
            .scene
            .textures
            .get(command.texture)
            .context("Missing texture atlas")?;
        let vertices = command
            .vertices
            .iter()
            .map(|vertex| {
                let [x, y] = transform.point(vertex.x, vertex.y);
                [x, y, vertex.u, vertex.v]
            })
            .collect::<Vec<_>>();
        ensure!(
            vertices.iter().flatten().all(|value| value.is_finite()),
            "Non-finite transformed vertex"
        );
        let left = vertices
            .iter()
            .map(|v| v[0])
            .fold(f32::INFINITY, f32::min)
            .floor()
            .clamp(0., self.width as f32) as u32;
        let top = vertices
            .iter()
            .map(|v| v[1])
            .fold(f32::INFINITY, f32::min)
            .floor()
            .clamp(0., self.height as f32) as u32;
        let right = vertices
            .iter()
            .map(|v| v[0])
            .fold(f32::NEG_INFINITY, f32::max)
            .ceil()
            .clamp(0., self.width as f32) as u32;
        let bottom = vertices
            .iter()
            .map(|v| v[1])
            .fold(f32::NEG_INFINITY, f32::max)
            .ceil()
            .clamp(0., self.height as f32) as u32;
        if right <= left || bottom <= top {
            return Ok(None);
        }
        let width = right - left;
        let height = bottom - top;
        let mut samples = vec![[0.; 4]; (width * height) as usize];
        let mut coverage = vec![0_u8; samples.len()];
        for index in 0..vertices.len() - 2 {
            let [a, b, c] = [vertices[index], vertices[index + 1], vertices[index + 2]];
            let denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
            if denominator.abs() < 1e-8 {
                continue;
            }
            let x_start = a[0].min(b[0]).min(c[0]).floor().max(left as f32) as u32;
            let y_start = a[1].min(b[1]).min(c[1]).floor().max(top as f32) as u32;
            let x_end = a[0]
                .max(b[0])
                .max(c[0])
                .ceil()
                .clamp(left as f32, right as f32) as u32;
            let y_end = a[1]
                .max(b[1])
                .max(c[1])
                .ceil()
                .clamp(top as f32, bottom as f32) as u32;
            for y in y_start..y_end {
                for x in x_start..x_end {
                    let pixel = ((y - top) * width + x - left) as usize;
                    for (sample_index, (sx, sy)) in
                        [(0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75)]
                            .into_iter()
                            .enumerate()
                    {
                        let flag = 1 << sample_index;
                        if coverage[pixel] & flag != 0 {
                            continue;
                        }
                        let px = x as f32 + sx;
                        let py = y as f32 + sy;
                        let w0 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1]))
                            / denominator;
                        let w1 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1]))
                            / denominator;
                        let w2 = 1. - w0 - w1;
                        if w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6 {
                            continue;
                        }
                        let color = sample(
                            texture,
                            w0 * a[2] + w1 * b[2] + w2 * c[2],
                            w0 * a[3] + w1 * b[3] + w2 * c[3],
                        );
                        for (channel, value) in color.into_iter().enumerate() {
                            samples[pixel][channel] += value * 0.25;
                        }
                        coverage[pixel] |= flag;
                    }
                }
            }
        }
        let image = RgbaImage::from_fn(width, height, |x, y| {
            let sample = samples[(y * width + x) as usize];
            if sample[3] <= 0. {
                return Rgba([0; 4]);
            }
            Rgba([
                (sample[0] / sample[3]).round() as u8,
                (sample[1] / sample[3]).round() as u8,
                (sample[2] / sample[3]).round() as u8,
                (sample[3] * 255.).round().clamp(0., 255.) as u8,
            ])
        });
        Ok(Some(Surface {
            image,
            x: left,
            y: top,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cubic_sampling_does_not_add_transparent_black() {
        let mut texture = RgbaImage::new(2, 1);
        texture.put_pixel(0, 0, Rgba([255, 100, 0, 255]));
        let result = sample(&texture, 0.5, 0.5);
        assert!((result[3] - 0.5).abs() < 0.001);
        assert_eq!(result[0] / result[3], 255.);
    }

    #[test]
    fn cubic_sampling_preserves_texel_centers_and_bounds_overshoot() {
        let mut texture = RgbaImage::new(4, 1);
        texture.put_pixel(1, 0, Rgba([255, 80, 20, 255]));
        assert_eq!(sample(&texture, 0.375, 0.5), [255., 80., 20., 1.]);
        for step in 0..=100 {
            let value = sample(&texture, step as f32 / 100., 0.5);
            assert!((0. ..=1.).contains(&value[3]));
            assert!(
                value[..3]
                    .iter()
                    .all(|channel| *channel >= 0. && *channel <= 255. * value[3])
            );
        }
    }

    #[test]
    fn masks_respect_layer_origins_and_alpha() {
        let mut image = Surface {
            image: RgbaImage::from_pixel(2, 1, Rgba([255; 4])),
            x: 1,
            y: 0,
        };
        let mask = Surface {
            image: RgbaImage::from_pixel(1, 1, Rgba([0, 0, 0, 128])),
            x: 2,
            y: 0,
        };
        image.mask(Some(&mask));
        assert_eq!(image.image.get_pixel(0, 0)[3], 0);
        assert_eq!(image.image.get_pixel(1, 0)[3], 128);
    }
}
