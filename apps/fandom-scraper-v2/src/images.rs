//! Direct libvips bindings. Using the same engine as Sharp preserves trim and WebP semantics.
//! All images and GLib buffers are scoped; input buffers outlive lazy libvips evaluation.
use anyhow::{Context, Result, anyhow, bail, ensure};
use libc::{c_char, c_double, c_int, c_void};
use std::{
    ffi::{CStr, CString},
    path::PathBuf,
    ptr,
    sync::OnceLock,
};

type P = *mut c_void;
const END: *const c_char = ptr::null();

macro_rules! api {
    ($($name:ident: $signature:ty),* $(,)?) => {
        pub struct Vips { $($name: $signature,)* }
        impl Vips {
            unsafe fn load(handle: P) -> Result<Self> {
                Ok(Self { $($name: {
                    let symbol = unsafe { libc::dlsym(handle, concat!(stringify!($name), "\0").as_ptr().cast()) };
                    ensure!(!symbol.is_null(), "libvips missing {}", stringify!($name));
                    unsafe { std::mem::transmute::<P, $signature>(symbol) }
                },)* })
            }
        }
    }
}
api! {
    vips_init: unsafe extern "C" fn(*const c_char) -> c_int,
    vips_concurrency_set: unsafe extern "C" fn(c_int),
    vips_error_buffer: unsafe extern "C" fn() -> *const c_char,
    vips_error_clear: unsafe extern "C" fn(),
    vips_image_new_from_buffer: unsafe extern "C" fn(*const c_void, usize, *const c_char, ...) -> P,
    vips_image_new_from_memory_copy: unsafe extern "C" fn(*const c_void, usize, c_int, c_int, c_int, c_int) -> P,
    vips_image_get_width: unsafe extern "C" fn(P) -> c_int,
    vips_image_get_height: unsafe extern "C" fn(P) -> c_int,
    vips_image_get_bands: unsafe extern "C" fn(P) -> c_int,
    vips_image_hasalpha: unsafe extern "C" fn(P) -> c_int,
    vips_image_write_to_memory: unsafe extern "C" fn(P, *mut usize) -> P,
    vips_getpoint: unsafe extern "C" fn(P, *mut *mut c_double, *mut c_int, c_int, c_int, ...) -> c_int,
    vips_array_double_new: unsafe extern "C" fn(*const c_double, c_int) -> P,
    vips_area_unref: unsafe extern "C" fn(P),
    vips_find_trim: unsafe extern "C" fn(P, *mut c_int, *mut c_int, *mut c_int, *mut c_int, ...) -> c_int,
    vips_extract_band: unsafe extern "C" fn(P, *mut P, c_int, ...) -> c_int,
    vips_extract_area: unsafe extern "C" fn(P, *mut P, c_int, c_int, c_int, c_int, ...) -> c_int,
    vips_addalpha: unsafe extern "C" fn(P, *mut P, ...) -> c_int,
    vips_colourspace: unsafe extern "C" fn(P, *mut P, c_int, ...) -> c_int,
    vips_cast: unsafe extern "C" fn(P, *mut P, c_int, ...) -> c_int,
    vips_copy: unsafe extern "C" fn(P, *mut P, ...) -> c_int,
    vips_thumbnail_buffer: unsafe extern "C" fn(*const c_void, usize, *mut P, c_int, ...) -> c_int,
    vips_webpsave_buffer: unsafe extern "C" fn(P, *mut P, *mut usize, ...) -> c_int,
    g_object_unref: unsafe extern "C" fn(P),
    g_free: unsafe extern "C" fn(P),
}

impl Vips {
    pub fn global() -> Result<&'static Self> {
        static API: OnceLock<std::result::Result<Vips, String>> = OnceLock::new();
        API.get_or_init(|| Self::open().map_err(|e| format!("{e:#}")))
            .as_ref()
            .map_err(|e| anyhow!("{e}"))
    }

    fn open() -> Result<Self> {
        let mut candidates = Vec::<PathBuf>::new();
        if let Some(path) = std::env::var_os("FANDOM_LIBVIPS_PATH") {
            candidates.push(path.into());
        }
        for root in [
            std::env::current_dir()?,
            PathBuf::from(env!("CARGO_MANIFEST_DIR")),
        ] {
            for parent in root.ancestors() {
                let img = parent.join("node_modules/@img");
                if let Ok(packages) = std::fs::read_dir(img) {
                    for package in packages
                        .flatten()
                        .filter(|p| p.file_name().to_string_lossy().starts_with("sharp-libvips"))
                    {
                        if let Ok(libs) = std::fs::read_dir(package.path().join("lib")) {
                            for lib in libs
                                .flatten()
                                .filter(|p| p.file_name().to_string_lossy().starts_with("libvips"))
                            {
                                candidates.push(lib.path());
                            }
                        }
                    }
                }
            }
        }
        candidates.extend(
            ["libvips.so.42", "libvips.42.dylib", "libvips-cpp.42.dylib"].map(PathBuf::from),
        );
        let mut failures = Vec::new();
        for path in candidates {
            let path_c = CString::new(path.to_string_lossy().as_bytes())?;
            // The loaded handle intentionally lives for the process lifetime, like libvips itself.
            let handle =
                unsafe { libc::dlopen(path_c.as_ptr(), libc::RTLD_NOW | libc::RTLD_LOCAL) };
            if handle.is_null() {
                continue;
            }
            let loaded = unsafe { Self::load(handle) };
            match loaded {
                Ok(api) => {
                    api.check(unsafe { (api.vips_init)(c"fandom-scraper-v2".as_ptr()) })?;
                    // Parallelism is bounded at the application layer to avoid CPU oversubscription.
                    unsafe {
                        (api.vips_concurrency_set)(1);
                    }
                    return Ok(api);
                }
                Err(e) => {
                    failures.push(e.to_string());
                    unsafe {
                        libc::dlclose(handle);
                    }
                }
            }
        }
        bail!(
            "libvips could not be loaded. Install libvips or set FANDOM_LIBVIPS_PATH to the library used by Sharp. {}",
            failures.join("; ")
        )
    }

    fn check(&self, result: c_int) -> Result<()> {
        if result != 0 {
            let error = unsafe {
                CStr::from_ptr((self.vips_error_buffer)())
                    .to_string_lossy()
                    .into_owned()
            };
            unsafe {
                (self.vips_error_clear)();
            }
            bail!("libvips: {error}");
        }
        Ok(())
    }

    fn image(&self, ptr: P) -> Result<Image<'_>> {
        if ptr.is_null() {
            self.check(-1)?;
        }
        Ok(Image { ptr, api: self })
    }

    fn decode<'a>(&'a self, buffer: &[u8]) -> Result<Image<'a>> {
        self.image(unsafe {
            (self.vips_image_new_from_buffer)(
                buffer.as_ptr().cast(),
                buffer.len(),
                c"".as_ptr(),
                END,
            )
        })
    }

    fn srgb<'a>(&'a self, image: &Image<'_>) -> Result<Image<'a>> {
        let mut out = ptr::null_mut();
        self.check(unsafe { (self.vips_colourspace)(image.ptr, &mut out, 22, END) })?; // VIPS_INTERPRETATION_sRGB
        let color = self.image(out)?;
        let mut out = ptr::null_mut();
        self.check(unsafe { (self.vips_cast)(color.ptr, &mut out, 0, END) })?; // VIPS_FORMAT_UCHAR
        self.image(out)
    }

    fn bounds(
        &self,
        image: &Image<'_>,
        background: &[f64],
        threshold: f64,
    ) -> Result<(i32, i32, i32, i32)> {
        let array =
            unsafe { (self.vips_array_double_new)(background.as_ptr(), background.len() as i32) };
        let (mut l, mut t, mut w, mut h) = (0, 0, 0, 0);
        let result = unsafe {
            (self.vips_find_trim)(
                image.ptr,
                &mut l,
                &mut t,
                &mut w,
                &mut h,
                c"background".as_ptr(),
                array,
                c"threshold".as_ptr(),
                threshold,
                END,
            )
        };
        unsafe {
            (self.vips_area_unref)(array);
        }
        self.check(result)?;
        Ok((l, t, w, h))
    }

    fn trim<'a>(&'a self, image: &Image<'_>, threshold: f64) -> Result<Image<'a>> {
        let width = unsafe { (self.vips_image_get_width)(image.ptr) };
        let height = unsafe { (self.vips_image_get_height)(image.ptr) };
        ensure!(
            width >= 3 || height >= 3,
            "Image to trim must be at least 3x3 pixels"
        );
        let mut point = ptr::null_mut();
        let mut bands = 0;
        self.check(unsafe { (self.vips_getpoint)(image.ptr, &mut point, &mut bands, 0, 0, END) })?;
        let background = unsafe { std::slice::from_raw_parts(point, bands as usize).to_vec() };
        unsafe {
            (self.g_free)(point.cast());
        }
        let alpha = unsafe { (self.vips_image_hasalpha)(image.ptr) } != 0;
        let rgb = if alpha {
            &background[..background.len() - 1]
        } else {
            &background
        };
        let (mut l, mut t, mut w, mut h) = self.bounds(image, rgb, threshold)?;
        if alpha {
            let mut out = ptr::null_mut();
            self.check(unsafe { (self.vips_extract_band)(image.ptr, &mut out, bands - 1, END) })?;
            let a = self.image(out)?;
            let (al, at, aw, ah) =
                self.bounds(&a, &background[background.len() - 1..], threshold)?;
            if aw > 0 && ah > 0 {
                if w > 0 && h > 0 {
                    let left = l.min(al);
                    let top = t.min(at);
                    w = (l + w).max(al + aw) - left;
                    h = (t + h).max(at + ah) - top;
                    l = left;
                    t = top;
                } else {
                    l = al;
                    t = at;
                    w = aw;
                    h = ah;
                }
            }
        }
        if w <= 0 || h <= 0 {
            l = 0;
            t = 0;
            w = width;
            h = height;
        }
        let mut out = ptr::null_mut();
        self.check(unsafe { (self.vips_extract_area)(image.ptr, &mut out, l, t, w, h, END) })?;
        self.image(out)
    }

    fn webp(&self, image: &Image<'_>, quality: i32) -> Result<Vec<u8>> {
        self.encode_webp(image, quality, false)
    }

    fn encode_webp(&self, image: &Image<'_>, quality: i32, lossless: bool) -> Result<Vec<u8>> {
        let mut out = ptr::null_mut();
        let mut size = 0;
        self.check(unsafe {
            (self.vips_webpsave_buffer)(
                image.ptr,
                &mut out,
                &mut size,
                c"Q".as_ptr(),
                quality,
                c"lossless".as_ptr(),
                i32::from(lossless),
                c"effort".as_ptr(),
                4_i32,
                c"keep".as_ptr(),
                0_i32,
                END,
            )
        })?;
        let bytes = unsafe { std::slice::from_raw_parts(out.cast::<u8>(), size).to_vec() };
        unsafe {
            (self.g_free)(out);
        }
        Ok(bytes)
    }

    pub fn asset(&self, buffer: &[u8], remove_white: bool) -> Result<Vec<u8>> {
        let decoded = self.decode(buffer)?;
        let trimmed = self.trim(&decoded, 20.0)?;
        let srgb = self.srgb(&trimmed)?;
        let first = self.webp(&srgb, 85)?;
        if !remove_white {
            return Ok(first);
        }
        match self.remove_colors(&first) {
            Ok(encoded) => Ok(encoded),
            Err(error) => {
                eprintln!("Error removing image background: {error:#}");
                Ok(first)
            }
        }
    }

    /// Crop the near-black frame, including its compression noise. Keep the
    /// original black pixels inside the crop: pupils and outlines are artwork.
    pub fn profile_icon(&self, buffer: &[u8]) -> Result<Vec<u8>> {
        let decoded = self.decode(buffer)?;
        let srgb = self.srgb(&decoded)?;
        let trimmed = self.trim(&srgb, 50.0)?;
        self.encode_webp(&trimmed, 100, true)
            .context("encoding borderless profile icon")
    }

    fn remove_colors(&self, first: &[u8]) -> Result<Vec<u8>> {
        // The old pipeline decodes the first lossy WebP before removing colors, then encodes again.
        let decoded = self.decode(first)?;
        // Sharp's metadata() reports the original channel count even after ensureAlpha().
        // Its three-channel inputs fail this step and leave the first WebP on disk.
        ensure!(
            unsafe { (self.vips_image_get_bands)(decoded.ptr) } == 4,
            "Image must have an alpha channel."
        );
        let alpha;
        let input = if unsafe { (self.vips_image_hasalpha)(decoded.ptr) } == 0 {
            let mut out = ptr::null_mut();
            self.check(unsafe { (self.vips_addalpha)(decoded.ptr, &mut out, END) })?;
            alpha = self.image(out)?;
            &alpha
        } else {
            &decoded
        };
        let srgb = self.srgb(input)?;
        let width = unsafe { (self.vips_image_get_width)(srgb.ptr) };
        let height = unsafe { (self.vips_image_get_height)(srgb.ptr) };
        let bands = unsafe { (self.vips_image_get_bands)(srgb.ptr) };
        ensure!(bands == 4, "Image must have an alpha channel.");
        let mut size = 0;
        let raw = unsafe { (self.vips_image_write_to_memory)(srgb.ptr, &mut size) };
        if raw.is_null() {
            self.check(-1)?;
        }
        let pixels = unsafe { std::slice::from_raw_parts_mut(raw.cast::<u8>(), size) };
        for pixel in pixels.as_chunks_mut::<4>().0 {
            if [0x8c_u8, 0x73, 0x5c, 0x31, 0x1f]
                .iter()
                .any(|gray| pixel[..3].iter().all(|c| c.abs_diff(*gray) <= 10))
            {
                pixel[3] = 0;
            }
        }
        let image = self.image(unsafe {
            (self.vips_image_new_from_memory_copy)(raw, size, width, height, 4, 0)
        });
        unsafe {
            (self.g_free)(raw);
        }
        let image = image?;
        let mut out = ptr::null_mut();
        self.check(unsafe {
            (self.vips_copy)(image.ptr, &mut out, c"interpretation".as_ptr(), 22_i32, END)
        })?;
        let rgb = self.image(out)?;
        let trimmed = self.trim(&rgb, 10.0)?;
        self.webp(&trimmed, 80)
    }

    pub fn gear(&self, buffer: &[u8]) -> Result<Vec<u8>> {
        let mut out = ptr::null_mut();
        self.check(unsafe {
            (self.vips_thumbnail_buffer)(
                buffer.as_ptr().cast(),
                buffer.len(),
                &mut out,
                80_i32,
                c"height".as_ptr(),
                10_000_000_i32,
                c"size".as_ptr(),
                0_i32,
                END,
            )
        })?;
        let thumb = self.image(out)?;
        let srgb = self.srgb(&thumb)?;
        self.webp(&srgb, 80).context("encoding gear icon")
    }
}

struct Image<'a> {
    ptr: P,
    api: &'a Vips,
}
impl Drop for Image<'_> {
    fn drop(&mut self) {
        unsafe {
            (self.api.g_object_unref)(self.ptr);
        }
    }
}
