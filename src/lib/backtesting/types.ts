/**
 * Backtesting types for signal performance analysis
 */

export interface SignalResult {
  signalId: string;
  tokenAddress: string;
  direction: "BUY" | "SELL" | "NEUTRAL";
  confidence: number;
  signalType: string;
  timestamp: Date;
  entryPrice: number;
  exitPrice1h: number | null;
  exitPrice4h: number | null;
  exitPrice24h: number | null;
  return1h: number | null;
  return4h: number | null;
  return24h: number | null;
  isWin1h: boolean | null;
  isWin4h: boolean | null;
  isWin24h: boolean | null;
}

export interface BacktestMetrics {
  winRate: number; // Win rate (0.0-1.0)
  avgReturn: number; // Average return (%)
  avgLoss: number; // Average loss (%)
  riskRewardRatio: number; // Risk/reward ratio
  sampleSize: number; // Number of signals
  sharpeRatio: number; // Sharpe ratio
  maxDrawdown: number; // Maximum drawdown (%)
  confidenceInterval: [number, number]; // 95% confidence interval for win rate
  totalReturn: number; // Cumulative return (%)
}

export interface SignalTypeMetrics {
  signalType: string;
  direction: "BUY" | "SELL" | "NEUTRAL";
  timeframe: "1h" | "4h" | "24h";
  metrics: BacktestMetrics;
}

export interface ConfidenceBucket {
  minConfidence: number;
  maxConfidence: number;
  predictedWinRate: number;
  actualWinRate: number;
  sampleSize: number;
  calibrationError: number; // |predicted - actual|
}

export interface BacktestConfig {
  lookbackDays: number;
  minSampleSize: number;
  confidenceBuckets: Array<{ min: number; max: number }>;
  timeframes: Array<"1h" | "4h" | "24h">;
  winThreshold: number; // Minimum gain to consider a "win" (e.g., 0.02 for 2%)
}

export interface BacktestReport {
  generatedAt: Date;
  config: BacktestConfig;
  overallMetrics: {
    "1h": BacktestMetrics;
    "4h": BacktestMetrics;
    "24h": BacktestMetrics;
  };
  signalTypeMetrics: SignalTypeMetrics[];
  confidenceCalibration: ConfidenceBucket[];
  recommendations: {
    optimalConfidenceThreshold: number;
    bestPerformingSignalTypes: string[];
    suggestedImprovements: string[];
  };
}
