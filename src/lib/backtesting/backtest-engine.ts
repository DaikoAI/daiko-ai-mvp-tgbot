import { logger } from "../../utils/logger";
import {
  calculateOptimalConfidenceThreshold,
  calibrateConfidence,
  createDefaultConfidenceBuckets,
  generateCalibrationRecommendations,
} from "./confidence-calibrator";
import { collectSignalPerformanceData, filterSignalsByTimeframe } from "./data-collector";
import {
  calculateBacktestMetrics,
  calculateSignalTypeMetrics,
  validateMetricsSignificance,
} from "./metrics-calculator";
import type { BacktestConfig, BacktestReport, SignalResult } from "./types";

/**
 * Main backtesting engine that orchestrates the entire backtesting process
 */
export class BacktestEngine {
  private config: BacktestConfig;

  constructor(config?: Partial<BacktestConfig>) {
    this.config = {
      lookbackDays: 30,
      minSampleSize: 20,
      confidenceBuckets: createDefaultConfidenceBuckets(),
      timeframes: ["1h", "4h", "24h"],
      winThreshold: 0.02, // 2% minimum gain to consider a win
      ...config,
    };

    logger.info("BacktestEngine initialized", this.config);
  }

  /**
   * Run comprehensive backtest analysis
   */
  async runBacktest(): Promise<BacktestReport> {
    logger.info("Starting comprehensive backtest analysis");
    const startTime = Date.now();

    try {
      // Step 1: Collect historical signal performance data
      const signalResults = await collectSignalPerformanceData(this.config);

      if (signalResults.length === 0) {
        throw new Error("No signal data found for backtesting");
      }

      logger.info(`Collected ${signalResults.length} signal results for analysis`);

      // Step 2: Calculate overall metrics for each timeframe
      const overallMetrics = this.calculateOverallMetrics(signalResults);

      // Step 3: Calculate signal type specific metrics
      const signalTypeMetrics = this.calculateSignalTypeSpecificMetrics(signalResults);

      // Step 4: Calibrate confidence scores
      const confidenceCalibration = this.performConfidenceCalibration(signalResults);

      // Step 5: Generate recommendations
      const recommendations = this.generateRecommendations(
        overallMetrics,
        signalTypeMetrics,
        confidenceCalibration,
        signalResults,
      );

      const report: BacktestReport = {
        generatedAt: new Date(),
        config: this.config,
        overallMetrics,
        signalTypeMetrics,
        confidenceCalibration,
        recommendations,
      };

      const duration = Date.now() - startTime;
      logger.info(`Backtest analysis completed in ${duration}ms`, {
        totalSignals: signalResults.length,
        signalTypes: signalTypeMetrics.length,
        duration,
      });

      return report;
    } catch (error) {
      logger.error("Backtest analysis failed", {
        error: error instanceof Error ? error.message : String(error),
        config: this.config,
      });
      throw error;
    }
  }

  /**
   * Quick analysis for specific signal type and timeframe
   */
  async analyzeSignalType(signalType: string, direction: "BUY" | "SELL" | "NEUTRAL", timeframe: "1h" | "4h" | "24h") {
    // Validate timeframe is in config
    if (!this.config.timeframes.includes(timeframe)) {
      throw new Error(`Invalid timeframe: ${timeframe}. Must be one of: ${this.config.timeframes.join(", ")}`);
    }

    const signalResults = await collectSignalPerformanceData(this.config);
    const filteredSignals = signalResults.filter((s) => s.signalType === signalType && s.direction === direction);

    const timeframeSignals = filterSignalsByTimeframe(filteredSignals, timeframe);
    const metrics = calculateBacktestMetrics(timeframeSignals, timeframe);
    const validation = validateMetricsSignificance(metrics, this.config.minSampleSize);

    return {
      signalType,
      direction,
      timeframe,
      metrics,
      validation,
      sampleSignals: timeframeSignals.slice(0, 5), // Sample for debugging
    };
  }

  /**
   * Get the best performing signal types
   */
  async getBestPerformingSignals(timeframe: "1h" | "4h" | "24h" = "4h", minSampleSize: number = 20) {
    const signalResults = await collectSignalPerformanceData(this.config);
    const signalTypeMetrics = this.calculateSignalTypeSpecificMetrics(signalResults);

    return signalTypeMetrics
      .filter((stm) => stm.timeframe === timeframe && stm.metrics.sampleSize >= minSampleSize)
      .sort((a, b) => {
        // Sort by win rate first, then by sample size
        if (Math.abs(a.metrics.winRate - b.metrics.winRate) < 0.05) {
          return b.metrics.sampleSize - a.metrics.sampleSize;
        }
        return b.metrics.winRate - a.metrics.winRate;
      })
      .slice(0, 10);
  }

  /**
   * Calculate overall metrics for all timeframes
   */
  private calculateOverallMetrics(signalResults: SignalResult[]) {
    const overallMetrics: Partial<BacktestReport["overallMetrics"]> = {};

    for (const timeframe of this.config.timeframes) {
      const timeframeSignals = filterSignalsByTimeframe(signalResults, timeframe);
      overallMetrics[timeframe] = calculateBacktestMetrics(timeframeSignals, timeframe);
    }

    return overallMetrics as BacktestReport["overallMetrics"];
  }

  /**
   * Calculate metrics for each signal type and direction combination
   */
  private calculateSignalTypeSpecificMetrics(signalResults: SignalResult[]) {
    // Get unique signal types and directions
    const signalTypes = [...new Set(signalResults.map((s) => s.signalType))];
    const directions: Array<"BUY" | "SELL" | "NEUTRAL"> = ["BUY", "SELL", "NEUTRAL"];

    const allMetrics = [];

    for (const signalType of signalTypes) {
      for (const direction of directions) {
        const typeMetrics = calculateSignalTypeMetrics(signalResults, signalType, direction, this.config.timeframes);

        // Only include combinations with sufficient data
        const validMetrics = typeMetrics.filter((tm) => tm.metrics.sampleSize >= this.config.minSampleSize);
        allMetrics.push(...validMetrics);
      }
    }

    return allMetrics;
  }

  /**
   * Perform confidence calibration analysis
   */
  private performConfidenceCalibration(signalResults: SignalResult[]) {
    // Use 4h timeframe as primary for confidence calibration
    const primaryTimeframe: "4h" = "4h";
    return calibrateConfidence(signalResults, this.config, primaryTimeframe);
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    overallMetrics: BacktestReport["overallMetrics"],
    signalTypeMetrics: BacktestReport["signalTypeMetrics"],
    confidenceCalibration: BacktestReport["confidenceCalibration"],
    signalResults: SignalResult[],
  ): BacktestReport["recommendations"] {
    // Calculate optimal confidence threshold
    const optimalThreshold = calculateOptimalConfidenceThreshold(signalResults, "4h", 0.7);

    // Get calibration recommendations
    const calibrationRecommendations = generateCalibrationRecommendations(confidenceCalibration, optimalThreshold);

    // Find best performing signal types
    const bestSignalTypes = signalTypeMetrics
      .filter((stm) => stm.timeframe === "4h" && stm.metrics.sampleSize >= this.config.minSampleSize)
      .sort((a, b) => b.metrics.winRate - a.metrics.winRate)
      .slice(0, 3)
      .map((stm) => `${stm.signalType}_${stm.direction}`);

    // Analyze overall performance
    const overallSuggestions: string[] = [];
    const metrics4h = overallMetrics["4h"];

    if (metrics4h.winRate < 0.6) {
      overallSuggestions.push("Overall win rate is below 60% - review signal generation criteria");
    }

    if (metrics4h.riskRewardRatio < 1.5) {
      overallSuggestions.push("Risk/reward ratio is below 1.5 - consider tighter stop losses or higher profit targets");
    }

    if (metrics4h.maxDrawdown > 0.2) {
      overallSuggestions.push("Maximum drawdown exceeds 20% - implement better risk management");
    }

    return {
      optimalConfidenceThreshold: optimalThreshold.threshold,
      bestPerformingSignalTypes: bestSignalTypes,
      suggestedImprovements: [...calibrationRecommendations, ...overallSuggestions],
    };
  }
}

/**
 * Create default backtest configuration
 */
export const createDefaultBacktestConfig = (): BacktestConfig => ({
  lookbackDays: 30,
  minSampleSize: 20,
  confidenceBuckets: createDefaultConfidenceBuckets(),
  timeframes: ["1h", "4h", "24h"],
  winThreshold: 0.02,
});

/**
 * Quick utility function to run a basic backtest
 */
export const runQuickBacktest = async (lookbackDays: number = 30): Promise<BacktestReport> => {
  const engine = new BacktestEngine({ lookbackDays });
  return await engine.runBacktest();
};
