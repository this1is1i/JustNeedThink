use std::fs;
use std::path::{Path, PathBuf};

/// Resolve a path through its nearest existing parent. This keeps writes to new
/// paths inside the canonical project root and prevents `..`/symlink escapes.
fn canonical_for_access(path: &Path) -> Result<PathBuf, String> {
    let mut existing = path.to_path_buf();
    let mut suffix = Vec::new();
    while !existing.exists() {
        let name = existing.file_name()
            .ok_or_else(|| format!("Invalid path: {}", path.display()))?
            .to_os_string();
        suffix.push(name);
        existing.pop();
    }
    let mut canonical = existing.canonicalize()
        .map_err(|e| format!("Failed to resolve path {}: {}", existing.display(), e))?;
    for part in suffix.iter().rev() {
        canonical.push(part);
    }
    Ok(canonical)
}

/// Only allow filesystem mutations within the selected project. The root is
/// supplied by the UI but canonicalization makes a forged root/path pair unable
/// to escape that root through traversal or existing symlinks.
fn validate_path_in_root(path: &str, root: &str) -> Result<(), String> {
    let root = Path::new(root).canonicalize()
        .map_err(|e| format!("Failed to resolve project root: {}", e))?;
    let candidate = canonical_for_access(Path::new(path))?;
    if !candidate.starts_with(&root) {
        return Err("Access denied: path must be inside the selected project".to_string());
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
pub fn write_file_content(path: &str, content: &str, root: &str) -> Result<(), String> {
    validate_path_in_root(path, root)?;
    let path = Path::new(path);
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent dir: {}", e))?;
        }
    }
    fs::write(path, content).map_err(|e| format!("Failed to write file: {}", e))
}

/// Copy a file or directory.
pub fn copy_file(src: &str, dest: &str, root: &str) -> Result<(), String> {
    validate_path_in_root(src, root)?;
    validate_path_in_root(dest, root)?;
    let src_path = Path::new(src);
    if !src_path.exists() {
        return Err(format!("Source not found: {}", src));
    }
    if src_path.is_dir() {
        let mut budget = CopyBudget { bytes: 0, files: 0 };
        copy_dir_recursive(src_path, Path::new(dest), &mut budget)?;
    } else {
        if let Some(parent) = Path::new(dest).parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create dest dir: {}", e))?;
        }
        fs::copy(src_path, dest).map_err(|e| format!("Failed to copy: {}", e))?;
    }
    Ok(())
}

// Bounds a recursive directory copy so a huge or pathological tree cannot fill
// the disk or hang the app.
const MAX_COPY_BYTES: u64 = 500 * 1024 * 1024; // 500 MB
const MAX_COPY_FILES: u64 = 10_000;

struct CopyBudget {
    bytes: u64,
    files: u64,
}

fn copy_dir_recursive(src: &Path, dest: &Path, budget: &mut CopyBudget) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| format!("Failed to create dest dir: {}", e))?;
    for entry in fs::read_dir(src).map_err(|e| format!("Failed to read dir: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dest_path, budget)?;
        } else {
            budget.files += 1;
            budget.bytes += entry.metadata().map(|m| m.len()).unwrap_or(0);
            if budget.files > MAX_COPY_FILES {
                return Err(format!("Copy aborted: exceeds {} files", MAX_COPY_FILES));
            }
            if budget.bytes > MAX_COPY_BYTES {
                return Err("Copy aborted: exceeds 500MB limit".to_string());
            }
            fs::copy(&src_path, &dest_path).map_err(|e| format!("Failed to copy: {}", e))?;
        }
    }
    Ok(())
}

/// Rename/move a file or directory.
pub fn rename_file(src: &str, dest: &str, root: &str) -> Result<(), String> {
    validate_path_in_root(src, root)?;
    validate_path_in_root(dest, root)?;
    if let Some(parent) = Path::new(dest).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create dest dir: {}", e))?;
        }
    }
    fs::rename(src, dest).map_err(|e| format!("Failed to rename: {}", e))
}

/// Delete a file or directory (recursive for directories).
pub fn delete_file(path: &str, root: &str) -> Result<(), String> {
    validate_path_in_root(path, root)?;
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
pub fn create_directory(path: &str, root: &str) -> Result<(), String> {
    validate_path_in_root(path, root)?;
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

        let root = dir.path().to_str().unwrap();
        write_file_content(path_str, "Hello, World!", root).unwrap();
        assert_eq!(read_file_content(path_str).unwrap(), "Hello, World!");

        delete_file(path_str, root).unwrap();
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

        let root = dir.path().to_str().unwrap();
        create_directory(path_str, root).unwrap();
        assert!(new_dir.exists());

        delete_file(dir.path().join("new_folder").to_str().unwrap(), root).unwrap();
        assert!(!dir.path().join("new_folder").exists());
    }

    #[test]
    fn mutations_reject_paths_outside_project_root() {
        let project = TempDir::new().unwrap();
        let outside = TempDir::new().unwrap();
        let target = outside.path().join("outside.txt");

        let result = write_file_content(
            target.to_str().unwrap(),
            "must not be written",
            project.path().to_str().unwrap(),
        );

        assert!(result.is_err());
        assert!(!target.exists());
    }
}
