//! Platform-specific utilities.

/// Check if we're running on Windows.
pub const fn is_windows() -> bool {
    cfg!(target_os = "windows")
}

/// Returns the app data directory for JustNeedThink.
pub fn app_data_dir() -> Option<std::path::PathBuf> {
    dirs::data_local_dir().map(|d| d.join("JustNeedThink"))
}
