use std::collections::HashMap;

/// Variable context for workflow execution.
/// Supports simple template substitution: `{{variable.path}}`
#[derive(Debug, Clone, Default)]
pub struct WorkflowContext {
    pub variables: HashMap<String, String>,
    pub step_outputs: HashMap<String, String>,
}

impl WorkflowContext {
    pub fn new() -> Self {
        Self { variables: HashMap::new(), step_outputs: HashMap::new() }
    }

    /// Resolve template variables in a string.
    /// Replaces `{{key}}` with the corresponding variable value or step output.
    pub fn resolve(&self, input: &str) -> String {
        let mut result = input.to_string();
        for (key, value) in &self.variables {
            result = result.replace(&format!("{{{{{}}}}}", key), value);
        }
        for (key, value) in &self.step_outputs {
            result = result.replace(&format!("{{{{{}}}}}", key), value);
        }
        result
    }

    /// Set a workflow-level variable.
    pub fn set_var(&mut self, key: &str, value: &str) {
        self.variables.insert(key.to_string(), value.to_string());
    }

    /// Store a step output for later reference.
    pub fn set_step_output(&mut self, step_id: &str, output: &str) {
        self.step_outputs.insert(step_id.to_string(), output.to_string());
    }
}
