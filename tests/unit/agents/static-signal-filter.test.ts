import { describe, expect, it } from "vitest";
import { SIGNAL_THRESHOLDS } from "../../../src/constants/signal-thresholds";
import type { TechnicalAnalysis } from "../../../src/db/schema/technical-analysis";
import { applyStaticSignalFilter } from "../../../src/lib/static-signal-filter";

describe("Static Signal Filter", () => {
  const baseAnalysis: TechnicalAnalysis = {
    id: "1",
    token: "test-token",
    timestamp: 1716153600,
    vwap: "100",
    vwap_deviation: "0",
    obv: "100",
    rsi: "50",
    percent_b: "0.5",
    adx: "0",
    atr_percent: "0",
    obv_zscore: "0",
    bb_width: "0",
    atr: "0",
    adx_direction: "0",
    signalGenerated: false,
    createdAt: new Date(),
  };

  describe("RSI Indicator Tests", () => {
    it("should trigger RSI_CRITICAL_OVERSOLD when RSI <= 20", () => {
      const analysis = { ...baseAnalysis, rsi: "15" };
      const result = applyStaticSignalFilter("test", analysis);

      expect(result.triggeredIndicators).toContain("RSI_CRITICAL_OVERSOLD");
      expect(result.signalCandidates).toContain("RSI_OVERSOLD");
      expect(result.confluenceScore).toBeGreaterThan(0);
    });

    it("should trigger RSI_OVERSOLD when RSI <= 25 but > 20", () => {
      const analysis = { ...baseAnalysis, rsi: "24" };
      const result = applyStaticSignalFilter("test", analysis);

      expect(result.triggeredIndicators).toContain("RSI_OVERSOLD");
      expect(result.signalCandidates).toContain("RSI_OVERSOLD");
    });

    it("should trigger RSI_CRITICAL_OVERBOUGHT when RSI >= 80", () => {
      const analysis = { ...baseAnalysis, rsi: "85" };
      const result = applyStaticSignalFilter("test", analysis);

      expect(result.triggeredIndicators).toContain("RSI_CRITICAL_OVERBOUGHT");
      expect(result.signalCandidates).toContain("RSI_OVERBOUGHT");
    });

    it("should trigger RSI_OVERBOUGHT when RSI >= 75 but < 80", () => {
      const analysis = { ...baseAnalysis, rsi: "77" };
      const result = applyStaticSignalFilter("test", analysis);

      expect(result.triggeredIndicators).toContain("RSI_OVERBOUGHT");
      expect(result.signalCandidates).toContain("RSI_OVERBOUGHT");
    });

    it("should not trigger RSI indicators for neutral values", () => {
      const analysis = { ...baseAnalysis, rsi: "50" };
      const result = applyStaticSignalFilter("test", analysis);

      expect(result.triggeredIndicators).not.toContain("RSI_OVERSOLD");
      expect(result.triggeredIndicators).not.toContain("RSI_OVERBOUGHT");
      expect(result.triggeredIndicators).not.toContain("RSI_CRITICAL_OVERSOLD");
      expect(result.triggeredIndicators).not.toContain("RSI_CRITICAL_OVERBOUGHT");
    });
  });

  describe("VWAP Deviation Tests", () => {
    it("should trigger VWAP_EXTREME_DEVIATION for >= 4% deviation", () => {
      const analysis = { ...baseAnalysis, vwap_deviation: "4.5" };
      const result = applyStaticSignalFilter("test", analysis);

      expect(result.triggeredIndicators).toContain("VWAP_EXTREME_DEVIATION");
      expect(result.signalCandidates).toContain("VWAP_DEVIATION_HIGH");
    });

    it("should trigger VWAP_SIGNIFICANT_DEVIATION for >= 3% but < 4% deviation", () => {
      const analysis = { ...baseAnalysis, vwap_deviation: "3.2" };
      const result = applyStaticSignalFilter("test", analysis);

      expect(result.triggeredIndicators).toContain("VWAP_SIGNIFICANT_DEVIATION");
      expect(result.signalCandidates).toContain("VWAP_DEVIATION_HIGH");
    });

    it("should handle negative deviations correctly", () => {
      const analysis = { ...baseAnalysis, vwap_deviation: "-4.5" };
      const result = applyStaticSignalFilter("test", analysis);

      expect(result.triggeredIndicators).toContain("VWAP_EXTREME_DEVIATION");
      expect(result.signalCandidates).toContain("VWAP_DEVIATION_LOW");
    });
  });

  describe("Bollinger Bands Tests", () => {
    it("should trigger BOLLINGER_BREAKOUT_UP for %B > 1.0", () => {
      const analysis = { ...baseAnalysis, percent_b: "1.1" };
      const result = applyStaticSignalFilter("test", analysis);

      expect(result.triggeredIndicators).toContain("BOLLINGER_BREAKOUT_UP");
      expect(result.signalCandidates).toContain("BOLLINGER_BREAKOUT_UP");
    });

    it("should trigger BOLLINGER_BREAKOUT_DOWN for %B < 0.0", () => {
      const analysis = { ...baseAnalysis, percent_b: "-0.1" };
      const result = applyStaticSignalFilter("test", analysis);

      expect(result.triggeredIndicators).toContain("BOLLINGER_BREAKOUT_DOWN");
      expect(result.signalCandidates).toContain("BOLLINGER_BREAKOUT_DOWN");
    });

    it("should trigger BOLLINGER_OVERBOUGHT for %B >= 0.9 but <= 1.0", () => {
      const analysis = { ...baseAnalysis, percent_b: "0.95" };
      const result = applyStaticSignalFilter("test", analysis);

      expect(result.triggeredIndicators).toContain("BOLLINGER_OVERBOUGHT");
    });

    it("should trigger BOLLINGER_OVERSOLD for %B <= 0.1 but >= 0.0", () => {
      const analysis = { ...baseAnalysis, percent_b: "0.05" };
      const result = applyStaticSignalFilter("test", analysis);

      expect(result.triggeredIndicators).toContain("BOLLINGER_OVERSOLD");
    });
  });

  describe("ADX Strength Tests", () => {
    it("should trigger ADX_OVERHEATED for ADX >= 50", () => {
      const analysis = { ...baseAnalysis, adx: "60" };
      const result = applyStaticSignalFilter("test", analysis);

      expect(result.triggeredIndicators).toContain("ADX_OVERHEATED");
    });

    it("should trigger ADX_STRONG_TREND for ADX >= 40 but < 50", () => {
      const analysis = { ...baseAnalysis, adx: "45" };
      const result = applyStaticSignalFilter("test", analysis);

      expect(result.triggeredIndicators).toContain("ADX_STRONG_TREND");
    });
  });

  describe("ATR Volatility Tests", () => {
    it("should trigger ATR_EXTREME_VOLATILITY for ATR% >= 8%", () => {
      const analysis = { ...baseAnalysis, atr_percent: "8.5" };
      const result = applyStaticSignalFilter("test", analysis);

      expect(result.triggeredIndicators).toContain("ATR_EXTREME_VOLATILITY");
      expect(result.signalCandidates).toContain("HIGH_VOLATILITY");
    });

    it("should trigger ATR_HIGH_VOLATILITY for ATR% >= 5% but < 8%", () => {
      const analysis = { ...baseAnalysis, atr_percent: "6.0" };
      const result = applyStaticSignalFilter("test", analysis);

      expect(result.triggeredIndicators).toContain("ATR_HIGH_VOLATILITY");
    });
  });

  describe("OBV Z-Score Tests", () => {
    it("should trigger OBV_EXTREME_DIVERGENCE for |Z-Score| >= 4", () => {
      const analysis = { ...baseAnalysis, obv_zscore: "4.2" };
      const result = applyStaticSignalFilter("test", analysis);

      expect(result.triggeredIndicators).toContain("OBV_EXTREME_DIVERGENCE");
      expect(result.signalCandidates).toContain("VOLUME_SPIKE");
    });

    it("should trigger OBV_STRONG_DIVERGENCE for |Z-Score| >= 3 but < 4", () => {
      const analysis = { ...baseAnalysis, obv_zscore: "3.5" };
      const result = applyStaticSignalFilter("test", analysis);

      expect(result.triggeredIndicators).toContain("OBV_STRONG_DIVERGENCE");
    });

    it("should handle negative Z-scores correctly", () => {
      const analysis = { ...baseAnalysis, obv_zscore: "-4.2" };
      const result = applyStaticSignalFilter("test", analysis);

      expect(result.triggeredIndicators).toContain("OBV_EXTREME_DIVERGENCE");
      expect(result.signalCandidates).toContain("VOLUME_SPIKE");
    });
  });

  describe("Confluence and Risk Level Tests", () => {
    it("should require minimum confluence to proceed", () => {
      // Single indicator with lower confluence score - should not proceed
      const singleIndicator = { ...baseAnalysis, rsi: "22" }; // RSI_OVERSOLD = 0.15 confluence
      const result = applyStaticSignalFilter("test", singleIndicator);

      expect(result.shouldProceed).toBe(false);
      expect(result.triggeredIndicators).toHaveLength(1);
      expect(result.confluenceScore).toBeLessThan(0.2); // 0.15 < 0.2
      expect(result.confluenceScore).toBe(0.15); // Exact expected value
    });

    it("should proceed with sufficient confluence", () => {
      // Multiple indicators - should proceed
      const multipleIndicators = {
        ...baseAnalysis,
        rsi: "20", // Critical oversold
        vwap_deviation: "4.5", // Extreme deviation
      };
      const result = applyStaticSignalFilter("test", multipleIndicators);

      expect(result.shouldProceed).toBe(true);
      expect(result.triggeredIndicators.length).toBeGreaterThanOrEqual(
        SIGNAL_THRESHOLDS.LLM_TRIGGERS.CONFLUENCE_REQUIRED,
      );
      expect(result.confluenceScore).toBeGreaterThanOrEqual(0.2);
    });

    it("should calculate HIGH risk level for confluence >= 0.5", () => {
      const highRiskAnalysis = {
        ...baseAnalysis,
        rsi: "10", // Critical oversold: +0.25
        vwap_deviation: "5.0", // Extreme deviation: +0.3
        percent_b: "1.2", // Breakout: +0.2
      };
      const result = applyStaticSignalFilter("test", highRiskAnalysis);

      expect(result.riskLevel).toBe("HIGH");
      expect(result.confluenceScore).toBeGreaterThanOrEqual(0.5);
    });

    it("should calculate MEDIUM risk level for confluence >= 0.3 but < 0.5", () => {
      const mediumRiskAnalysis = {
        ...baseAnalysis,
        rsi: "77", // Overbought: +0.15
        vwap_deviation: "3.5", // Significant: +0.2
      };
      const result = applyStaticSignalFilter("test", mediumRiskAnalysis);

      expect(result.riskLevel).toBe("MEDIUM");
      expect(result.confluenceScore).toBeGreaterThanOrEqual(0.3);
      expect(result.confluenceScore).toBeLessThan(0.5);
    });

    it("should calculate LOW risk level for confluence < 0.3", () => {
      const lowRiskAnalysis = {
        ...baseAnalysis,
        rsi: "24", // Oversold: +0.15
      };
      const result = applyStaticSignalFilter("test", lowRiskAnalysis);

      expect(result.riskLevel).toBe("LOW");
      expect(result.confluenceScore).toBeLessThan(0.3);
    });
  });

  describe("Boundary Value Tests", () => {
    it("should handle exact threshold values correctly", () => {
      const boundaryAnalysis = {
        ...baseAnalysis,
        rsi: "25", // Exactly at oversold threshold
        vwap_deviation: "3.0", // Exactly at significant threshold
        percent_b: "1.0", // Exactly at breakout threshold
        adx: "40", // Exactly at established threshold
        atr_percent: "5.0", // Exactly at high volatility threshold
        obv_zscore: "3.0", // Exactly at strong divergence threshold
      };
      const result = applyStaticSignalFilter("test", boundaryAnalysis);

      expect(result.triggeredIndicators).toContain("RSI_OVERSOLD");
      expect(result.triggeredIndicators).toContain("VWAP_SIGNIFICANT_DEVIATION");
      expect(result.triggeredIndicators).toContain("BOLLINGER_BREAKOUT_UP");
      expect(result.triggeredIndicators).toContain("ADX_STRONG_TREND");
      expect(result.triggeredIndicators).toContain("ATR_HIGH_VOLATILITY");
      expect(result.triggeredIndicators).toContain("OBV_STRONG_DIVERGENCE");
      expect(result.shouldProceed).toBe(true);
    });

    it("should not trigger for values just below thresholds", () => {
      const belowThresholdAnalysis = {
        ...baseAnalysis,
        rsi: "26", // Just above oversold threshold
        vwap_deviation: "2.9", // Just below significant threshold
        percent_b: "0.99", // Just below breakout threshold
      };
      const result = applyStaticSignalFilter("test", belowThresholdAnalysis);

      expect(result.triggeredIndicators).not.toContain("RSI_OVERSOLD");
      expect(result.triggeredIndicators).not.toContain("VWAP_SIGNIFICANT_DEVIATION");
      expect(result.triggeredIndicators).not.toContain("BOLLINGER_BREAKOUT_UP");
      expect(result.shouldProceed).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle null values gracefully", () => {
      const nullAnalysis = {
        ...baseAnalysis,
        rsi: null,
        vwap_deviation: null,
        percent_b: null,
        adx: null,
        atr_percent: null,
        obv_zscore: null,
      };
      const result = applyStaticSignalFilter("test", nullAnalysis);

      expect(result.triggeredIndicators).toHaveLength(0);
      expect(result.shouldProceed).toBe(false);
      expect(result.confluenceScore).toBe(0);
      expect(result.riskLevel).toBe("LOW");
    });

    it("should handle extreme values correctly", () => {
      const extremeAnalysis = {
        ...baseAnalysis,
        rsi: "0", // Extreme oversold
        vwap_deviation: "20.0", // Extreme deviation
        percent_b: "5.0", // Extreme breakout
        adx: "100", // Extreme trend strength
        atr_percent: "50.0", // Extreme volatility
        obv_zscore: "10.0", // Extreme volume divergence
      };
      const result = applyStaticSignalFilter("test", extremeAnalysis);

      expect(result.shouldProceed).toBe(true);
      expect(result.confluenceScore).toBeGreaterThan(1.0);
      expect(result.riskLevel).toBe("HIGH");
      expect(result.triggeredIndicators.length).toBeGreaterThan(5);
    });
  });
});
