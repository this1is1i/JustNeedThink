use serde::{Deserialize, Serialize};

/// A workflow definition (YAML-parsed).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowDefinition {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: i32,
    pub steps: Vec<WorkflowStep>,
    pub created_at: i64,
    pub modified_at: i64,
}

/// A single step in a workflow.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowStep {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub step_type: StepType,
    pub command: Option<String>,
    pub agent: Option<String>,
    pub prompt: Option<String>,
    pub depends_on: Vec<String>,
    pub parallel_with: Vec<String>,
    pub condition: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum StepType {
    Shell,
    Agent,
    Approval,
    Parallel,
    Condition,
}

/// Execution status of a workflow run.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowRun {
    pub id: String,
    pub workflow_id: String,
    pub status: RunStatus,
    pub current_step: Option<String>,
    pub started_at: i64,
    pub completed_at: Option<i64>,
    pub steps: Vec<StepRun>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RunStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StepRun {
    pub step_id: String,
    pub step_name: String,
    pub step_type: StepType,
    pub status: StepStatus,
    pub output: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum StepStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Skipped,
}

/// Default workflow templates.
pub fn default_workflows() -> Vec<WorkflowDefinition> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as i64;

    vec![
        WorkflowDefinition {
            id: "code-review".into(),
            name: "Code Review Workflow".into(),
            description: "Multi-agent code review: Explorer → Guardian → Approval".into(),
            version: 1, created_at: now, modified_at: now,
            steps: vec![
                WorkflowStep {
                    id: "explore".into(), name: "Explore Codebase".into(), step_type: StepType::Agent,
                    agent: Some("explorer".into()),
                    prompt: Some("Explore the codebase and identify key files and patterns.".into()),
                    command: None, depends_on: vec![], parallel_with: vec![], condition: None,
                },
                WorkflowStep {
                    id: "review".into(), name: "Security Review".into(), step_type: StepType::Agent,
                    agent: Some("guardian".into()),
                    prompt: Some("Review the code for security issues and bugs.".into()),
                    command: None, depends_on: vec!["explore".into()], parallel_with: vec![], condition: None,
                },
                WorkflowStep {
                    id: "approve".into(), name: "Approval Gate".into(), step_type: StepType::Approval,
                    agent: None, prompt: Some("Approve the changes?".to_string()),
                    command: None, depends_on: vec!["review".into()], parallel_with: vec![], condition: None,
                },
            ],
        },
        WorkflowDefinition {
            id: "build-test".into(),
            name: "Build & Test Workflow".into(),
            description: "Run build and tests in parallel, then deploy if both pass.".into(),
            version: 1, created_at: now, modified_at: now,
            steps: vec![
                WorkflowStep {
                    id: "build".into(), name: "Build".into(), step_type: StepType::Shell,
                    agent: None, prompt: None,
                    command: Some("pnpm build".into()),
                    depends_on: vec![], parallel_with: vec!["test".into()], condition: None,
                },
                WorkflowStep {
                    id: "test".into(), name: "Run Tests".into(), step_type: StepType::Shell,
                    agent: None, prompt: None,
                    command: Some("pnpm test".into()),
                    depends_on: vec![], parallel_with: vec!["build".into()], condition: None,
                },
                WorkflowStep {
                    id: "deploy".into(), name: "Deploy".into(), step_type: StepType::Shell,
                    agent: None, prompt: None,
                    command: Some("echo 'Deploying...'".into()),
                    depends_on: vec!["build".into(), "test".into()], parallel_with: vec![], condition: None,
                },
            ],
        },
    ]
}
