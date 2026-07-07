use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentTeam {
    pub id: String,
    pub name: String,
    pub description: String,
    pub leader_agent_id: String,
    pub member_ids: Vec<String>,
    pub collaboration_mode: CollaborationMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CollaborationMode {
    Sequential,
    Parallel,
    Review,
}

pub fn list_default_teams() -> Vec<AgentTeam> {
    vec![
        AgentTeam {
            id: "dev-team".into(),
            name: "Development Team".into(),
            description: "Architect → Implementer → Guardian pipeline".into(),
            leader_agent_id: "architect".into(),
            member_ids: vec!["explorer".into(), "implementer".into(), "guardian".into()],
            collaboration_mode: CollaborationMode::Sequential,
        },
        AgentTeam {
            id: "review-team".into(),
            name: "Review Team".into(),
            description: "Multi-perspective code review with Guardian and Explorer".into(),
            leader_agent_id: "guardian".into(),
            member_ids: vec!["explorer".into(), "implementer".into()],
            collaboration_mode: CollaborationMode::Review,
        },
    ]
}
