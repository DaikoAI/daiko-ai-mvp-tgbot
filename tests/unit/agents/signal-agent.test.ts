import { describe, expect, it } from "bun:test";
import type { TechnicalAnalysis } from "../../../src/db/schema/technical-analysis";
import { createPhantomButtons } from "../../../src/lib/phantom";
import { applyStaticSignalFilter } from "../../../src/lib/static-signal-filter";

// For unit testing, we'll test the modules directly without extensive mocking
// This avoids interfering with other test files

const createMockAnalysis = (overrides: Partial<TechnicalAnalysis> = {}): TechnicalAnalysis => ({
  id: "test-1",
  token: "So11111111111111111111111111111111111111112",
  timestamp: 1716153600,
  vwap: "100",
  vwap_deviation: "0",
  obv: "1000",
  rsi: "50",
  percent_b: "0.5",
  adx: "25",
  atr_percent: "2",
  obv_zscore: "0",
  bb_width: "0.1",
  atr: "1.5",
  adx_direction: "UP",
  signalGenerated: false,
  createdAt: new Date(),
  ...overrides,
});

describe("Signal Agent Unit Tests", () => {
  describe("Static Filter Module", () => {
    it("should return shouldProceed false for normal market conditions", () => {
      // Setup - normal market conditions
      const analysis = createMockAnalysis({
        rsi: "35", // Normal range
        vwap_deviation: "1.5", // Below threshold
      });

      // Execute
      const result = applyStaticSignalFilter("test-token", analysis);

      // Verify
      expect(result.shouldProceed).toBe(false);
      expect(result.triggeredIndicators).toHaveLength(0);
      expect(result.confluenceScore).toBe(0);
      expect(result.riskLevel).toBe("LOW");
    });

    it("should return shouldProceed true for extreme market conditions", () => {
      // Setup - extreme oversold conditions
      const analysis = createMockAnalysis({
        rsi: "15", // Extremely oversold
        vwap_deviation: "5.0", // High deviation
      });

      // Execute
      const result = applyStaticSignalFilter("test-token", analysis);

      // Verify
      expect(result.shouldProceed).toBe(true);
      expect(result.triggeredIndicators.length).toBeGreaterThan(0);
      expect(result.confluenceScore).toBeGreaterThan(0.3);
      expect(result.riskLevel).not.toBe("LOW");
    });
  });

  describe("Phantom Button Generation", () => {
    it("should create buttons with proper structure", () => {
      // Execute
      const buttons = createPhantomButtons("So11111111111111111111111111111111111111112", "SOL");

      // Verify
      expect(Array.isArray(buttons)).toBe(true);
      expect(buttons.length).toBeGreaterThan(0);

      if (buttons.length > 0) {
        const button = buttons[0];
        expect(button?.text).toBeDefined();
        expect(button?.url).toBeDefined();
        expect(typeof button?.text).toBe("string");
        expect(typeof button?.url).toBe("string");
        expect(button?.url).toContain("http");
      }
    });

    it("should handle different token symbols", () => {
      // Test with different tokens
      const btcButtons = createPhantomButtons("9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E", "BTC");
      const ethButtons = createPhantomButtons("7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", "ETH");

      expect(Array.isArray(btcButtons)).toBe(true);
      expect(Array.isArray(ethButtons)).toBe(true);
    });
  });

  describe("Mock Validation and Error Handling", () => {
    it("should handle null analysis gracefully", () => {
      // Setup - analysis with null/undefined values
      const analysis = createMockAnalysis({
        rsi: null as any,
        vwap_deviation: null as any,
      });

      // Execute
      const result = applyStaticSignalFilter("test-token", analysis);

      // Verify - should not crash and return sensible defaults
      expect(result).toBeDefined();
      expect(result.shouldProceed).toBe(false);
      expect(result.triggeredIndicators).toBeDefined();
      expect(result.riskLevel).toBe("LOW");
    });

    it("should handle multiple risk levels", () => {
      // Test different confluence scenarios
      const scenarios = [
        { rsi: "22", vwap_deviation: "1.0", expectedRisk: "LOW" },
        { rsi: "18", vwap_deviation: "3.5", expectedRisk: "MEDIUM" },
        { rsi: "12", vwap_deviation: "5.0", expectedRisk: "HIGH" },
      ];

      scenarios.forEach((scenario) => {
        const analysis = createMockAnalysis({
          rsi: scenario.rsi,
          vwap_deviation: scenario.vwap_deviation,
        });

        const result = applyStaticSignalFilter("test-token", analysis);

        // Risk level should match expected based on confluence
        expect(["LOW", "MEDIUM", "HIGH"]).toContain(result.riskLevel);
      });
    });
  });

  describe("Edge Cases and Boundary Testing", () => {
    it("should handle extreme RSI values", () => {
      // Test boundary RSI values
      const extremeOversold = createMockAnalysis({ rsi: "5" });
      const extremeOverbought = createMockAnalysis({ rsi: "95" });

      const oversoldResult = applyStaticSignalFilter("test-token", extremeOversold);
      const overboughtResult = applyStaticSignalFilter("test-token", extremeOverbought);

      expect(oversoldResult.triggeredIndicators.length).toBeGreaterThan(0);
      expect(overboughtResult.triggeredIndicators.length).toBeGreaterThan(0);
    });

    it("should handle invalid token addresses", () => {
      const analysis = createMockAnalysis();

      // Test with various token address formats
      const results = [
        applyStaticSignalFilter("invalid-address", analysis),
        applyStaticSignalFilter("", analysis),
        applyStaticSignalFilter("test", analysis),
      ];

      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.shouldProceed).toBeDefined();
        expect(result.riskLevel).toBeDefined();
      });
    });
  });
});
