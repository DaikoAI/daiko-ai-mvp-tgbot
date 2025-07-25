import { describe, expect, it } from "bun:test";
import {
  calculateBacktestMetrics,
  validateMetricsSignificance,
} from "../../../../src/lib/backtesting/metrics-calculator";
import type { SignalResult } from "../../../../src/lib/backtesting/types";

describe("Metrics Calculator", () => {
  const createMockSignal = (
    confidence: number,
    return1h: number | null,
    return4h: number | null,
    return24h: number | null,
    winThreshold: number = 0.02,
  ): SignalResult => ({
    signalId: `test-${Math.random()}`,
    tokenAddress: "test-token",
    direction: "BUY",
    confidence,
    signalType: "RSI_OVERSOLD",
    timestamp: new Date(),
    entryPrice: 100,
    exitPrice1h: return1h ? 100 * (1 + return1h) : null,
    exitPrice4h: return4h ? 100 * (1 + return4h) : null,
    exitPrice24h: return24h ? 100 * (1 + return24h) : null,
    return1h,
    return4h,
    return24h,
    isWin1h: return1h !== null ? return1h >= winThreshold : null,
    isWin4h: return4h !== null ? return4h >= winThreshold : null,
    isWin24h: return24h !== null ? return24h >= winThreshold : null,
  });

  describe("calculateBacktestMetrics", () => {
    it("should return empty metrics for no signals", () => {
      const metrics = calculateBacktestMetrics([], "4h");

      expect(metrics.winRate).toBe(0);
      expect(metrics.sampleSize).toBe(0);
      expect(metrics.avgReturn).toBe(0);
      expect(metrics.avgLoss).toBe(0);
    });

    it("should calculate correct win rate", () => {
      const signals = [
        createMockSignal(0.7, null, 0.05, null), // Win (5% > 2% threshold)
        createMockSignal(0.8, null, 0.01, null), // Loss (1% < 2% threshold)
        createMockSignal(0.6, null, 0.03, null), // Win (3% > 2% threshold)
      ];

      const metrics = calculateBacktestMetrics(signals, "4h");

      expect(metrics.winRate).toBeCloseTo(2 / 3); // 2 wins out of 3
      expect(metrics.sampleSize).toBe(3);
    });

    it("should calculate correct average return and loss", () => {
      const signals = [
        createMockSignal(0.7, null, 0.05, null), // +5% win
        createMockSignal(0.8, null, -0.02, null), // -2% loss
        createMockSignal(0.6, null, 0.03, null), // +3% win
      ];

      const metrics = calculateBacktestMetrics(signals, "4h");

      expect(metrics.avgReturn).toBeCloseTo(0.04); // (5% + 3%) / 2 wins
      expect(metrics.avgLoss).toBeCloseTo(0.02); // abs(-2%) / 1 loss
      expect(metrics.riskRewardRatio).toBeCloseTo(2.0); // 4% / 2%
    });

    it("should handle edge case with only wins", () => {
      const signals = [createMockSignal(0.7, null, 0.05, null), createMockSignal(0.8, null, 0.03, null)];

      const metrics = calculateBacktestMetrics(signals, "4h");

      expect(metrics.winRate).toBe(1.0);
      expect(metrics.avgReturn).toBeCloseTo(0.04);
      expect(metrics.avgLoss).toBe(0);
      expect(metrics.riskRewardRatio).toBe(Number.POSITIVE_INFINITY);
    });

    it("should handle edge case with only losses", () => {
      const signals = [createMockSignal(0.7, null, -0.02, null), createMockSignal(0.8, null, -0.01, null)];

      const metrics = calculateBacktestMetrics(signals, "4h");

      expect(metrics.winRate).toBe(0);
      expect(metrics.avgReturn).toBe(0);
      expect(metrics.avgLoss).toBeCloseTo(0.015); // (2% + 1%) / 2
      expect(metrics.riskRewardRatio).toBe(0);
    });

    it("should calculate Sharpe ratio correctly", () => {
      const signals = [
        createMockSignal(0.7, null, 0.05, null),
        createMockSignal(0.8, null, -0.02, null),
        createMockSignal(0.6, null, 0.03, null),
        createMockSignal(0.9, null, 0.01, null),
      ];

      const metrics = calculateBacktestMetrics(signals, "4h");

      expect(metrics.sharpeRatio).toBeGreaterThan(0);
      expect(metrics.sharpeRatio).toBeLessThan(10); // Reasonable range
    });

    it("should calculate maximum drawdown", () => {
      // Sequence: +10%, -15%, +5%, -8%
      // Cumulative: 1.1, 0.935, 0.98175, 0.90321
      // Peak tracking: 1.1, 1.1, 1.1, 1.1
      // Drawdowns: 0%, 15%, 10.75%, 17.9%
      const signals = [
        createMockSignal(0.7, null, 0.1, null), // +10%
        createMockSignal(0.8, null, -0.15, null), // -15%
        createMockSignal(0.6, null, 0.05, null), // +5%
        createMockSignal(0.9, null, -0.08, null), // -8%
      ];

      const metrics = calculateBacktestMetrics(signals, "4h");

      expect(metrics.maxDrawdown).toBeGreaterThan(0.15); // Should be close to 17.9%
      expect(metrics.maxDrawdown).toBeLessThan(0.25);
    });

    it("should calculate confidence interval", () => {
      const signals = Array.from(
        { length: 100 },
        (_, i) => createMockSignal(0.7, null, i < 70 ? 0.05 : -0.02, null), // 70% win rate
      );

      const metrics = calculateBacktestMetrics(signals, "4h");

      expect(metrics.confidenceInterval[0]).toBeGreaterThan(0.6); // Lower bound
      expect(metrics.confidenceInterval[1]).toBeLessThan(0.8); // Upper bound
      expect(metrics.winRate).toBeCloseTo(0.7);
    });

    it("should filter signals by timeframe correctly", () => {
      const signals = [
        createMockSignal(0.7, 0.05, null, 0.03), // Only 1h and 24h data
        createMockSignal(0.8, null, 0.02, null), // Only 4h data
      ];

      const metrics1h = calculateBacktestMetrics(signals, "1h");
      const metrics4h = calculateBacktestMetrics(signals, "4h");
      const metrics24h = calculateBacktestMetrics(signals, "24h");

      expect(metrics1h.sampleSize).toBe(1);
      expect(metrics4h.sampleSize).toBe(1);
      expect(metrics24h.sampleSize).toBe(1);
    });
  });

  describe("validateMetricsSignificance", () => {
    it("should identify insufficient sample size", () => {
      const metrics = calculateBacktestMetrics([createMockSignal(0.7, null, 0.05, null)], "4h");

      const validation = validateMetricsSignificance(metrics, 30);

      expect(validation.isSignificant).toBe(false);
      expect(validation.warnings.some((w) => w.includes("Sample size (1) is below recommended minimum (30)"))).toBe(
        true,
      );
    });

    it("should identify wide confidence intervals", () => {
      // Create small sample with high variance
      const signals = [
        createMockSignal(0.7, null, 0.05, null),
        createMockSignal(0.8, null, -0.05, null),
        createMockSignal(0.6, null, 0.03, null),
      ];

      const metrics = calculateBacktestMetrics(signals, "4h");
      const validation = validateMetricsSignificance(metrics, 3);

      expect(validation.warnings.some((w) => w.includes("confidence interval"))).toBe(true);
    });

    it("should identify extremely low win rates", () => {
      const signals = Array.from(
        { length: 50 },
        () => createMockSignal(0.7, null, -0.05, null), // All losses
      );

      const metrics = calculateBacktestMetrics(signals, "4h");
      const validation = validateMetricsSignificance(metrics, 30);

      expect(validation.warnings.some((w) => w.includes("low win rate"))).toBe(true);
    });

    it("should identify extremely high win rates", () => {
      const signals = Array.from(
        { length: 50 },
        () => createMockSignal(0.7, null, 0.05, null), // All wins
      );

      const metrics = calculateBacktestMetrics(signals, "4h");
      const validation = validateMetricsSignificance(metrics, 30);

      expect(validation.warnings.some((w) => w.includes("high win rate"))).toBe(true);
    });

    it("should pass validation for good metrics", () => {
      const signals = Array.from(
        { length: 50 },
        (_, i) => createMockSignal(0.7, null, i < 35 ? 0.05 : -0.02, null), // 70% win rate
      );

      const metrics = calculateBacktestMetrics(signals, "4h");
      const validation = validateMetricsSignificance(metrics, 30);

      expect(validation.isSignificant).toBe(true);
      expect(validation.warnings.length).toBeLessThanOrEqual(1); // May have confidence interval warning
    });
  });
});
