import { logger } from "../../utils/logger";
import type { BacktestConfig, ConfidenceBucket, SignalResult } from "./types";

/**
 * Calibrate confidence scores based on historical performance
 */
export const calibrateConfidence = (
  signals: SignalResult[],
  config: BacktestConfig,
  timeframe: "1h" | "4h" | "24h",
): ConfidenceBucket[] => {
  logger.info("Starting confidence calibration", {
    totalSignals: signals.length,
    timeframe,
    buckets: config.confidenceBuckets.length,
  });

  const calibrationResults: ConfidenceBucket[] = [];

  for (const bucket of config.confidenceBuckets) {
    const bucketSignals = signals.filter((signal) => {
      return signal.confidence >= bucket.min && signal.confidence <= bucket.max;
    });

    if (bucketSignals.length === 0) {
      logger.warn("No signals found for confidence bucket", bucket);
      calibrationResults.push({
        minConfidence: bucket.min,
        maxConfidence: bucket.max,
        predictedWinRate: (bucket.min + bucket.max) / 2, // Average as predicted
        actualWinRate: 0,
        sampleSize: 0,
        calibrationError: 0,
      });
      continue;
    }

    // Calculate actual win rate for this confidence bucket
    const actualWinRate = calculateWinRateForTimeframe(bucketSignals, timeframe);
    const predictedWinRate = (bucket.min + bucket.max) / 2; // Use average as predicted
    const calibrationError = Math.abs(predictedWinRate - actualWinRate);

    calibrationResults.push({
      minConfidence: bucket.min,
      maxConfidence: bucket.max,
      predictedWinRate,
      actualWinRate,
      sampleSize: bucketSignals.length,
      calibrationError,
    });

    logger.info("Confidence bucket analysis", {
      bucket,
      actualWinRate: (actualWinRate * 100).toFixed(1),
      predictedWinRate: (predictedWinRate * 100).toFixed(1),
      calibrationError: (calibrationError * 100).toFixed(1),
      sampleSize: bucketSignals.length,
    });
  }

  return calibrationResults;
};

/**
 * Calculate optimal confidence threshold based on backtest results
 */
export const calculateOptimalConfidenceThreshold = (
  signals: SignalResult[],
  timeframe: "1h" | "4h" | "24h",
  targetWinRate: number = 0.7,
  minSampleSize: number = 30,
): { threshold: number; actualWinRate: number; sampleSize: number } => {
  // Test different confidence thresholds from high to low to prefer higher thresholds
  const thresholds = Array.from({ length: 10 }, (_, i) => 0.95 - i * 0.05);
  let bestThreshold = 0.7;
  let bestWinRate = 0;
  let bestSampleSize = 0;
  let foundOptimal = false;

  for (const threshold of thresholds) {
    const filteredSignals = signals.filter((signal) => signal.confidence >= threshold);

    if (filteredSignals.length < minSampleSize) continue; // Need minimum sample size

    const winRate = calculateWinRateForTimeframe(filteredSignals, timeframe);

    // Find highest threshold that meets target win rate
    if (!foundOptimal && winRate >= targetWinRate && filteredSignals.length >= minSampleSize) {
      foundOptimal = true;
      logger.info("Optimal confidence threshold calculated", {
        threshold,
        actualWinRate: (winRate * 100).toFixed(1),
        sampleSize: filteredSignals.length,
        targetWinRate: (targetWinRate * 100).toFixed(1),
      });

      return {
        threshold,
        actualWinRate: winRate,
        sampleSize: filteredSignals.length,
      };
    }

    // Keep track of best option even if target not met
    if (winRate > bestWinRate || (winRate === bestWinRate && threshold > bestThreshold)) {
      bestThreshold = threshold;
      bestWinRate = winRate;
      bestSampleSize = filteredSignals.length;
    }
  }

  logger.info("Optimal confidence threshold calculated", {
    threshold: bestThreshold,
    actualWinRate: (bestWinRate * 100).toFixed(1),
    sampleSize: bestSampleSize,
    targetWinRate: (targetWinRate * 100).toFixed(1),
  });

  return {
    threshold: bestThreshold,
    actualWinRate: bestWinRate,
    sampleSize: bestSampleSize,
  };
};

/**
 * Generate recommendations based on confidence calibration results
 */
export const generateCalibrationRecommendations = (
  calibrationResults: ConfidenceBucket[],
  optimalThreshold: { threshold: number; actualWinRate: number; sampleSize: number },
): string[] => {
  const recommendations: string[] = [];

  // Check for overall calibration quality
  const avgCalibrationError =
    calibrationResults.reduce((sum, bucket) => sum + bucket.calibrationError, 0) / calibrationResults.length;

  if (avgCalibrationError > 0.1) {
    recommendations.push(
      `High calibration error (${(avgCalibrationError * 100).toFixed(1)}%) - consider retraining confidence model`,
    );
  }

  // Check for sufficient sample sizes
  const MIN_SAMPLE_SIZE_FOR_WARNING = 20;
  const lowSampleBuckets = calibrationResults.filter((bucket) => bucket.sampleSize < MIN_SAMPLE_SIZE_FOR_WARNING);

  if (lowSampleBuckets.length > 0) {
    recommendations.push(
      `${lowSampleBuckets.length} confidence buckets have insufficient samples (<20) - collect more data`,
    );
  }

  // Check for confidence threshold optimization
  if (optimalThreshold.actualWinRate < 0.65) {
    recommendations.push("Consider lowering confidence threshold to increase signal frequency");
  } else if (optimalThreshold.actualWinRate > 0.85) {
    recommendations.push("Consider raising confidence threshold to improve signal quality");
  }

  // Check for overconfident vs underconfident patterns
  const overconfidentBuckets = calibrationResults.filter(
    (bucket) => bucket.sampleSize > 10 && bucket.predictedWinRate > bucket.actualWinRate + 0.05,
  );
  const underconfidentBuckets = calibrationResults.filter(
    (bucket) => bucket.sampleSize > 10 && bucket.actualWinRate > bucket.predictedWinRate + 0.05,
  );

  if (overconfidentBuckets.length > underconfidentBuckets.length) {
    recommendations.push("Model tends to be overconfident - consider lowering confidence scores");
  } else if (underconfidentBuckets.length > overconfidentBuckets.length) {
    recommendations.push("Model tends to be underconfident - consider raising confidence scores");
  }

  return recommendations;
};

/**
 * Calculate win rate for specific timeframe
 */
const calculateWinRateForTimeframe = (signals: SignalResult[], timeframe: "1h" | "4h" | "24h"): number => {
  const validSignals = signals.filter((signal) => {
    switch (timeframe) {
      case "1h":
        return signal.isWin1h !== null;
      case "4h":
        return signal.isWin4h !== null;
      case "24h":
        return signal.isWin24h !== null;
      default:
        return false;
    }
  });

  if (validSignals.length === 0) return 0;

  const wins = validSignals.filter((signal) => {
    switch (timeframe) {
      case "1h":
        return signal.isWin1h === true;
      case "4h":
        return signal.isWin4h === true;
      case "24h":
        return signal.isWin24h === true;
      default:
        return false;
    }
  });

  return wins.length / validSignals.length;
};

/**
 * Create default confidence buckets if not provided
 */
export const createDefaultConfidenceBuckets = (): Array<{ min: number; max: number }> => {
  return [
    { min: 0.5, max: 0.6 },
    { min: 0.6, max: 0.7 },
    { min: 0.7, max: 0.8 },
    { min: 0.8, max: 0.9 },
    { min: 0.9, max: 1.0 },
  ];
};
