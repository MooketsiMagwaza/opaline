//! Screen and window capture: the blurred backdrop behind the overlay and the rail's hover previews.
//! Frames stay in memory; they are downscaled and handed to the UI as `data:` URLs.

use std::io::Cursor;

use base64::{Engine, engine::general_purpose::STANDARD};
use image::{DynamicImage, RgbImage, codecs::jpeg::JpegEncoder, imageops::FilterType};

/// A captured frame as top-down BGRA.
struct Frame {
    pixels: Vec<u8>,
    width: u32,
    height: u32,
}

/// Downscales to at most `max_width` and encodes as a `data:image/jpeg` URL.
fn to_jpeg_data_url(frame: Frame, max_width: u32) -> Option<String> {
    let rgb: Vec<u8> = frame
        .pixels
        .as_chunks::<4>()
        .0
        .iter()
        .flat_map(|pixel| [pixel[2], pixel[1], pixel[0]])
        .collect();
    let mut image = RgbImage::from_raw(frame.width, frame.height, rgb)?;

    if image.width() > max_width {
        let height =
            (image.height() as u64 * max_width as u64 / image.width() as u64).max(1) as u32;
        image = image::imageops::resize(&image, max_width, height, FilterType::Triangle);
    }

    let mut bytes = Vec::new();
    JpegEncoder::new_with_quality(&mut Cursor::new(&mut bytes), 58)
        .encode_image(&DynamicImage::ImageRgb8(image))
        .ok()?;
    Some(format!("data:image/jpeg;base64,{}", STANDARD.encode(bytes)))
}

/// A rectangle of the virtual screen, in physical pixels.
pub fn snapshot_rect(x: i32, y: i32, width: i32, height: i32, max_width: u32) -> Option<String> {
    #[cfg(debug_assertions)]
    let started = std::time::Instant::now();

    // Scale while GDI copies the screen. Converting and resizing a full-resolution BGRA frame in
    // Rust dominated the hotkey path even though the blurred backdrop never needs those pixels.
    let snapshot = to_jpeg_data_url(imp::screen_rect(x, y, width, height, max_width)?, max_width);

    #[cfg(debug_assertions)]
    eprintln!("opaline: backdrop capture took {:?}", started.elapsed());

    snapshot
}

/// One window's contents, even when other windows cover it.
pub fn window_thumbnail(hwnd: i64, max_width: u32) -> Option<String> {
    to_jpeg_data_url(imp::window(hwnd, max_width)?, max_width)
}

#[cfg(windows)]
mod imp {
    use std::mem::size_of;

    use windows::Win32::{
        Foundation::{HWND, RECT},
        Graphics::Gdi::{
            BI_RGB, BITMAPINFO, BITMAPINFOHEADER, BitBlt, CAPTUREBLT, COLORONCOLOR,
            CreateCompatibleBitmap, CreateCompatibleDC, DIB_RGB_COLORS, DeleteDC, DeleteObject,
            GetDC, GetDIBits, HBITMAP, HDC, ReleaseDC, SRCCOPY, SelectObject, SetStretchBltMode,
            StretchBlt,
        },
        Storage::Xps::{PRINT_WINDOW_FLAGS, PrintWindow},
        UI::WindowsAndMessaging::GetWindowRect,
    };

    use super::Frame;

    /// `PW_RENDERFULLCONTENT`: also captures GPU-composited windows (Chromium, Electron, UWP).
    const PW_RENDERFULLCONTENT: u32 = 2;

    unsafe fn read_pixels(hdc: HDC, bitmap: HBITMAP, width: i32, height: i32) -> Option<Frame> {
        // A negative height asks for a top-down DIB.
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
            GetDIBits(
                hdc,
                bitmap,
                0,
                height as u32,
                Some(pixels.as_mut_ptr().cast()),
                &mut info,
                DIB_RGB_COLORS,
            )
        };

        (lines != 0).then_some(Frame {
            pixels,
            width: width as u32,
            height: height as u32,
        })
    }

    pub fn screen_rect(x: i32, y: i32, width: i32, height: i32, max_width: u32) -> Option<Frame> {
        if width <= 0 || height <= 0 {
            return None;
        }

        let target_width = width.min(max_width.max(1) as i32);
        let target_height = ((height as i64 * target_width as i64) / width as i64).max(1) as i32;

        unsafe {
            let screen = GetDC(None);
            let memory = CreateCompatibleDC(Some(screen));
            let bitmap = CreateCompatibleBitmap(screen, target_width, target_height);
            let previous = SelectObject(memory, bitmap.into());

            // CAPTUREBLT includes layered windows, which is what a live wallpaper host is.
            let copied = if target_width == width {
                BitBlt(
                    memory,
                    0,
                    0,
                    width,
                    height,
                    Some(screen),
                    x,
                    y,
                    SRCCOPY | CAPTUREBLT,
                )
                .is_ok()
            } else {
                // COLORONCOLOR is intentionally cheaper than HALFTONE. The CSS backdrop blur
                // hides interpolation differences, while the hotkey path stays responsive.
                SetStretchBltMode(memory, COLORONCOLOR);
                StretchBlt(
                    memory,
                    0,
                    0,
                    target_width,
                    target_height,
                    Some(screen),
                    x,
                    y,
                    width,
                    height,
                    SRCCOPY | CAPTUREBLT,
                )
                .as_bool()
            };

            // The bitmap must not be selected into a DC while it is read.
            SelectObject(memory, previous);
            let frame = if copied {
                read_pixels(screen, bitmap, target_width, target_height)
            } else {
                None
            };

            let _ = DeleteObject(bitmap.into());
            let _ = DeleteDC(memory);
            ReleaseDC(None, screen);
            frame
        }
    }

    pub fn window(hwnd: i64, max_width: u32) -> Option<Frame> {
        unsafe {
            let hwnd = HWND(hwnd as _);
            let mut rect = RECT::default();
            GetWindowRect(hwnd, &mut rect).ok()?;
            let (width, height) = (rect.right - rect.left, rect.bottom - rect.top);
            if width <= 0 || height <= 0 || width > 16384 || height > 16384 {
                return None;
            }

            let screen = GetDC(None);
            let memory = CreateCompatibleDC(Some(screen));
            let bitmap = CreateCompatibleBitmap(screen, width, height);
            let previous = SelectObject(memory, bitmap.into());

            let printed =
                PrintWindow(hwnd, memory, PRINT_WINDOW_FLAGS(PW_RENDERFULLCONTENT)).as_bool();

            // PrintWindow requires the full-size surface, but GDI can downsample before readback.
            // This avoids allocating/converting/resizing a full-screen RGB image for a small card.
            let target_width = width.min(max_width.max(1) as i32);
            let target_height =
                ((height as i64 * target_width as i64) / width as i64).max(1) as i32;
            let scaled_dc = CreateCompatibleDC(Some(screen));
            let scaled_bitmap = CreateCompatibleBitmap(screen, target_width, target_height);
            let old_scaled = SelectObject(scaled_dc, scaled_bitmap.into());
            SetStretchBltMode(scaled_dc, COLORONCOLOR);
            let scaled = printed
                && StretchBlt(
                    scaled_dc,
                    0,
                    0,
                    target_width,
                    target_height,
                    Some(memory),
                    0,
                    0,
                    width,
                    height,
                    SRCCOPY,
                )
                .as_bool();
            SelectObject(scaled_dc, old_scaled);
            let frame = if scaled {
                read_pixels(screen, scaled_bitmap, target_width, target_height)
            } else {
                None
            };
            let _ = DeleteObject(scaled_bitmap.into());
            let _ = DeleteDC(scaled_dc);
            SelectObject(memory, previous);

            let _ = DeleteObject(bitmap.into());
            let _ = DeleteDC(memory);
            ReleaseDC(None, screen);
            frame
        }
    }
}

#[cfg(not(windows))]
mod imp {
    use super::Frame;

    pub fn screen_rect(
        _x: i32,
        _y: i32,
        _width: i32,
        _height: i32,
        _max_width: u32,
    ) -> Option<Frame> {
        None
    }

    pub fn window(_hwnd: i64, _max_width: u32) -> Option<Frame> {
        None
    }
}
