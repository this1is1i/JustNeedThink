use serde::Serialize;
use std::fs;
use std::path::Path;

/// A node in the file tree.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileNode>>,
}

/// Read a directory tree with depth control.
/// Returns the root-level children of `root_path`.
pub fn read_file_tree(root_path: &str, max_depth: u32) -> Result<Vec<FileNode>, String> {
    let path = Path::new(root_path);
    if !path.exists() {
        return Err(format!("Path does not exist: {}", root_path));
    }
    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", root_path));
    }
    read_dir_recursive(path, 0, max_depth)
}

fn read_dir_recursive(dir: &Path, current_depth: u32, max_depth: u32) -> Result<Vec<FileNode>, String> {
    if current_depth > max_depth {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read directory {}: {}", dir.display(), e))?;

    let mut nodes: Vec<FileNode> = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/folders (starting with .)
        if name.starts_with('.') && name != ".env" {
            continue;
        }
        // Skip node_modules and target
        if name == "node_modules" || name == "target" || name == "dist" || name == ".git" {
            continue;
        }

        let is_dir = path.is_dir();
        let children = if is_dir && current_depth < max_depth {
            Some(read_dir_recursive(&path, current_depth + 1, max_depth)?)
        } else if is_dir {
            Some(Vec::new())
        } else {
            None
        };

        nodes.push(FileNode {
            name,
            path: path.display().to_string(),
            is_dir,
            children,
        });
    }

    // Sort: directories first, then files; alphabetically within each group
    nodes.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        } else if a.is_dir {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    Ok(nodes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn reads_directory_tree() {
        let dir = TempDir::new().unwrap();
        fs::create_dir(dir.path().join("subdir")).unwrap();
        fs::write(dir.path().join("file.txt"), "hello").unwrap();
        fs::write(dir.path().join("subdir").join("nested.txt"), "world").unwrap();

        let tree = read_file_tree(dir.path().to_str().unwrap(), 2).unwrap();

        assert_eq!(tree.len(), 2); // file.txt, subdir
        let subdir = tree.iter().find(|n| n.name == "subdir").unwrap();
        assert!(subdir.is_dir);
        assert_eq!(subdir.children.as_ref().unwrap().len(), 1);
    }

    #[test]
    fn invalid_path_returns_error() {
        let result = read_file_tree("/nonexistent/path", 2);
        assert!(result.is_err());
    }
}
