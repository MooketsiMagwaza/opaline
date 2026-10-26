//! Icon extraction. Windows asks the shell for the icon Explorer would draw (this also covers
//! .lnk shortcuts to desktop and Store apps). Other platforms have no implementation yet, so the
//! UI falls back to a letter tile there.

use base64::{Engine, engine::general_purpose::STANDARD};

const ICON_SIZE: u32 = 128;

/// Returns the item's icon as a `data:image/png;base64,...` URL.
pub fn icon_data_url(path: &str) -> Option<String> {
    let png = imp::icon_png(path, ICON_SIZE)?;
    Some(format!("data:image/png;base64,{}", STANDARD.encode(png)))
}

#[cfg(windows)]
mod imp {
    use std::{
        ffi::c_void,
        mem::size_of,
        sync::{OnceLock, mpsc},
        thread,
    };

    use windows::{
        Win32::{
            Foundation::SIZE,
            Graphics::Gdi::{
                BITMAP, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, DeleteObject, GetDC,
                GetDIBits, GetObjectW, HBITMAP, ReleaseDC,
            },
            System::Com::{COINIT_APARTMENTTHREADED, CoInitializeEx, CoUninitialize, IBindCtx},
            UI::Shell::{IShellItemImageFactory, SHCreateItemFromParsingName, SIIGBF_ICONONLY},
        },
        core::HSTRING,
    };

    type Request = (String, u32, mpsc::Sender<Option<Vec<u8>>>);

    static WORKER: OnceLock<mpsc::Sender<Request>> = OnceLock::new();

    /// Shell icon extraction is happiest on one STA thread and misbehaves when many run at once
    /// (the WinUI beta lost icons that way), so every request goes through this single worker.
    fn worker() -> &'static mpsc::Sender<Request> {
        WORKER.get_or_init(|| {
            let (sender, receiver) = mpsc::channel::<Request>();

            thread::Builder::new()
                .name("icon-worker".into())
                .spawn(move || {
                    unsafe {
                        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
                    }

                    for (path, size, reply) in receiver {
                        // The shell occasionally fails the first request for an item, so retry once.
                        let png = extract(&path, size).or_else(|| extract(&path, size));
                        let _ = reply.send(png);
                    }

                    unsafe { CoUninitialize() };
                })
                .expect("couldn't start the icon worker thread");

            sender
        })
    }

    pub fn icon_png(path: &str, size: u32) -> Option<Vec<u8>> {
        let (reply_sender, reply_receiver) = mpsc::channel();
        worker().send((path.to_owned(), size, reply_sender)).ok()?;
        reply_receiver.recv().ok().flatten()
    }

    fn extract(path: &str, size: u32) -> Option<Vec<u8>> {
        unsafe {
            let wide = HSTRING::from(path);
            let factory: IShellItemImageFactory =
                SHCreateItemFromParsingName(&wide, None::<&IBindCtx>).ok()?;
            let size = SIZE {
                cx: size as i32,
                cy: size as i32,
            };
            let bitmap = factory.GetImage(size, SIIGBF_ICONONLY).ok()?;

            let png = bitmap_to_png(bitmap);
            let _ = DeleteObject(bitmap.into());
            png
        }
    }

    unsafe fn bitmap_to_png(bitmap: HBITMAP) -> Option<Vec<u8>> {
        let mut header = BITMAP::default();
        let copied = unsafe {
            GetObjectW(
                bitmap.into(),
                size_of::<BITMAP>() as i32,
                Some(&mut header as *mut BITMAP as *mut c_void),
            )
        };
        if copied == 0 || header.bmWidth <= 0 || header.bmHeight <= 0 {
            return None;
        }
        let (width, height) = (header.bmWidth, header.bmHeight);

        // A negative height asks for a top-down DIB, the row order PNG expects.
        let mut info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };

        let mut pixels = vec![0u8; (width * height * 4) as usize];
        let lines = unsafe {
            let hdc = GetDC(None);
            let lines = GetDIBits(
                hdc,
                bitmap,
                0,
                height as u32,
                Some(pixels.as_mut_ptr().cast()),
                &mut info,
                DIB_RGB_COLORS,
            );
            ReleaseDC(None, hdc);
            lines
        };
        if lines == 0 {
            return None;
        }

        // The shell hands back premultiplied BGRA; PNG wants straight RGBA. Icons without an
        // alpha channel come back fully transparent, so make those opaque instead.
        let has_alpha = pixels.chunks_exact(4).any(|pixel| pixel[3] != 0);
        for pixel in pixels.chunks_exact_mut(4) {
            let (blue, green, red) = (pixel[0] as u32, pixel[1] as u32, pixel[2] as u32);
            let alpha = if has_alpha { pixel[3] as u32 } else { 255 };

            let straight = |channel: u32| -> u8 {
                if alpha == 0 || alpha == 255 {
                    channel as u8
                } else {
                    ((channel * 255 + alpha / 2) / alpha).min(255) as u8
                }
            };

            pixel[0] = straight(red);
            pixel[1] = straight(green);
            pixel[2] = straight(blue);
            pixel[3] = alpha as u8;
        }

        let mut out = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut out, width as u32, height as u32);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);
            encoder.set_compression(png::Compression::Fast);

            let mut writer = encoder.write_header().ok()?;
            writer.write_image_data(&pixels).ok()?;
        }
        Some(out)
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn icon_png(_path: &str, _size: u32) -> Option<Vec<u8>> {
        None
    }
}
