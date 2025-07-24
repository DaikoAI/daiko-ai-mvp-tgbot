import { describe, expect, it } from "bun:test";
import type { SignalGraphState } from "../../../src/agents/signal/graph-state";
import { createSimpleSignalResponse } from "../../../src/agents/signal/nodes/signal-formatter";

/**
 * Minimal mock state to test only formatting logic. Fields not required by the
 * formatter are stubbed as needed.
 */
const buildMockState = (): SignalGraphState => {
  return {
    tokenAddress: "So11111111111111111111111111111111111111112",
    tokenSymbol: "SOL",
    currentPrice: 100,
    technicalAnalysis: {
      rsi: "15",
      vwap_deviation: "5.0",
      percent_b: "0.5",
      adx: "25",
      atr_percent: "2.0",
      obv_zscore: "1.5",
    } as any,
    staticFilterResult: undefined as any,
    signalDecision: {
      shouldGenerateSignal: true,
      signalType: "Oversold Bounce",
      direction: "BUY",
      confidence: 0.65,
      reasoning:
        "SOL is deeply oversold (RSI 15) and trading 5% below its volume-weighted average price. This double signal suggests buyers may soon step in for a relief rally. The ADX of 25 confirms a trend exists, and the low Bollinger position (%B 0.5) shows price is at the lower band, increasing bounce odds. While risk is HIGH due to volatility (2% ATR), the reward potential outweighs the risk for a short-term swing.",
      keyFactors: [
        "RSI 15 - extremely oversold conditions favor buyers",
        "ADX 25 - strong trend developing (0ward)",
        "VWAP Dev +5.0% - significant premium to VWAP",
      ],
      riskLevel: "HIGH",
      timeframe: "SHORT",
      marketSentiment: "Bullish reversal expected",
      priceExpectation: "Upside potential 10-20%",
    },
  } as unknown as SignalGraphState;
};

describe("Signal Formatter new template compliance", () => {
  it("should generate message with new format structure", () => {
    const state = buildMockState();
    const { finalSignal } = createSimpleSignalResponse(state);
    expect(finalSignal).toBeDefined();

    const lines = finalSignal.message.split("\n");

    // Line 1: Emoji + Action + $TOKEN (without risk)
    expect(lines[0]).toMatch(/^🚀 BUY \$SOL$/);

    // Line 2: Risk level
    expect(lines[1]).toMatch(/^Risk: High$/);

    // Line 3: Price with underscores for emphasis
    expect(lines[2]).toMatch(/^Price: _\$100_$/);

    // Line 4: Confidence percentage
    expect(lines[3]).toMatch(/^Confidence: 65%$/);

    // Line 5: Timeframe
    expect(lines[4]).toMatch(/^Timeframe: Short-term \(1-4h re-check recommended\)$/);

    // Line 6: Empty line
    expect(lines[5]).toBe("");

    // Line 7: Market Snapshot header with italic formatting
    expect(lines[6]).toMatch(/^🗒️ \*Market Snapshot\*$/);

    // Line 9: Empty line
    expect(lines[8]).toBe("");

    // Line 10: Why header with italic formatting
    expect(lines[9]).toMatch(/^🔍 \*Why\?\*$/);

    // Lines after Why header should contain bullets with ●
    const whyLines = lines.slice(10, 13);
    whyLines.forEach((line) => {
      if (line.trim()) {
        expect(line).toMatch(/^● /);
      }
    });

    // Find Suggested Action header
    const suggestedActionIndex = lines.findIndex((line) => line.includes("🎯"));
    expect(lines[suggestedActionIndex]).toMatch(/^🎯 \*Suggested Action\*$/);

    // DYOR disclaimer should be the last line
    const lastLine = lines[lines.length - 1];
    expect(lastLine).toBe("⚠️ DYOR - Always do your own research.");
  });

  it("should format BUY signal correctly", () => {
    const state = buildMockState();
    state.signalDecision!.confidence = 0.75;
    state.signalDecision!.riskLevel = "MEDIUM";
    state.currentPrice = 125.5;

    const result = createSimpleSignalResponse(state);

    expect(result).toBeDefined();
    expect(result.finalSignal).toBeDefined();
    expect(result.finalSignal.level).toBe(2); // MEDIUM risk
    expect(result.finalSignal.priority).toBe("MEDIUM");

    // Test new format structure
    expect(result.finalSignal.title).toBe("🚀 BUY $SOL - Medium Risk");
    expect(result.finalSignal.message).toContain("🚀 BUY $SOL");
    expect(result.finalSignal.message).toContain("Risk: Medium");
    expect(result.finalSignal.message).toContain("Price: _$125.5_");
    expect(result.finalSignal.message).toContain("Confidence: 75%");
  });

  it("should format SELL signal with high risk correctly", () => {
    const state = buildMockState();
    state.tokenSymbol = "WIF";
    state.currentPrice = 2.45;
    state.signalDecision!.direction = "SELL";
    state.signalDecision!.confidence = 0.82;
    state.signalDecision!.riskLevel = "HIGH";
    state.signalDecision!.reasoning = "Multiple overbought signals with high volatility.";
    state.signalDecision!.keyFactors = ["RSI critical overbought", "Volume spike", "Resistance break failure"];

    const result = createSimpleSignalResponse(state);

    expect(result).toBeDefined();
    expect(result.finalSignal).toBeDefined();
    expect(result.finalSignal.level).toBe(3); // HIGH risk
    expect(result.finalSignal.priority).toBe("HIGH");
    expect(result.finalSignal.title).toBe("🚨 SELL $WIF - High Risk");
    expect(result.finalSignal.message).toContain("🚨 SELL $WIF");
    expect(result.finalSignal.message).toContain("Risk: High");
    expect(result.finalSignal.message).toContain("Price: _$2.45_");
    expect(result.finalSignal.message).toContain("Confidence: 82%");
  });

  it("should handle NEUTRAL/HOLD signals", () => {
    const state = buildMockState();
    state.currentPrice = 95;
    state.signalDecision!.direction = "NEUTRAL";
    state.signalDecision!.confidence = 0.45;
    state.signalDecision!.riskLevel = "LOW";
    state.signalDecision!.timeframe = "LONG";
    state.signalDecision!.reasoning = "Mixed signals with no clear directional bias.";
    state.signalDecision!.keyFactors = ["RSI neutral range", "Volume declining", "Sideways trend"];

    const result = createSimpleSignalResponse(state);

    expect(result).toBeDefined();
    expect(result.finalSignal).toBeDefined();
    expect(result.finalSignal.level).toBe(1); // LOW risk
    expect(result.finalSignal.priority).toBe("LOW");
    expect(result.finalSignal.title).toBe("📊 NEUTRAL $SOL - Low Risk");
    expect(result.finalSignal.message).toContain("📊 NEUTRAL $SOL");
    expect(result.finalSignal.message).toContain("Risk: Low");
    expect(result.finalSignal.message).toContain("Price: _$95_");
    expect(result.finalSignal.message).toContain("Confidence: 45%");
    expect(result.finalSignal.message).toContain("Long-term (12-24h re-check recommended)");
  });
});
