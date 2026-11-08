//! Serves icons and window previews to the webview as plain image bytes through the `opaline` URI scheme
//! (`http://opaline.localhost/…` on Windows, built with `convertFileSrc(route, "opaline")` on the UI side).
//!
//! These used to travel as base64 `data:` URLs inside JSON command results: a third larger on the wire, encoded and decoded
//! at both ends, kept in the page as strings and, for icons, written to local storage as a 2 MB blob parsed at every start.
//! As image responses they are streamed to the browser, which decodes, caches and evicts them itself.
//!
//! The route is the percent-decoded path: `icon:<path>`, `winicon:<hwnd>` or `thumb:<hwnd>:<nonce>` (the nonce only gives
//! each capture its own URL). Anything else, and any image that cannot be produced, is a bare 404 so the UI falls back to a
//! letter tile or "Preview unavailable".

use percent_encoding::percent_decode_str;
use tauri::http::{Response, StatusCode, header};

use crate::{capture, icons};

pub const SCHEME: &str = "opaline";
const THUMBNAIL_WIDTH: u32 = 360;
/// Icons change when an app is updated, so they may be reused for a day; a window's icon only for a minute, because a window
/// handle can be handed to a different app after the first one closes.
const ICON_CACHE: &str = "private, max-age=86400";
const WINDOW_ICON_CACHE: &str = "private, max-age=60";
const THUMBNAIL_CACHE: &str = "private, max-age=60";

#[derive(Debug, PartialEq, Eq)]
enum Route {
    Icon(String),
    WindowIcon(i64),
    Thumbnail(i64),
    Unknown,
}

fn parse(request_path: &str) -> Route {
    let decoded = percent_decode_str(request_path.trim_start_matches('/')).decode_utf8_lossy();
    if let Some(path) = decoded.strip_prefix("icon:") {
        return Route::Icon(path.to_string());
    }
    if let Some(handle) = decoded.strip_prefix("winicon:") {
        return handle.parse().map_or(Route::Unknown, Route::WindowIcon);
    }
    if let Some(rest) = decoded.strip_prefix("thumb:") {
        let handle = rest.split(':').next().unwrap_or_default();
        return handle.parse().map_or(Route::Unknown, Route::Thumbnail);
    }
    Route::Unknown
}

fn image(content_type: &'static str, cache: &'static str, bytes: Vec<u8>) -> Response<Vec<u8>> {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, cache)
        .body(bytes)
        .unwrap_or_default()
}

fn not_found() -> Response<Vec<u8>> {
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .header(header::CACHE_CONTROL, "no-store")
        .body(Vec::new())
        .unwrap_or_default()
}

/// Blocks while Windows produces the image (the shell icon worker is serial), so callers run it off the UI thread.
pub fn respond(request_path: &str) -> Response<Vec<u8>> {
    let produced = match parse(request_path) {
        Route::Icon(path) => icons::icon_png(&path).map(|png| image("image/png", ICON_CACHE, png)),
        Route::WindowIcon(hwnd) => {
            icons::window_icon_png(hwnd).map(|png| image("image/png", WINDOW_ICON_CACHE, png))
        }
        Route::Thumbnail(hwnd) => capture::window_thumbnail_jpeg(hwnd, THUMBNAIL_WIDTH)
            .map(|jpeg| image("image/jpeg", THUMBNAIL_CACHE, jpeg)),
        Route::Unknown => None,
    };
    produced.unwrap_or_else(not_found)
}

#[cfg(test)]
mod tests {
    use super::{Route, parse};

    #[test]
    fn decodes_an_icon_path_with_spaces_and_separators() {
        assert_eq!(
            parse("/icon%3AC%3A%5CUsers%5CNido%5CDesktop%5CVisual%20Studio%20Code.lnk"),
            Route::Icon(r"C:\Users\Nido\Desktop\Visual Studio Code.lnk".to_string())
        );
        assert_eq!(
            parse("/icon%3Ashell%3AAppsFolder%5CMicrosoft.WindowsStore_8wekyb3d8bbwe!App"),
            Route::Icon(r"shell:AppsFolder\Microsoft.WindowsStore_8wekyb3d8bbwe!App".to_string())
        );
    }

    #[test]
    fn reads_window_handles_and_ignores_the_thumbnail_nonce() {
        assert_eq!(parse("/winicon%3A394566"), Route::WindowIcon(394_566));
        assert_eq!(parse("/thumb%3A394566%3A17"), Route::Thumbnail(394_566));
    }

    #[test]
    fn refuses_anything_it_does_not_recognise() {
        assert_eq!(parse("/"), Route::Unknown);
        assert_eq!(parse("/backdrop"), Route::Unknown);
        assert_eq!(parse("/winicon%3Anot-a-number"), Route::Unknown);
        assert_eq!(parse("/thumb%3A%3A1"), Route::Unknown);
    }
}
