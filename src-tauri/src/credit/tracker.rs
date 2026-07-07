use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

/// In-memory credit tracking state.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreditSummary {
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub total_tokens: u64,
    pub session_count: u64,
    pub daily_input_tokens: u64,
    pub daily_output_tokens: u64,
    pub daily_limit: u64,
    pub daily_percent: f64,
    pub has_rate_limit: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RateLimitInfo {
    pub rate_limit_type: String,
    pub resets_at: Option<i64>,
    pub is_using_overage: bool,
    pub overage_status: Option<String>,
}

#[derive(Debug)]
pub struct CreditTracker {
    summary: Arc<Mutex<CreditSummary>>,
    daily_limit: u64,
}

impl CreditTracker {
    pub fn new() -> Self {
        Self {
            summary: Arc::new(Mutex::new(CreditSummary {
                total_input_tokens: 0,
                total_output_tokens: 0,
                total_tokens: 0,
                session_count: 0,
                daily_input_tokens: 0,
                daily_output_tokens: 0,
                daily_limit: 0,
                daily_percent: 0.0,
                has_rate_limit: false,
            })),
            daily_limit: 0,
        }
    }

    /// Process a rate_limit_event from the NDJSON stream.
    pub async fn update_rate_limit(&self, info: &RateLimitInfo) {
        let mut s = self.summary.lock().await;
        s.has_rate_limit = true;

        // Anthropic daily limit defaults
        if info.rate_limit_type == "daily_tokens" && s.daily_limit == 0 {
            s.daily_limit = 200_000; // default, will be refined by actual limits
        }
    }

    /// Add usage from a result event.
    pub async fn add_usage(&self, input: u64, output: u64) {
        let mut s = self.summary.lock().await;
        s.total_input_tokens += input;
        s.total_output_tokens += output;
        s.total_tokens += input + output;
        s.daily_input_tokens += input;
        s.daily_output_tokens += output;

        if s.daily_limit > 0 {
            s.daily_percent = (s.daily_input_tokens + s.daily_output_tokens) as f64 / s.daily_limit as f64 * 100.0;
        }
    }

    /// Increment session count.
    pub async fn increment_session(&self) {
        let mut s = self.summary.lock().await;
        s.session_count += 1;
    }

    /// Get current credit summary.
    pub async fn get_summary(&self) -> CreditSummary {
        self.summary.lock().await.clone()
    }

    /// Reset daily counters (call at midnight).
    pub async fn reset_daily(&self) {
        let mut s = self.summary.lock().await;
        s.daily_input_tokens = 0;
        s.daily_output_tokens = 0;
        s.daily_percent = 0.0;
    }
}
