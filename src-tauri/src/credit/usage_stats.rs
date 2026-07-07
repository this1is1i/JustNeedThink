use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyUsage {
    pub date: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub total_tokens: u64,
}

/// Placeholder for daily usage history from SQLite.
pub fn get_daily_history() -> Vec<DailyUsage> {
    // Phase 4 basic: return empty. Phase 4+ will read from credit_events table.
    Vec::new()
}
