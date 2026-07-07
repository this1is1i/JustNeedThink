use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    pub path: String,
    pub scope: String,
    pub is_enabled: bool,
    pub content: Option<String>,
}

/// Scan for skills in common directories.
pub fn list_skills(project_dir: Option<&str>) -> Vec<SkillInfo> {
    let mut skills = Vec::new();

    // Global skills: ~/.claude/skills/
    if let Some(home) = dirs::home_dir() {
        scan_skills_dir(&home.join(".claude").join("skills"), "global", &mut skills);
    }

    // Project skills: <project>/.claude/skills/
    if let Some(dir) = project_dir {
        scan_skills_dir(&PathBuf::from(dir).join(".claude").join("skills"), "project", &mut skills);
    }

    skills.sort_by(|a, b| a.name.cmp(&b.name));
    skills.dedup_by(|a, b| a.path == b.path);
    skills
}

fn scan_skills_dir(dir: &PathBuf, scope: &str, out: &mut Vec<SkillInfo>) {
    if !dir.exists() {
        return;
    }

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let skill_md = path.join("SKILL.md");
            if skill_md.exists() {
                if let Ok(content) = fs::read_to_string(&skill_md) {
                    let (name, desc) = parse_skill_metadata(&content);
                    out.push(SkillInfo {
                        name: name.unwrap_or_else(|| path.file_name().unwrap_or_default().to_string_lossy().to_string()),
                        description: desc.unwrap_or_default(),
                        path: skill_md.display().to_string(),
                        scope: scope.to_string(),
                        is_enabled: true,
                        content: Some(content),
                    });
                }
            }
        }
    }
}

fn parse_skill_metadata(content: &str) -> (Option<String>, Option<String>) {
    let name = content
        .lines()
        .find(|l| l.starts_with("# ") || l.starts_with("name:"))
        .map(|l| l.trim_start_matches("# ").trim_start_matches("name:").trim().to_string());

    let desc = content
        .lines()
        .find(|l| l.starts_with("description:") || (l.len() > 2 && !l.starts_with('#') && !l.starts_with("name:")))
        .map(|l| l.trim_start_matches("description:").trim().to_string());

    (name, desc)
}

/// Ensure a skill path lies inside a `.claude/skills` directory. Prevents
/// arbitrary file read/write/delete through the skill IPC commands (a
/// malicious or buggy frontend could otherwise target any file on disk).
fn validate_skill_path(path: &str) -> Result<PathBuf, String> {
    if path.trim().is_empty() {
        return Err("Skill path is empty".to_string());
    }
    // Reject traversal sequences up front — defends the not-yet-created-file
    // case where canonicalize() cannot resolve `..` for us.
    if path.contains("..") {
        return Err("Skill path must not contain '..'".to_string());
    }

    let p = Path::new(path);
    // The file may not exist yet (new skill), so fall back to canonicalizing
    // the parent directory and rejoining the file name.
    let resolved = p.canonicalize().unwrap_or_else(|_| match (p.parent(), p.file_name()) {
        (Some(parent), Some(name)) => parent
            .canonicalize()
            .map(|c| c.join(name))
            .unwrap_or_else(|_| p.to_path_buf()),
        _ => p.to_path_buf(),
    });

    let normalized = resolved.to_string_lossy().replace('\\', "/");
    if !normalized.contains("/.claude/skills/") {
        return Err("Skill operations are restricted to .claude/skills directories".to_string());
    }
    Ok(resolved)
}

/// Read a skill file's content.
pub fn read_skill(path: &str) -> Result<String, String> {
    let path = validate_skill_path(path)?;
    fs::read_to_string(&path).map_err(|e| format!("Failed to read skill: {}", e))
}

/// Write skill content back to file.
pub fn write_skill(path: &str, content: &str) -> Result<(), String> {
    let path = validate_skill_path(path)?;
    fs::write(&path, content).map_err(|e| format!("Failed to write skill: {}", e))
}

/// Delete a skill file's containing folder (the `<skill-name>/` directory).
pub fn delete_skill(path: &str) -> Result<(), String> {
    let path = validate_skill_path(path)?;
    if let Some(parent) = path.parent() {
        // Guard against deleting the skills root itself — only remove an
        // individual skill folder nested under `.claude/skills/`.
        let parent_norm = parent.to_string_lossy().replace('\\', "/");
        if parent_norm.ends_with("/.claude/skills") || !parent_norm.contains("/.claude/skills/") {
            return Err("Refusing to delete the skills root directory".to_string());
        }
        fs::remove_dir_all(parent).map_err(|e| format!("Failed to delete skill: {}", e))?;
    }
    Ok(())
}
