use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuiltinCommand {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
}

/// Return all built-in commands for the command palette.
pub fn list_builtin_commands() -> Vec<BuiltinCommand> {
    vec![
        BuiltinCommand { id: "chat.new".into(), name: "New Session".into(), description: "Start a new chat session".into(), category: "Chat".into() },
        BuiltinCommand { id: "chat.clear".into(), name: "Clear Chat".into(), description: "Clear current chat messages".into(), category: "Chat".into() },
        BuiltinCommand { id: "project.add".into(), name: "Add Project".into(), description: "Add a new project folder".into(), category: "Project".into() },
        BuiltinCommand { id: "project.switch".into(), name: "Switch Project".into(), description: "Switch to another project".into(), category: "Project".into() },
        BuiltinCommand { id: "files.toggle".into(), name: "Toggle File Panel".into(), description: "Show or hide the file browser".into(), category: "View".into() },
        BuiltinCommand { id: "view.theme".into(), name: "Toggle Theme".into(), description: "Switch between dark and light theme".into(), category: "View".into() },
        BuiltinCommand { id: "credit.show".into(), name: "Show Credit Usage".into(), description: "View detailed credit/usage stats".into(), category: "Credit".into() },
        BuiltinCommand { id: "settings.open".into(), name: "Open Settings".into(), description: "Open the settings panel".into(), category: "Settings".into() },
    ]
}
