use std::fs;
use std::path::Path;

/// Reject paths pointing to sensitive system directories.
fn validate_path_not_system(path: &str) -> Result<(), String> {
    let normalized = Path::new(path).canonicalize().unwrap_or_else(|_| Path::new(path).to_path_buf());
    let s = normalized.display().to_string().to_lowercase();
    if s.starts_with(r"c:\windows") || s.starts_with(r"c:\windows\system32") {
        return Err("Access denied: cannot modify system directories".to_string());
    }
    Ok(())
}

/// Read file content as UTF-8 string.
pub fn read_file_content(path: &str) -> Result<String, String> {
    let path = Path::new(path);
    if !path.exists() {
        return Err(format!("File not found: {}", path.display()));
    }
    if !path.is_file() {
        return Err(format!("Not a file: {}", path.display()));
    }
    // Check file size before reading to avoid loading huge files
    let meta = path.metadata().map_err(|e| format!("Failed to read metadata: {}", e))?;
    if meta.len() > 5 * 1024 * 1024 {
        return Err("File too large (max 5MB)".to_string());
    }
    fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))
}

/// Write content to a file (creates if not exists).
pub fn write_file_content(path: &str, content: &str) -> Result<(), String> {
    validate_path_not_system(path)?;
    let path = Path::new(path);
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent dir: {}", e))?;
        }
    }
    fs::write(path, content).map_err(|e| format!("Failed to write file: {}", e))
}

/// Copy a file or directory.
pub fn copy_file(src: &str, dest: &str) -> Result<(), String> {
    let src_path = Path::new(src);
    if !src_path.exists() {
        return Err(format!("Source not found: {}", src));
    }
    if src_path.is_dir() {
        copy_dir_recursive(src_path, Path::new(dest))?;
    } else {
        if let Some(parent) = Path::new(dest).parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create dest dir: {}", e))?;
        }
        fs::copy(src_path, dest).map_err(|e| format!("Failed to copy: {}", e))?;
    }
    Ok(())
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| format!("Failed to create dest dir: {}", e))?;
    for entry in fs::read_dir(src).map_err(|e| format!("Failed to read dir: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dest_path)?;
        } else {
            fs::copy(&src_path, &dest_path).map_err(|e| format!("Failed to copy: {}", e))?;
        }
    }
    Ok(())
}

/// Rename/move a file or directory.
pub fn rename_file(src: &str, dest: &str) -> Result<(), String> {
    if let Some(parent) = Path::new(dest).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create dest dir: {}", e))?;
        }
    }
    fs::rename(src, dest).map_err(|e| format!("Failed to rename: {}", e))
}

/// Delete a file or directory (recursive for directories).
pub fn delete_file(path: &str) -> Result<(), String> {
    validate_path_not_system(path)?;
    let path = Path::new(path);
    if !path.exists() {
        return Err(format!("Not found: {}", path.display()));
    }
    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|e| format!("Failed to delete directory: {}", e))?;
    } else {
        fs::remove_file(path).map_err(|e| format!("Failed to delete file: {}", e))?;
    }
    Ok(())
}

/// Create a directory (including parents).
pub fn create_directory(path: &str) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| format!("Failed to create directory: {}", e))
}

/// Get file size in bytes.
pub fn get_file_size(path: &str) -> Result<u64, String> {
    let meta = Path::new(path)
        .metadata()
        .map_err(|e| format!("Failed to read metadata: {}", e))?;
    Ok(meta.len())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn read_write_and_delete_file() {
        let dir = TempDir::new().unwrap();
        let file_path = dir.path().join("test.txt");
        let path_str = file_path.to_str().unwrap();

        write_file_content(path_str, "Hello, World!").unwrap();
        assert_eq!(read_file_content(path_str).unwrap(), "Hello, World!");

        delete_file(path_str).unwrap();
        assert!(read_file_content(path_str).is_err());
    }

    #[test]
    fn read_nonexistent_file_returns_error() {
        assert!(read_file_content("/nonexistent/file.txt").is_err());
    }

    #[test]
    fn create_and_delete_directory() {
        let dir = TempDir::new().unwrap();
        let new_dir = dir.path().join("new_folder").join("sub");
        let path_str = new_dir.to_str().unwrap();

        create_directory(path_str).unwrap();
        assert!(new_dir.exists());

        delete_file(dir.path().join("new_folder").to_str().unwrap()).unwrap();
        assert!(!dir.path().join("new_folder").exists());
    }
}
