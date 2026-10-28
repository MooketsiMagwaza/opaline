//! The ordinary Windows file picker, used only when a person chooses a workspace item.

#[cfg(windows)]
pub fn choose(kind: &str, owner: isize) -> Result<Option<String>, String> {
    use std::ffi::c_void;
    use windows::Win32::{
        Foundation::HWND,
        System::Com::{
            CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, CoCreateInstance, CoInitializeEx,
            CoTaskMemFree, CoUninitialize,
        },
        UI::Shell::{
            FILEOPENDIALOGOPTIONS, FOS_FILEMUSTEXIST, FOS_FORCEFILESYSTEM, FOS_PATHMUSTEXIST,
            FOS_PICKFOLDERS, FileOpenDialog, IFileOpenDialog, SIGDN_FILESYSPATH,
        },
    };

    let initialized = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
    if initialized.is_err() {
        return Err("Could not open the Windows picker.".into());
    }
    let result = (|| {
        let dialog: IFileOpenDialog =
            unsafe { CoCreateInstance(&FileOpenDialog, None, CLSCTX_INPROC_SERVER) }
                .map_err(|error| error.to_string())?;
        let options = unsafe { dialog.GetOptions() }.map_err(|error| error.to_string())?;
        let mut flags = options.0 | FOS_FORCEFILESYSTEM.0 | FOS_PATHMUSTEXIST.0;
        if kind == "folder" {
            flags |= FOS_PICKFOLDERS.0;
        } else {
            flags |= FOS_FILEMUSTEXIST.0;
        }
        unsafe { dialog.SetOptions(FILEOPENDIALOGOPTIONS(flags)) }
            .map_err(|error| error.to_string())?;
        let owner = (owner != 0).then_some(HWND(owner as *mut c_void));
        match unsafe { dialog.Show(owner) } {
            Ok(()) => {}
            Err(error) if error.code().0 == 0x800704C7u32 as i32 => return Ok(None),
            Err(error) => return Err(error.to_string()),
        }
        let item = unsafe { dialog.GetResult() }.map_err(|error| error.to_string())?;
        let path =
            unsafe { item.GetDisplayName(SIGDN_FILESYSPATH) }.map_err(|error| error.to_string())?;
        let text = unsafe { path.to_string() }.map_err(|error| error.to_string());
        unsafe { CoTaskMemFree(Some(path.0.cast::<c_void>())) };
        text.map(Some)
    })();
    unsafe { CoUninitialize() };
    result
}

#[cfg(not(windows))]
pub fn choose(_kind: &str, _owner: isize) -> Result<Option<String>, String> {
    Err("The native picker is available on Windows.".into())
}
