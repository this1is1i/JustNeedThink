use crate::workflow::engine::{StepRun, StepStatus, StepType};

/// Create a new StepRun from a workflow step definition.
pub fn create_step_run(step_id: &str, step_name: &str, step_type: &StepType) -> StepRun {
    StepRun {
        step_id: step_id.to_string(),
        step_name: step_name.to_string(),
        step_type: step_type.clone(),
        status: StepStatus::Pending,
        output: None,
        error: None,
    }
}

/// Transition a step to the next logical status.
pub fn transition_step(run: &mut StepRun, new_status: StepStatus, output: Option<String>, error: Option<String>) {
    run.status = new_status;
    if let Some(o) = output { run.output = Some(o); }
    if let Some(e) = error { run.error = Some(e); }
}
