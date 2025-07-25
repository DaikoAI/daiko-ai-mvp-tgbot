import { describe, expect, it } from "bun:test";
import { initSignalGraph } from "../../../src/agents/signal/graph";
import type { SignalGraphState } from "../../../src/agents/signal/graph-state";
import { createSimpleSignalResponse } from "../../../src/agents/signal/nodes/signal-formatter";
import type { TechnicalAnalysis } from "../../../src/db/schema/technical-analysis";
import { createPhantomButtons } from "../../../src/lib/phantom";

// Use real backtesting modules for meaningful tests

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

describe("Signal Agent", () => {
  describe("Basic Functionality", () => {
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

  describe("Signal Generation", () => {
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
    });
  });

  describe("Signal Formatting", () => {
    it("should format BUY signal with enhanced template", () => {
      const result = createSimpleSignalResponse({
        tokenSymbol: "SOL",
        tokenAddress: "So11111111111111111111111111111111111111112",
        currentPrice: 100,
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
});
