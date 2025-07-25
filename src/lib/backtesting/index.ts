/**
 * Backtesting Module
 *
 * Comprehensive backtesting system for trading signal analysis.
 * Provides historical performance analysis, confidence calibration,
 * and actionable insights for signal optimization.
 */

// Main exports
export { BacktestEngine, createDefaultBacktestConfig, runQuickBacktest } from "./backtest-engine";
// Confidence calibration
export {
  calculateOptimalConfidenceThreshold,
  calibrateConfidence,
  createDefaultConfidenceBuckets,
  generateCalibrationRecommendations,
} from "./confidence-calibrator";
// Data collection
export { collectSignalPerformanceData, filterSignalsByTimeframe } from "./data-collector";
// Metrics calculation
export {
  calculateBacktestMetrics,
  calculateSignalTypeMetrics,
  validateMetricsSignificance,
} from "./metrics-calculator";

// Type definitions
export type {
  BacktestConfig,
  BacktestMetrics,
  BacktestReport,
  ConfidenceBucket,
  SignalResult,
  SignalTypeMetrics,
} from "./types";
