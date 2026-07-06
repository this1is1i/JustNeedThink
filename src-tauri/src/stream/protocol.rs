//! SDK Control Protocol types (stub).

use serde::{Deserialize, Serialize};

/// A control request received from Claude CLI.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "subtype")]
pub enum ControlRequest {
    #[serde(rename = "can_use_tool")]
    CanUseTool {
        tool_name: String,
        input: serde_json::Value,
        tool_use_id: Option<String>,
    },
    #[serde(rename = "set_permission_mode")]
    SetPermissionMode { mode: String },
    #[serde(rename = "set_model")]
    SetModel { model: Option<String> },
    #[serde(rename = "interrupt")]
    Interrupt,
}
