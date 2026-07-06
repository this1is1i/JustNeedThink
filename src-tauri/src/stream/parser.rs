//! NDJSON stream parser (stub).

use serde_json::Value;

/// Parse a single NDJSON line and return the parsed JSON value.
pub fn parse_line(line: &str) -> Option<Value> {
    serde_json::from_str(line).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_valid_json_line() {
        let result = parse_line(r#"{"type":"test","data":"hello"}"#);
        assert!(result.is_some());
        let val = result.unwrap();
        assert_eq!(val["type"], "test");
    }

    #[test]
    fn returns_none_for_invalid_json() {
        let result = parse_line("not json");
        assert!(result.is_none());
    }
}
