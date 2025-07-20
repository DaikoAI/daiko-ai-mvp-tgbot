import { describe, expect, it } from "vitest";
import { initSignalGraph } from "../../../src/agents/signal/graph";
import { createPhantomButtons } from "../../../src/lib/phantom";

describe("Signal Agent", () => {
  it("should initialize graph successfully", async () => {
    const token = "SOL";
    const { graph } = await initSignalGraph(token);

    // エージェントが正常に初期化されることを確認
    expect(graph).toBeDefined();
  });

  it("should create unique thread ID for different tokens", async () => {
    const tokens = ["BTC", "ETH", "SOL"];

    for (const token of tokens) {
      const { graph } = await initSignalGraph(token);
      expect(graph).toBeDefined();
      // Note: Signal graph doesn't use configurable thread_id like telegram graph
    }
  });

  it("should handle graph compilation", async () => {
    const { graph } = await initSignalGraph("TEST");

    // グラフが適切にコンパイルされ、invokeメソッドが存在することを確認
    expect(typeof graph.invoke).toBe("function");
    expect(typeof graph.stream).toBe("function");
  });

  it("should create signal", async () => {
    const { graph } = await initSignalGraph("TEST");
    const signal = await graph.invoke({
      tokenAddress: "So11111111111111111111111111111111111111112",
      tokenSymbol: "SOL",
      currentPrice: 100,
      technicalAnalysis: {
        id: "1",
        token: "So11111111111111111111111111111111111111112",
        timestamp: 1716153600,
        vwap: "100",
        vwap_deviation: "0",
        obv: "100",
        rsi: "50",
        percent_b: "0",
        adx: "0",
        atr_percent: "0",
        obv_zscore: "0",
        bb_width: "0",
        atr: "0",
        adx_direction: "0",
        signalGenerated: false,
        createdAt: new Date(),
      },
      staticFilterResult: {
        shouldProceed: true,
        triggeredIndicators: [],
        signalCandidates: ["RSI", "VWAP", "MA", "EMA"],
        confluenceScore: 0,
        riskLevel: "LOW",
      },
    });
    expect(signal).toBeDefined();
  });

  it("should create phantom buttons", () => {
    const buttons = createPhantomButtons("So11111111111111111111111111111111111111112", "SOL");
    expect(buttons).toBeDefined();
    expect(buttons.length).toBe(1);
    expect(buttons[0].text).toBe("👻 Open SOL in Phantom");
    expect(buttons[0].url).toBe(
      "https://phantom.app/ul/browse/https%3A%2F%2Fdexscreener.com%2Fsolana%2FSo11111111111111111111111111111111111111112?ref=https%3A%2F%2Fdexscreener.com",
    );
  });
});
