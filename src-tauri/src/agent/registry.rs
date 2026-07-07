use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentDefinition {
    pub id: String,
    pub name: String,
    pub description: String,
    pub system_prompt: Option<String>,
    pub model: Option<String>,
    pub tools: Vec<String>,
    pub is_builtin: bool,
    pub is_enabled: bool,
    pub created_at: i64,
}

/// Builtin agents provided by default.
pub fn builtin_agents() -> Vec<AgentDefinition> {
    let now = now_ms();
    vec![
        AgentDefinition {
            id: "architect".into(), name: "Architect".into(),
            description: "System design and architecture planning".into(),
            system_prompt: Some("You are a software architect. Design systems, evaluate tradeoffs, and plan architecture.".into()),
            model: None, tools: vec!["Read".into(), "Glob".into(), "Grep".into()],
            is_builtin: true, is_enabled: true, created_at: now,
        },
        AgentDefinition {
            id: "explorer".into(), name: "Explorer".into(),
            description: "Codebase exploration and research".into(),
            system_prompt: Some("You are a code explorer. Search, read, and understand codebases deeply.".into()),
            model: None, tools: vec!["Read".into(), "Glob".into(), "Grep".into(), "WebSearch".into()],
            is_builtin: true, is_enabled: true, created_at: now,
        },
        AgentDefinition {
            id: "implementer".into(), name: "Implementer".into(),
            description: "Code implementation following specifications".into(),
            system_prompt: Some("You are an implementer. Write clean, tested code following the given specifications.".into()),
            model: None, tools: vec!["Read".into(), "Write".into(), "Edit".into(), "Bash".into()],
            is_builtin: true, is_enabled: true, created_at: now,
        },
        AgentDefinition {
            id: "guardian".into(), name: "Guardian".into(),
            description: "Security and code quality review".into(),
            system_prompt: Some("You are a code guardian. Review for security issues, bugs, and code quality.".into()),
            model: None, tools: vec!["Read".into(), "Glob".into(), "Grep".into()],
            is_builtin: true, is_enabled: true, created_at: now,
        },
    ]
}

fn now_ms() -> i64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as i64
}
