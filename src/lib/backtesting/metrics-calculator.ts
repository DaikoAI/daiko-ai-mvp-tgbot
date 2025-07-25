import { logger } from "../../utils/logger";
import type { BacktestMetrics, SignalResult } from "./types";

/**
 * Calculate comprehensive backtesting metrics for a set of signal results
 */
export const calculateBacktestMetrics = (signals: SignalResult[], timeframe: "1h" | "4h" | "24h"): BacktestMetrics => {
  if (signals.length === 0) {
    return createEmptyMetrics();
  }

  // Extract returns and wins for the specified timeframe
  const { returns, wins, losses } = extractTimeframeData(signals, timeframe);

  if (returns.length === 0) {
    logger.warn("No valid returns found for metrics calculation", { timeframe, totalSignals: signals.length });
    return createEmptyMetrics();
  }

  // Calculate basic metrics
  const winRate = wins.length / returns.length;
  const avgReturn = wins.length > 0 ? wins.reduce((sum, r) => sum + r, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, r) => sum + r, 0) / losses.length) : 0;
  const riskRewardRatio = avgLoss > 0 ? avgReturn / avgLoss : avgReturn > 0 ? Number.POSITIVE_INFINITY : 0;

  // Calculate advanced metrics
  const sharpeRatio = calculateSharpeRatio(returns);
  const maxDrawdown = calculateMaxDrawdown(returns);
  const confidenceInterval = calculateConfidenceInterval(winRate, returns.length);
  const totalReturn = calculateTotalReturn(returns);

  return {
    winRate,
    avgReturn,
    avgLoss,
    riskRewardRatio,
    sampleSize: returns.length,
    sharpeRatio,
    maxDrawdown,
    confidenceInterval,
    totalReturn,
  };
};

/**
 * Calculate metrics for specific signal types
 */
export const calculateSignalTypeMetrics = (
  signals: SignalResult[],
  signalType: string,
  direction: "BUY" | "SELL" | "NEUTRAL",
  timeframes: Array<"1h" | "4h" | "24h">,
) => {
  const filteredSignals = signals.filter((s) => s.signalType === signalType && s.direction === direction);

  return timeframes.map((timeframe) => ({
    signalType,
    direction,
    timeframe,
    metrics: calculateBacktestMetrics(filteredSignals, timeframe),
  }));
};

/**
 * Extract returns and categorize wins/losses for a specific timeframe
 */
const extractTimeframeData = (signals: SignalResult[], timeframe: "1h" | "4h" | "24h") => {
  const returns: number[] = [];
  const wins: number[] = [];
  const losses: number[] = [];

  signals.forEach((signal) => {
    let returnValue: number | null = null;
    let isWin: boolean | null = null;

    switch (timeframe) {
      case "1h":
        returnValue = signal.return1h;
        isWin = signal.isWin1h;
        break;
      case "4h":
        returnValue = signal.return4h;
        isWin = signal.isWin4h;
        break;
      case "24h":
        returnValue = signal.return24h;
        isWin = signal.isWin24h;
        break;
    }

    if (returnValue !== null && isWin !== null) {
      returns.push(returnValue);
      if (isWin) {
        wins.push(returnValue);
      } else {
        losses.push(returnValue);
      }
    }
  });

  return { returns, wins, losses };
};

/**
 * Calculate Sharpe ratio (assuming risk-free rate of 0)
 */
const calculateSharpeRatio = (returns: number[]): number => {
  if (returns.length < 2) return 0;

  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);

  return stdDev > 0 ? meanReturn / stdDev : 0;
};

/**
 * Calculate maximum drawdown
 */
const calculateMaxDrawdown = (returns: number[]): number => {
  if (returns.length === 0) return 0;

  let cumulativeReturn = 1;
  let peak = 1;
  let maxDrawdown = 0;

  for (const returnValue of returns) {
    cumulativeReturn *= 1 + returnValue;
    peak = Math.max(peak, cumulativeReturn);
    const drawdown = (peak - cumulativeReturn) / peak;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  return maxDrawdown;
};

/**
 * Calculate 95% confidence interval for win rate
 */
const calculateConfidenceInterval = (winRate: number, sampleSize: number): [number, number] => {
  if (sampleSize === 0) return [0, 0];

  // Wilson score interval for binomial proportion
  const z = 1.96; // 95% confidence
  const n = sampleSize;
  const p = winRate;

  const denominator = 1 + (z * z) / n;
  const center = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);

  const lower = Math.max(0, (center - margin) / denominator);
  const upper = Math.min(1, (center + margin) / denominator);

  return [lower, upper];
};

/**
 * Calculate total cumulative return
 */
const calculateTotalReturn = (returns: number[]): number => {
  return returns.reduce((cumulative, returnValue) => cumulative * (1 + returnValue), 1) - 1;
};

/**
 * Create empty metrics object for edge cases
 */
const createEmptyMetrics = (): BacktestMetrics => ({
  winRate: 0,
  avgReturn: 0,
  avgLoss: 0,
  riskRewardRatio: 0,
  sampleSize: 0,
  sharpeRatio: 0,
  maxDrawdown: 0,
  confidenceInterval: [0, 0],
  totalReturn: 0,
});

/**
 * Validate metrics for statistical significance
 */
export const validateMetricsSignificance = (
  metrics: BacktestMetrics,
  minSampleSize: number = 30,
): { isSignificant: boolean; warnings: string[] } => {
  const warnings: string[] = [];
  let isSignificant = true;

  if (metrics.sampleSize < minSampleSize) {
    warnings.push(`Sample size (${metrics.sampleSize}) is below recommended minimum (${minSampleSize})`);
    isSignificant = false;
  }

  const confidenceRange = metrics.confidenceInterval[1] - metrics.confidenceInterval[0];
  if (confidenceRange > 0.2) {
    warnings.push(`Wide confidence interval (±${((confidenceRange / 2) * 100).toFixed(1)}%) indicates low precision`);
  }

  if (metrics.winRate < 0.1) {
    warnings.push("Extremely low win rate may indicate systematic issues");
  }

  if (metrics.winRate > 0.9) {
    warnings.push("Extremely high win rate may indicate data leakage or overfitting");
  }

  return { isSignificant, warnings };
};
