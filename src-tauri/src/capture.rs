//! Screen and window capture: the blurred backdrop behind the overlay and the rail's hover previews.
//! Frames stay in memory; they are downscaled and handed to the UI as `data:` URLs.

use std::io::Cursor;

use base64::{Engine, engine::general_purpose::STANDARD};
use image::{DynamicImage, ImageFormat, RgbImage, imageops::FilterType};

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
        .chunks_exact(4)
        .flat_map(|pixel| [pixel[2], pixel[1], pixel[0]])
        .collect();
    let mut image = RgbImage::from_raw(frame.width, frame.height, rgb)?;

    if image.width() > max_width {
        let height = (image.height() as u64 * max_width as u64 / image.width() as u64).max(1) as u32;
        image = image::imageops::resize(&image, max_width, height, FilterType::Triangle);
    }

    let mut bytes = Vec::new();
    DynamicImage::ImageRgb8(image)
        .write_to(&mut Cursor::new(&mut bytes), ImageFormat::Jpeg)
        .ok()?;
    Some(format!("data:image/jpeg;base64,{}", STANDARD.encode(bytes)))
}

/// A rectangle of the virtual screen, in physical pixels.
pub fn snapshot_rect(x: i32, y: i32, width: i32, height: i32, max_width: u32) -> Option<String> {
    to_jpeg_data_url(imp::screen_rect(x, y, width, height)?, max_width)
}

/// One window's contents, even when other windows cover it.
pub fn window_thumbnail(hwnd: i64, max_width: u32) -> Option<String> {
    to_jpeg_data_url(imp::window(hwnd)?, max_width)
}

#[cfg(windows)]
mod imp {
    use std::mem::size_of;

    use windows::Win32::{
        Foundation::{HWND, RECT},
        Graphics::Gdi::{
            BI_RGB, BITMAPINFO, BITMAPINFOHEADER, BitBlt, CAPTUREBLT, CreateCompatibleBitmap,
            CreateCompatibleDC, DIB_RGB_COLORS, DeleteDC, DeleteObject, GetDC, GetDIBits, HBITMAP,
            HDC, ReleaseDC, SRCCOPY, SelectObject,
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

        (lines != 0).then(|| Frame {
            pixels,
            width: width as u32,
            height: height as u32,
        })
    }

    pub fn screen_rect(x: i32, y: i32, width: i32, height: i32) -> Option<Frame> {
        if width <= 0 || height <= 0 {
            return None;
        }

        unsafe {
            let screen = GetDC(None);
            let memory = CreateCompatibleDC(Some(screen));
            let bitmap = CreateCompatibleBitmap(screen, width, height);
            let previous = SelectObject(memory, bitmap.into());

            // CAPTUREBLT includes layered windows, which is what a live wallpaper host is.
            let copied = BitBlt(
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
            .is_ok();

            // The bitmap must not be selected into a DC while it is read.
            SelectObject(memory, previous);
            let frame = if copied {
                read_pixels(screen, bitmap, width, height)
            } else {
                None
            };

            let _ = DeleteObject(bitmap.into());
            let _ = DeleteDC(memory);
            ReleaseDC(None, screen);
            frame
        }
    }

    pub fn window(hwnd: i64) -> Option<Frame> {
        unsafe {
            let hwnd = HWND(hwnd as _);
            let mut rect = RECT::default();
            GetWindowRect(hwnd, &mut rect).ok()?;
            let (width, height) = (rect.right - rect.left, rect.bottom - rect.top);
            if width <= 0 || height <= 0 {
                return None;
            }

            let screen = GetDC(None);
            let memory = CreateCompatibleDC(Some(screen));
            let bitmap = CreateCompatibleBitmap(screen, width, height);
            let previous = SelectObject(memory, bitmap.into());

            let printed = PrintWindow(hwnd, memory, PRINT_WINDOW_FLAGS(PW_RENDERFULLCONTENT)).as_bool();

            SelectObject(memory, previous);
            let frame = if printed {
                read_pixels(screen, bitmap, width, height)
            } else {
                None
            };

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

    pub fn screen_rect(_x: i32, _y: i32, _width: i32, _height: i32) -> Option<Frame> {
        None
    }

    pub fn window(_hwnd: i64) -> Option<Frame> {
        None
    }
}
