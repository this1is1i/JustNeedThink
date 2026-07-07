use crate::credit::tracker::CreditSummary;

/// Alert thresholds as percentages of daily limit.
const WARN_THRESHOLD: f64 = 70.0;
const CRITICAL_THRESHOLD: f64 = 90.0;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreditAlert {
    pub level: AlertLevel,
    pub message: String,
    pub percent: f64,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum AlertLevel {
    Warn,
    Critical,
}

/// Check if we should emit a credit alert.
pub fn check_alerts(summary: &CreditSummary) -> Option<CreditAlert> {
    if !summary.has_rate_limit || summary.daily_limit == 0 {
        return None;
    }

    if summary.daily_percent >= CRITICAL_THRESHOLD {
        Some(CreditAlert {
            level: AlertLevel::Critical,
            message: format!(
                "Daily token usage at {:.0}% ({}/{} tokens)",
                summary.daily_percent,
                summary.daily_input_tokens + summary.daily_output_tokens,
                summary.daily_limit
            ),
            percent: summary.daily_percent,
        })
    } else if summary.daily_percent >= WARN_THRESHOLD {
        Some(CreditAlert {
            level: AlertLevel::Warn,
            message: format!(
                "Daily token usage at {:.0}% ({}/{} tokens)",
                summary.daily_percent,
                summary.daily_input_tokens + summary.daily_output_tokens,
                summary.daily_limit
            ),
            percent: summary.daily_percent,
        })
    } else {
        None
    }
}
