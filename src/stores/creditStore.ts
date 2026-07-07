import { create } from 'zustand';
import { bridge } from '../lib/tauri-bridge';

export interface CreditSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  sessionCount: number;
  dailyInputTokens: number;
  dailyOutputTokens: number;
  dailyLimit: number;
  dailyPercent: number;
  hasRateLimit: boolean;
}

export interface CreditAlert {
  level: 'warn' | 'critical';
  message: string;
  percent: number;
}

interface CreditState {
  summary: CreditSummary;
  alerts: CreditAlert[];
  isLoading: boolean;

  fetchSummary: () => Promise<void>;
  /** Called by stream processor on rate_limit/result events */
  updateFromStream: (inputTokens?: number, outputTokens?: number) => void;
  dismissAlert: (index: number) => void;
}

const EMPTY_SUMMARY: CreditSummary = {
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalTokens: 0,
  sessionCount: 0,
  dailyInputTokens: 0,
  dailyOutputTokens: 0,
  dailyLimit: 0,
  dailyPercent: 0,
  hasRateLimit: false,
};

const WARN_THRESHOLD = 70;
const CRITICAL_THRESHOLD = 90;

export const useCreditStore = create<CreditState>()((set, get) => ({
  summary: EMPTY_SUMMARY,
  alerts: [],
  isLoading: false,

  fetchSummary: async () => {
    try {
      const summary = await bridge.getCreditSummary();
      set({ summary, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  updateFromStream: (inputTokens = 0, outputTokens = 0) => {
    const prev = get().summary;
    const dailyIn = prev.dailyInputTokens + inputTokens;
    const dailyOut = prev.dailyOutputTokens + outputTokens;
    const dailyTotal = dailyIn + dailyOut;
    const dailyPercent = prev.dailyLimit > 0 ? (dailyTotal / prev.dailyLimit) * 100 : 0;

    const summary: CreditSummary = {
      totalInputTokens: prev.totalInputTokens + inputTokens,
      totalOutputTokens: prev.totalOutputTokens + outputTokens,
      totalTokens: prev.totalTokens + inputTokens + outputTokens,
      sessionCount: prev.sessionCount,
      dailyInputTokens: dailyIn,
      dailyOutputTokens: dailyOut,
      dailyLimit: prev.dailyLimit,
      dailyPercent,
      hasRateLimit: prev.hasRateLimit,
    };

    const alerts = [...get().alerts];
    if (dailyPercent >= CRITICAL_THRESHOLD && !alerts.some((a) => a.level === 'critical')) {
      alerts.push({
        level: 'critical',
        message: `Daily tokens at ${Math.round(dailyPercent)}%`,
        percent: dailyPercent,
      });
    } else if (dailyPercent >= WARN_THRESHOLD && !alerts.some((a) => a.level === 'warn')) {
      alerts.push({
        level: 'warn',
        message: `Daily tokens at ${Math.round(dailyPercent)}%`,
        percent: dailyPercent,
      });
    }

    set({ summary, alerts });
  },

  dismissAlert: (index) => {
    const alerts = get().alerts.filter((_, i) => i !== index);
    set({ alerts });
  },
}));
