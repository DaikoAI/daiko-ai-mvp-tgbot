import { describe, expect, it } from "bun:test";
import { initSignalGraph } from "../../../src/agents/signal/graph";
import type { SignalGraphState } from "../../../src/agents/signal/graph-state";
// Import the actual formatter for testing
import { createSimpleSignalResponse } from "../../../src/agents/signal/nodes/signal-formatter";
import type { TechnicalAnalysis } from "../../../src/db/schema/technical-analysis";
import { createPhantomButtons } from "../../../src/lib/phantom";

// Create test helper function
const testFormatSignal = (state: Partial<SignalGraphState>) => {
  return createSimpleSignalResponse(state as SignalGraphState);
};

describe("Signal Agent", () => {
  describe("Basic Functionality", () => {
    it("should initialize graph successfully", () => {
      const { graph } = initSignalGraph();
      expect(graph).toBeDefined();
      expect(typeof graph.invoke).toBe("function");
      expect(typeof graph.stream).toBe("function");
    });

    it("should create phantom buttons with correct structure", () => {
      const tokenAddress = "So11111111111111111111111111111111111111112";
      const tokenSymbol = "SOL";

      const buttons = createPhantomButtons(tokenAddress, tokenSymbol);

      expect(buttons).toBeDefined();
      expect(Array.isArray(buttons)).toBe(true);
      expect(buttons.length).toBe(1);
      expect(buttons[0]).toHaveProperty("text");
      expect(buttons[0]).toHaveProperty("url");
      expect(buttons[0]?.text).toBe("👻 Open SOL in Phantom");
      expect(buttons[0]?.url).toBe(
        "https://phantom.app/ul/browse/https%3A%2F%2Fdexscreener.com%2Fsolana%2FSo11111111111111111111111111111111111111112?ref=https%3A%2F%2Fdexscreener.com",
      );
    });
  });

  describe("Signal Generation Behavior", () => {
    const baseAnalysis: TechnicalAnalysis = {
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
      adx_direction: "0",
      signalGenerated: false,
      createdAt: new Date(),
    };

    it("should skip signal generation when no indicators trigger (below thresholds)", async () => {
      const { graph } = initSignalGraph();

      const signal = await graph.invoke({
        tokenAddress: "So11111111111111111111111111111111111111112",
        tokenSymbol: "SOL",
        currentPrice: 100,
        technicalAnalysis: baseAnalysis,
      });

      // Assert basic structure
      expect(signal).toBeDefined();
      expect(signal.tokenAddress).toBe("So11111111111111111111111111111111111111112");
      expect(signal.tokenSymbol).toBe("SOL");
      expect(signal.currentPrice).toBe(100);
      expect(signal.technicalAnalysis).toBeDefined();

      // Assert static filter results
      expect(signal.staticFilterResult).toBeDefined();
      expect(signal.staticFilterResult.shouldProceed).toBe(false);
      expect(signal.staticFilterResult.triggeredIndicators).toBeDefined();
      expect(Array.isArray(signal.staticFilterResult.triggeredIndicators)).toBe(true);
      expect(signal.staticFilterResult.triggeredIndicators.length).toBe(0); // No indicators should trigger
      expect(signal.staticFilterResult.confluenceScore).toBe(0);

      // Assert no signal generation occurs when thresholds not met
      expect(signal.signalDecision).toBeUndefined(); // LLM analysis should not run
      expect(signal.finalSignal).toBeUndefined(); // No final signal should be generated
    });

    it("should generate signal when extreme oversold conditions are met (above thresholds)", async () => {
      const { graph } = initSignalGraph();

      const extremeOversoldAnalysis: TechnicalAnalysis = {
        ...baseAnalysis,
        rsi: "15", // Critical oversold (< 20) - should trigger RSI_CRITICAL_OVERSOLD
        vwap_deviation: "4.5", // Extreme deviation (> 4%) - should trigger VWAP_EXTREME_DEVIATION
      };

      const signal = await graph.invoke({
        tokenAddress: "So11111111111111111111111111111111111111112",
        tokenSymbol: "SOL",
        currentPrice: 100,
        technicalAnalysis: extremeOversoldAnalysis,
      });

      // Assert basic structure
      expect(signal).toBeDefined();
      expect(signal.tokenAddress).toBe("So11111111111111111111111111111111111111112");
      expect(signal.tokenSymbol).toBe("SOL");
      expect(signal.currentPrice).toBe(100);

      // Assert static filter detects triggers
      expect(signal.staticFilterResult).toBeDefined();
      expect(signal.staticFilterResult.shouldProceed).toBe(true);
      expect(signal.staticFilterResult.triggeredIndicators).toContain("RSI_CRITICAL_OVERSOLD");
      expect(signal.staticFilterResult.triggeredIndicators).toContain("VWAP_EXTREME_DEVIATION");
      expect(signal.staticFilterResult.confluenceScore).toBeGreaterThan(0);
      expect(signal.staticFilterResult.riskLevel).toBeDefined();

      // Assert LLM analysis runs and signal decision is made
      expect(signal.signalDecision).toBeDefined();
      if (signal.signalDecision) {
        expect(signal.signalDecision.shouldGenerateSignal).toBeDefined();
        expect(typeof signal.signalDecision.shouldGenerateSignal).toBe("boolean");
        expect(signal.signalDecision.signalType).toBeDefined();
        expect(signal.signalDecision.direction).toBeDefined();
        expect(signal.signalDecision.confidence).toBeDefined();
        expect(signal.signalDecision.riskLevel).toBeDefined();
        expect(signal.signalDecision.reasoning).toBeDefined();

        // If signal should be generated, final signal should exist
        if (signal.signalDecision.shouldGenerateSignal) {
          expect(signal.finalSignal).toBeDefined();
          expect(signal.finalSignal?.level).toBeDefined();
          expect(signal.finalSignal?.title).toBeDefined();
          expect(signal.finalSignal?.message).toBeDefined();
          expect(signal.finalSignal?.priority).toBeDefined();
          expect(signal.finalSignal?.buttons).toBeDefined();

          // Verify new format structure for generated signals
          if (signal.finalSignal?.message) {
            expect(signal.finalSignal.message).toContain("Market Snapshot");
            expect(signal.finalSignal.message).toContain("Why?");
            expect(signal.finalSignal.message).toContain("Suggested Action");
            expect(signal.finalSignal.message).not.toContain("–"); // No full-width dashes
          }
        }
      }
    });

    it("should generate signal when extreme overbought conditions are met", async () => {
      const { graph } = initSignalGraph();

      const extremeOverboughtAnalysis: TechnicalAnalysis = {
        ...baseAnalysis,
        rsi: "85", // Critical overbought (> 80) - should trigger RSI_CRITICAL_OVERBOUGHT
        percent_b: "1.1", // Breakout upper (> 1.0) - should trigger PERCENT_B_BREAKOUT_UPPER
      };

      const signal = await graph.invoke({
        tokenAddress: "So11111111111111111111111111111111111111112",
        tokenSymbol: "SOL",
        currentPrice: 100,
        technicalAnalysis: extremeOverboughtAnalysis,
      });

      // Assert basic structure
      expect(signal).toBeDefined();
      expect(signal.staticFilterResult).toBeDefined();
      expect(signal.staticFilterResult.shouldProceed).toBe(true);
      expect(signal.staticFilterResult.triggeredIndicators).toContain("RSI_CRITICAL_OVERBOUGHT");
      expect(signal.staticFilterResult.triggeredIndicators).toContain("BOLLINGER_BREAKOUT_UP"); // Actual implementation name

      // Assert signal decision exists
      expect(signal.signalDecision).toBeDefined();
      if (signal.signalDecision) {
        expect(signal.signalDecision.direction).toMatch(/BUY|SELL|NEUTRAL/);
        expect(signal.signalDecision.confidence).toBeGreaterThan(0);
        expect(signal.signalDecision.confidence).toBeLessThanOrEqual(1);
      }
    });

    it("should handle multiple moderate indicators correctly", async () => {
      const { graph } = initSignalGraph();

      const moderateSignalsAnalysis: TechnicalAnalysis = {
        ...baseAnalysis,
        rsi: "77", // Overbought (> 75) - should trigger RSI_OVERBOUGHT
        vwap_deviation: "3.5", // Significant deviation (> 3%) - should trigger VWAP_SIGNIFICANT_DEVIATION
        adx: "45", // Strong trend (> 40) - should trigger ADX_STRONG_TREND
      };

      const signal = await graph.invoke({
        tokenAddress: "So11111111111111111111111111111111111111112",
        tokenSymbol: "SOL",
        currentPrice: 100,
        technicalAnalysis: moderateSignalsAnalysis,
      });

      expect(signal).toBeDefined();
      expect(signal.staticFilterResult).toBeDefined();
      expect(signal.staticFilterResult.shouldProceed).toBe(true);
      expect(signal.staticFilterResult.riskLevel).toBe("MEDIUM");
      expect(signal.staticFilterResult.triggeredIndicators.length).toBeGreaterThanOrEqual(3);

      if (signal.signalDecision) {
        expect(signal.signalDecision.riskLevel).toBeDefined();
        expect(["LOW", "MEDIUM", "HIGH"]).toContain(signal.signalDecision.riskLevel);
      }

      if (signal.finalSignal) {
        expect(signal.finalSignal.priority).toBeDefined();
        expect(["LOW", "MEDIUM", "HIGH"]).toContain(signal.finalSignal.priority);
      }
    });

    it("should skip when only one indicator triggers (insufficient confluence)", async () => {
      const { graph } = initSignalGraph();

      const singleIndicatorAnalysis: TechnicalAnalysis = {
        ...baseAnalysis,
        rsi: "20", // Single critical indicator - should trigger but not meet confluence requirement
      };

      const signal = await graph.invoke({
        tokenAddress: "So11111111111111111111111111111111111111112",
        tokenSymbol: "SOL",
        currentPrice: 100,
        technicalAnalysis: singleIndicatorAnalysis,
      });

      expect(signal).toBeDefined();
      expect(signal.staticFilterResult).toBeDefined();
      expect(signal.staticFilterResult.shouldProceed).toBe(false); // Insufficient confluence
      expect(signal.staticFilterResult.triggeredIndicators.length).toBe(1); // Only one indicator should trigger
      expect(signal.staticFilterResult.confluenceScore).toBeLessThan(2); // Below minimum confluence

      // No signal should be generated due to insufficient confluence
      expect(signal.signalDecision).toBeUndefined();
      expect(signal.finalSignal).toBeUndefined();
    });

    it("should handle high volatility and volume spike conditions", async () => {
      const { graph } = initSignalGraph();

      const volatilityAnalysis: TechnicalAnalysis = {
        ...baseAnalysis,
        atr_percent: "8.5", // Extreme volatility (> 8%) - should trigger ATR_EXTREME_VOLATILITY (0.1)
        obv_zscore: "4.2", // Extreme OBV divergence (> 4σ) - should trigger OBV_EXTREME_DIVERGENCE (0.1)
        rsi: "15", // Critical oversold (< 20) - should trigger RSI_CRITICAL_OVERSOLD (0.25)
        vwap_deviation: "4.5", // Extreme deviation (> 4%) - should trigger VWAP_EXTREME_DEVIATION (0.3)
      };

      const signal = await graph.invoke({
        tokenAddress: "So11111111111111111111111111111111111111112",
        tokenSymbol: "SOL",
        currentPrice: 100,
        technicalAnalysis: volatilityAnalysis,
      });

      expect(signal).toBeDefined();
      expect(signal.staticFilterResult).toBeDefined();
      expect(signal.staticFilterResult.shouldProceed).toBe(true);
      expect(signal.staticFilterResult.signalCandidates).toContain("HIGH_VOLATILITY");
      expect(signal.staticFilterResult.signalCandidates).toContain("VOLUME_SPIKE");
      expect(signal.staticFilterResult.triggeredIndicators).toContain("ATR_EXTREME_VOLATILITY");
      expect(signal.staticFilterResult.triggeredIndicators).toContain("OBV_EXTREME_DIVERGENCE");
      expect(signal.staticFilterResult.triggeredIndicators).toContain("RSI_CRITICAL_OVERSOLD");
      expect(signal.staticFilterResult.triggeredIndicators).toContain("VWAP_EXTREME_DEVIATION");
      expect(signal.staticFilterResult.riskLevel).toBe("HIGH"); // High confluence score should result in HIGH risk

      expect(signal.signalDecision).toBeDefined();
      if (signal.finalSignal) {
        expect(signal.finalSignal.priority).toBe("HIGH");
        expect(signal.finalSignal.level).toBe(3); // Highest alert level

        // Verify high-priority signal format (simplified)
        expect(signal.finalSignal.message).toContain("Market Snapshot");
        expect(signal.finalSignal.message).toContain("Why?");
        expect(signal.finalSignal.message).toContain("Suggested Action");
        expect(signal.finalSignal.title).toContain("BUY");
        expect(signal.finalSignal.title).toContain("$SOL");
        expect(signal.finalSignal.message).not.toContain("–"); // No full-width dashes
      }
    });

    it("should maintain consistent data flow through all nodes", async () => {
      const { graph } = initSignalGraph();

      const testAnalysis: TechnicalAnalysis = {
        ...baseAnalysis,
        rsi: "15", // Extreme condition to ensure processing
        vwap_deviation: "5.0",
      };

      const signal = await graph.invoke({
        tokenAddress: "So11111111111111111111111111111111111111112",
        tokenSymbol: "SOL",
        currentPrice: 100,
        technicalAnalysis: testAnalysis,
      });

      // Verify data flow consistency through all nodes
      expect(signal.tokenAddress).toBe("So11111111111111111111111111111111111111112");
      expect(signal.tokenSymbol).toBe("SOL");
      expect(signal.currentPrice).toBe(100);
      expect(signal.technicalAnalysis).toBeDefined();
      expect(signal.technicalAnalysis.id).toBe("test-1");
      expect(signal.staticFilterResult).toBeDefined();
      expect(signal.signalDecision).toBeDefined();

      // Verify signal decision contains all required fields
      if (signal.signalDecision) {
        expect(signal.signalDecision).toHaveProperty("shouldGenerateSignal");
        expect(signal.signalDecision).toHaveProperty("signalType");
        expect(signal.signalDecision).toHaveProperty("direction");
        expect(signal.signalDecision).toHaveProperty("confidence");
        expect(signal.signalDecision).toHaveProperty("riskLevel");
        expect(signal.signalDecision).toHaveProperty("reasoning");
        expect(signal.signalDecision).toHaveProperty("keyFactors");
      }

      // If final signal exists, verify its structure
      if (signal.finalSignal) {
        expect(signal.finalSignal).toHaveProperty("level");
        expect(signal.finalSignal).toHaveProperty("title");
        expect(signal.finalSignal).toHaveProperty("message");
        expect(signal.finalSignal).toHaveProperty("priority");
        expect(signal.finalSignal).toHaveProperty("tags");
        expect(signal.finalSignal).toHaveProperty("buttons");

        // Verify level is valid
        expect([1, 2, 3]).toContain(signal.finalSignal.level);
        // Verify priority is valid
        expect(["LOW", "MEDIUM", "HIGH"]).toContain(signal.finalSignal.priority);
        // Verify buttons include phantom button
        expect(signal.finalSignal.buttons?.length).toBeGreaterThan(0);

        // Verify new message format structure
        expect(signal.finalSignal.message).toContain("Market Snapshot");
        expect(signal.finalSignal.message).toContain("Why?");
        expect(signal.finalSignal.message).toContain("Suggested Action");
        expect(signal.finalSignal.message).toContain("DYOR - Always do your own research");

        // Verify title format matches new structure (simplified)
        expect(signal.finalSignal.title).toContain("BUY");
        expect(signal.finalSignal.title).toContain("$SOL");

        // Verify message contains proper sections with half-width dashes
        expect(signal.finalSignal.message).not.toContain("–"); // No full-width dashes
        expect(signal.finalSignal.message).toMatch(/Price: \$[\d.]+/); // New format: Price: $100
        expect(signal.finalSignal.message).toMatch(/Confidence: \d+ %/); // New format: Confidence: 65 %
        expect(signal.finalSignal.message).toContain("🗒️ Market Snapshot");
        expect(signal.finalSignal.message).toContain("🔍 Why?");
        expect(signal.finalSignal.message).toContain("🎯 Suggested Action");
        expect(signal.finalSignal.message).toContain("⚠️ DYOR - Always do your own research.");
      }
    });

    it("should handle boundary values correctly", async () => {
      const { graph } = initSignalGraph();

      const boundaryAnalysis: TechnicalAnalysis = {
        ...baseAnalysis,
        rsi: "20", // Exactly at critical oversold threshold
        vwap_deviation: "4.0", // Exactly at extreme deviation threshold
      };

      const signal = await graph.invoke({
        tokenAddress: "So11111111111111111111111111111111111111112",
        tokenSymbol: "SOL",
        currentPrice: 100,
        technicalAnalysis: boundaryAnalysis,
      });

      expect(signal).toBeDefined();
      expect(signal.staticFilterResult).toBeDefined();

      // Check if boundary values trigger correctly
      const triggeredIndicators = signal.staticFilterResult.triggeredIndicators;
      expect(Array.isArray(triggeredIndicators)).toBe(true);

      // RSI 20 should trigger critical oversold
      expect(triggeredIndicators).toContain("RSI_CRITICAL_OVERSOLD");
      // VWAP deviation 4.0 should trigger extreme deviation
      expect(triggeredIndicators).toContain("VWAP_EXTREME_DEVIATION");

      // Should proceed with 2 confluent indicators
      expect(signal.staticFilterResult.shouldProceed).toBe(true);
      expect(signal.staticFilterResult.confluenceScore).toBeGreaterThanOrEqual(0.2); // Minimum confluence threshold
      expect(signal.staticFilterResult.triggeredIndicators.length).toBeGreaterThanOrEqual(2); // Minimum indicator count
    });
  });

  describe("Signal Formatting", () => {
    it("should format BUY signal with new template structure", () => {
      const mockState: Partial<SignalGraphState> = {
        tokenAddress: "So11111111111111111111111111111111111111112",
        tokenSymbol: "SOL",
        currentPrice: 125.5,
        signalDecision: {
          shouldGenerateSignal: true,
          signalType: "BUY",
          direction: "BUY",
          confidence: 0.75,
          reasoning: "Strong oversold bounce potential with multiple confirmations.",
          keyFactors: ["RSI 28 - oversold recovery", "VWAP support hold", "Volume increase"],
          riskLevel: "MEDIUM",
          timeframe: "MEDIUM",
          marketSentiment: "Recovery building",
          priceExpectation: "Upside potential 20-30%",
        },
      };

      const result = testFormatSignal(mockState);

      expect(result).toBeDefined();
      expect(result.finalSignal).toBeDefined();
      expect(result.finalSignal.level).toBe(2); // MEDIUM risk
      expect(result.finalSignal.priority).toBe("MEDIUM");

      // Test new format structure
      expect(result.finalSignal.title).toBe("🚀 BUY $SOL - Medium Risk");
      expect(result.finalSignal.message).toContain("🚀 BUY $SOL - Medium Risk");
      expect(result.finalSignal.message).toContain("Price: $125.5");
      expect(result.finalSignal.message).toContain("Confidence: 75 %");
      expect(result.finalSignal.message).toContain("Timeframe: Mid-term (4-12h re-check recommended)");

      // Test required sections
      expect(result.finalSignal.message).toContain("🗒️ Market Snapshot");
      expect(result.finalSignal.message).toContain("🔍 Why?");
      expect(result.finalSignal.message).toContain("🎯 Suggested Action");
      expect(result.finalSignal.message).toContain("⚠️ DYOR - Always do your own research.");
    });

    it("should format SELL signal with high risk correctly", () => {
      const mockState: Partial<SignalGraphState> = {
        tokenAddress: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
        tokenSymbol: "WIF",
        currentPrice: 2.45,
        signalDecision: {
          shouldGenerateSignal: true,
          signalType: "SELL",
          direction: "SELL",
          confidence: 0.82,
          reasoning: "Multiple overbought signals with high volatility.",
          keyFactors: ["RSI critical overbought", "Volume spike", "Resistance break failure"],
          riskLevel: "HIGH",
          timeframe: "SHORT",
          marketSentiment: "Bearish",
          priceExpectation: "Downward pressure expected",
        },
      };

      const result = testFormatSignal(mockState);

      expect(result).toBeDefined();
      expect(result.finalSignal).toBeDefined();
      expect(result.finalSignal.level).toBe(3); // HIGH risk
      expect(result.finalSignal.priority).toBe("HIGH");
      expect(result.finalSignal.title).toBe("🚨 SELL $WIF - High Risk");
      expect(result.finalSignal.message).toContain("🚨 SELL $WIF - High Risk");
      expect(result.finalSignal.message).toContain("Confidence: 82 %");
      expect(result.finalSignal.message).toContain("Timeframe: Short-term (1-4h re-check recommended)");
      expect(result.finalSignal.message).toContain("Consider partial or full sell");
    });

    it("should handle NEUTRAL/HOLD signals", () => {
      const mockState: Partial<SignalGraphState> = {
        tokenAddress: "So11111111111111111111111111111111111111112",
        tokenSymbol: "SOL",
        currentPrice: 95.0,
        signalDecision: {
          shouldGenerateSignal: true,
          signalType: "NEUTRAL",
          direction: "NEUTRAL",
          confidence: 0.45,
          reasoning: "Mixed signals with no clear directional bias.",
          keyFactors: ["RSI neutral range", "Volume declining", "Sideways trend"],
          riskLevel: "LOW",
          timeframe: "LONG",
          marketSentiment: "Neutral",
          priceExpectation: "Range-bound movement",
        },
      };

      const result = testFormatSignal(mockState);

      expect(result).toBeDefined();
      expect(result.finalSignal).toBeDefined();
      expect(result.finalSignal.level).toBe(1); // LOW risk
      expect(result.finalSignal.priority).toBe("LOW");
      expect(result.finalSignal.title).toBe("📊 NEUTRAL $SOL - Low Risk");
      expect(result.finalSignal.message).toContain("📊 NEUTRAL $SOL - Low Risk");
      expect(result.finalSignal.message).toContain("Timeframe: Long-term (12-24h re-check recommended)");
      expect(result.finalSignal.message).toContain("Hold current position");
    });
  });
});
