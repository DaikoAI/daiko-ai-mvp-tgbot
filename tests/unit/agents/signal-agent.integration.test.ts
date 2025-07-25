import { describe, expect, it } from "bun:test";
import { initSignalGraph } from "../../../src/agents/signal/graph";
import type { SignalGraphState } from "../../../src/agents/signal/graph-state";
import { createSimpleSignalResponse } from "../../../src/agents/signal/nodes/signal-formatter";
import type { TechnicalAnalysis } from "../../../src/db/schema/technical-analysis";
import { createPhantomButtons } from "../../../src/lib/phantom";

// Integration tests using real backtesting modules for end-to-end functionality

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

describe("Signal Agent Integration Tests", () => {
  describe("Full Graph Functionality", () => {
    it("should initialize graph successfully", () => {
      const { graph } = initSignalGraph();
      expect(graph).toBeDefined();
      expect(typeof graph.invoke).toBe("function");
    });

    it("should create phantom buttons correctly", () => {
      const buttons = createPhantomButtons("So11111111111111111111111111111111111111112", "SOL");
      expect(Array.isArray(buttons)).toBe(true);
      expect(buttons[0]).toHaveProperty("text");
      expect(buttons[0]).toHaveProperty("url");
    });
  });

  describe("End-to-End Signal Generation", () => {
    it("should skip when no indicators trigger", async () => {
      const { graph } = initSignalGraph();

      const result = await graph.invoke({
        tokenAddress: "So11111111111111111111111111111111111111112",
        tokenSymbol: "SOL",
        currentPrice: 100,
        technicalAnalysis: createMockAnalysis({
          rsi: "35", // Normal range
          vwap_deviation: "1.5", // Below threshold
          percent_b: "0.4", // Normal
        }),
      });

      expect(result.staticFilterResult?.shouldProceed).toBe(false);
      // When no indicators trigger, no final signal is generated
      expect(result.finalSignal).toBeUndefined();
    });

    it("should generate BUY signal for oversold conditions", async () => {
      const { graph } = initSignalGraph();

      const result = await graph.invoke({
        tokenAddress: "So11111111111111111111111111111111111111112",
        tokenSymbol: "SOL",
        currentPrice: 100,
        technicalAnalysis: createMockAnalysis({
          rsi: "15", // Extremely oversold
          vwap_deviation: "5.0", // Significant deviation
          percent_b: "0.1", // Near lower band
        }),
      });

      expect(result.staticFilterResult?.shouldProceed).toBe(true);

      if (result.finalSignal) {
        expect(result.finalSignal.title).toContain("BUY");
        expect(result.finalSignal.message).toContain("Why This Signal");
        expect(result.finalSignal.message).toContain("Next Steps");
      }
    }, 15000); // 15 second timeout for integration test
  });

  describe("Signal Formatting Integration", () => {
    it("should format BUY signal with enhanced template", () => {
      const result = createSimpleSignalResponse({
        tokenSymbol: "SOL",
        tokenAddress: "So11111111111111111111111111111111111111112",
        currentPrice: 100,
        technicalAnalysis: createMockAnalysis(),
        signalDecision: {
          shouldGenerateSignal: true,
          signalType: "RSI_OVERSOLD",
          direction: "BUY",
          confidence: 0.65,
          reasoning: "Strong oversold signal",
          keyFactors: ["RSI oversold", "VWAP deviation"],
          riskLevel: "MEDIUM",
          timeframe: "SHORT",
          marketSentiment: "Bullish",
          priceExpectation: "Recovery expected",
        },
      } as SignalGraphState);

      expect(result.finalSignal?.message).toContain("🗒️ *Market Snapshot*");
      expect(result.finalSignal?.message).toContain("🎯 *Suggested Action*");
    });
  });

  describe("Real Module Performance", () => {
    it("should execute full signal generation within reasonable time", async () => {
      const { graph } = initSignalGraph();
      const startTime = Date.now();

      await graph.invoke({
        tokenAddress: "So11111111111111111111111111111111111111112",
        tokenSymbol: "SOL",
        currentPrice: 100,
        technicalAnalysis: createMockAnalysis({
          rsi: "25", // Slightly oversold
          vwap_deviation: "3.0", // Some deviation
          percent_b: "0.2", // Lower band area
        }),
      });

      const executionTime = Date.now() - startTime;
      // Should complete within 10 seconds for integration test
      expect(executionTime).toBeLessThan(10000);
    });

    it("should handle edge cases in real modules", async () => {
      const { graph } = initSignalGraph();

      // Test with extreme values
      const result = await graph.invoke({
        tokenAddress: "So11111111111111111111111111111111111111112",
        tokenSymbol: "SOL",
        currentPrice: 0.000001, // Very low price
        technicalAnalysis: createMockAnalysis({
          rsi: "0", // Extreme oversold
          vwap_deviation: "10.0", // Extreme deviation
          percent_b: "0", // At lower band
          adx: "50", // High trend strength
        }),
      });

      // Should handle extreme values gracefully
      expect(result.staticFilterResult).toBeDefined();
      expect(typeof result.staticFilterResult?.shouldProceed).toBe("boolean");
    });
  });

  describe("Real Backtesting Module Integration", () => {
    it("should process multiple scenarios with real modules", async () => {
      const { graph } = initSignalGraph();

      const scenarios = [
        // Oversold scenario
        {
          rsi: "20",
          vwap_deviation: "4.0",
          percent_b: "0.1",
          expectedProceed: true,
        },
        // Normal scenario
        {
          rsi: "50",
          vwap_deviation: "1.0",
          percent_b: "0.5",
          expectedProceed: false,
        },
        // Overbought scenario
        {
          rsi: "80",
          vwap_deviation: "-4.0",
          percent_b: "0.9",
          expectedProceed: true,
        },
      ];

      for (const scenario of scenarios) {
        const result = await graph.invoke({
          tokenAddress: "So11111111111111111111111111111111111111112",
          tokenSymbol: "SOL",
          currentPrice: 100,
          technicalAnalysis: createMockAnalysis({
            rsi: scenario.rsi,
            vwap_deviation: scenario.vwap_deviation,
            percent_b: scenario.percent_b,
          }),
        });

        expect(result.staticFilterResult?.shouldProceed).toBe(scenario.expectedProceed);
      }
    }, 30000); // 30 second timeout for multiple scenario processing
  });
});
