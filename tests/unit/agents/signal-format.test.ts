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
    technicalAnalysis: undefined as any, // Not used directly by formatter in this test
    staticFilterResult: undefined as any,
    signalDecision: {
      shouldGenerateSignal: true,
      signalType: "Oversold Bounce",
      direction: "BUY",
      confidence: 0.72,
      reasoning: "Sample reasoning for snapshot section.",
      keyFactors: [
        "RSI 15 - extremely oversold",
        "VWAP -4.5% deviation",
        "Volume spike detected",
      ],
      riskLevel: "MEDIUM",
      timeframe: "SHORT",
      marketSentiment: "Bullish reversal expected",
      priceExpectation: "Upside potential 10-20%",
    },
  } as unknown as SignalGraphState;
};

describe("Signal Formatter template compliance", () => {
  it("should generate message matching required template", () => {
    const state = buildMockState();
    const { finalSignal } = createSimpleSignalResponse(state);
    expect(finalSignal).toBeDefined();

    const lines = finalSignal.message.split("\n");

    // Ensure we have at least 17 lines according to spec
    expect(lines.length).toBeGreaterThanOrEqual(17);

    // Line 1: Emoji + Action + $TOKEN + Risk
    expect(lines[0]).toMatch(/^(🚀|🚨|📊) (BUY|SELL|NEUTRAL) \$[A-Z]+ - (Low|Medium|High) Risk$/);

    // Line 2: Price and confidence
    expect(lines[1]).toMatch(/^Price: \$[0-9.]+ Confidence: [0-9]+ %$/);

    // Line 3: Timeframe line contains parentheses and recommendation phrase
    expect(lines[2]).toMatch(/^Timeframe: (Short-term|Mid-term|Long-term) \([^)]+ re-check recommended\)$/);

    // Line 6 (index 5): bold Market Snapshot header
    expect(lines[5]).toMatch(/\*\*🗒️ Market Snapshot\*\*/);

    // Line 9 (index 8): bold Why header
    expect(lines[8]).toMatch(/\*\*🔍 Why\?\*\*/);

    // Between Why header and Suggested Action header there should be at least one bullet with ●
    const hasBullet = lines.slice(9).some((l: string) => l.startsWith("● "));
    expect(hasBullet).toBe(true);

    // Suggested Action header bold check
    const suggestedHeaderIndex = lines.findIndex((l: string) => l.includes("🎯"));
    expect(lines[suggestedHeaderIndex]).toMatch(/\*\*🎯 Suggested Action\*\*/);

    // DYOR disclaimer should be last non-empty line
    expect(lines[lines.length - 1]).toBe("⚠️ DYOR - Always do your own research.");
  });
});