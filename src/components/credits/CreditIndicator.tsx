import type { CreditSummary } from '../../stores/creditStore';

interface CreditIndicatorProps {
  summary: CreditSummary;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function CreditIndicator({ summary }: CreditIndicatorProps) {
  const pct = summary.dailyPercent;
  const barColor =
    pct >= 90 ? 'var(--color-error)' :
    pct >= 70 ? 'var(--color-warning)' :
    'var(--color-success)';

  return (
    <div className="flex items-center gap-2 text-xs">
      {summary.hasRateLimit ? (
        <>
          {/* Progress bar */}
          <div
            className="h-1.5 w-16 overflow-hidden rounded-full"
            style={{ backgroundColor: 'var(--color-surface)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(pct, 100)}%`,
                backgroundColor: barColor,
              }}
            />
          </div>
          <span style={{ color: 'var(--color-text-muted)' }}>
            {formatTokens(summary.dailyInputTokens + summary.dailyOutputTokens)}
            {summary.dailyLimit > 0 && ` / ${formatTokens(summary.dailyLimit)}`}
          </span>
          <span style={{ color: barColor, fontWeight: 500 }}>
            {Math.round(pct)}%
          </span>
        </>
      ) : (
        <span style={{ color: 'var(--color-text-muted)' }}>
          {formatTokens(summary.totalTokens)} tokens total
        </span>
      )}
    </div>
  );
}
