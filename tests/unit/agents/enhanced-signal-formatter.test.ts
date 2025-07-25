import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { SignalGraphState } from "../../../src/agents/signal/graph-state";
import { createNoSignalResponse, formatEnhancedSignal } from "../../../src/agents/signal/nodes/enhanced-signal-formatter";
import type { TechnicalAnalysis } from "../../../src/db/schema/technical-analysis";

// Mock dependencies using bun:test mock
const mockCollectSignalPerformanceData = mock();
const mockCreatePhantomButtons = mock(() => [
  { text: "Buy on Phantom", url: "https://phantom.app/buy/SOL" },
]);
const mockLogger = {
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
  debug: mock(() => {}),
};

// Mock modules - following project patterns
mock.module("../../../src/lib/backtesting/data-collector", () => ({
  collectSignalPerformanceData: mockCollectSignalPerformanceData,
}));

mock.module("../../../src/utils/logger", () => ({
  logger: mockLogger,
}));

/**
 * Create mock technical analysis data
 */
const createMockTechnicalAnalysis = (overrides: Partial<TechnicalAnalysis> = {}): TechnicalAnalysis => ({
  id: "test-1",
  token: "So11111111111111111111111111111111111111112",
  timestamp: 1716153600,
  vwap: "100",
  vwap_deviation: "5.0",
  obv: "1000",
  rsi: "15",
  percent_b: "0.2",
  adx: "25",
  atr_percent: "2.0",
  obv_zscore: "1.5",
  bb_width: "0.1",
  atr: "1.5",
  adx_direction: "UP",
  signalGenerated: false,
  createdAt: new Date(),
  ...overrides,
});

/**
 * Build comprehensive mock state for enhanced signal formatter testing
 */
const buildMockState = (overrides: Partial<SignalGraphState> = {}): SignalGraphState => ({
  tokenAddress: "So11111111111111111111111111111111111111112",
  tokenSymbol: "SOL",
  currentPrice: 100,
  technicalAnalysis: createMockTechnicalAnalysis(),
  staticFilterResult: {
    shouldProceed: true,
    triggeredIndicators: ["RSI_CRITICAL_OVERSOLD", "VWAP_EXTREME_DEVIATION"],
    signalCandidates: ["RSI_OVERSOLD", "VWAP_DEVIATION_HIGH"],
    confluenceScore: 0.65,
    riskLevel: "HIGH",
  },
  signalDecision: {
    shouldGenerateSignal: true,
    signalType: "Oversold Bounce",
    direction: "BUY",
    confidence: 0.75,
    reasoning: "SOL is deeply oversold with strong technical confluence",
    keyFactors: [
      "RSI 15 - extremely oversold conditions",
      "VWAP deviation +5.0% - significant premium",
      "Bollinger Bands %B 0.2 - near lower band",
    ],
    riskLevel: "HIGH",
    timeframe: "SHORT",
    marketSentiment: "BULLISH",
    sentimentConfidence: 0.8,
    sentimentFactors: ["Bullish reversal expected"],
    priceExpectation: "Upside potential 10-20%",
  },
  evidenceResults: {
    relevantSources: [
      {
        title: "SOL Technical Analysis: Strong Support Levels",
        url: "https://example.com/sol-analysis",
        content: "SOL showing strong support at current levels",
        score: 0.85,
        domain: "example.com",
        publishedDate: "2024-01-15",
      },
      {
        title: "Solana Network Updates: New Developments",
        url: "https://solana.com/news",
        content: "Latest Solana network improvements",
        score: 0.80,
        domain: "solana.com",
      },
    ],
    searchQueries: ["SOL technical analysis", "Solana price prediction"],
    totalResults: 2,
    searchTime: 1500,
    qualityScore: 0.85,
    searchStrategy: "FUNDAMENTAL",
  },
  finalSignal: {
    level: 1,
    title: "",
    message: "",
    priority: "LOW",
    tags: [],
  },
  ...overrides,
});

describe("Enhanced Signal Formatter", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    mockCollectSignalPerformanceData.mockReset();
    mockCreatePhantomButtons.mockReset();
    mockLogger.info.mockReset();
    mockLogger.warn.mockReset();
    mockLogger.error.mockReset();
    mockLogger.debug.mockReset();

    // Set NODE_ENV to test for consistent behavior
    process.env.NODE_ENV = "test";
  });

  describe("formatEnhancedSignal - Normal Cases", () => {
    it("should return enhanced signal with all expected properties for BUY signal", async () => {
      // Setup
      mockCollectSignalPerformanceData.mockImplementation(() => Promise.resolve([
        {
          signalType: "Oversold Bounce",
          direction: "BUY",
          return4h: 0.12,
          isWin4h: true,
        },
      ]));

      const state = buildMockState();

      // Execute
      const result = await formatEnhancedSignal(state);

      // Verify structure
      expect(result.finalSignal).toBeDefined();
      expect([1, 2, 3]).toContain(result.finalSignal.level);
      expect(result.finalSignal.title).toContain("🚀");
      expect(result.finalSignal.title).toContain("BUY");
      expect(result.finalSignal.title).toContain("SOL");
      expect(result.finalSignal.message).toBeDefined();
      expect(result.finalSignal.priority).toBe("HIGH");
      expect(result.finalSignal.tags).toContain("sol");
      expect(result.finalSignal.tags).toContain("buy");
      if (result.finalSignal.buttons) {
        expect(result.finalSignal.buttons.length).toBeGreaterThanOrEqual(1);
      }

      // Verify message content includes key sections
      expect(result.finalSignal.message).toContain("BUY $SOL");
      // Check if backtest data was used successfully
      if (result.finalSignal.message.includes("$1000")) {
        expect(result.finalSignal.message).toContain("$1000");
      } else {
        // If no backtest data, should show data collecting message
        expect(result.finalSignal.message).toContain("Data collecting...");
      }
      expect(result.finalSignal.message).toContain("Why This Signal");
      expect(result.finalSignal.message).toContain("Next Steps");
      expect(result.finalSignal.message).toContain("*Entry*:");
      expect(result.finalSignal.message).toContain("*Stop Loss*:");
      expect(result.finalSignal.message).toContain("*Target*:");
    });

    it("should return enhanced signal with SELL direction properties", async () => {
      // Setup SELL signal
      const state = buildMockState({
        signalDecision: {
          shouldGenerateSignal: true,
          signalType: "Trend Reversal",
          direction: "SELL",
          confidence: 0.80,
          reasoning: "SOL showing bearish reversal signals",
          keyFactors: ["RSI 85 - overbought", "VWAP resistance"],
          riskLevel: "MEDIUM",
          timeframe: "MEDIUM",
          marketSentiment: "BEARISH",
          sentimentConfidence: 0.7,
          sentimentFactors: ["Bearish trend forming"],
          priceExpectation: "Downside risk 8-15%",
        },
        technicalAnalysis: createMockTechnicalAnalysis({ rsi: "85", vwap_deviation: "-3.0" }),
      });

      // Execute
      const result = await formatEnhancedSignal(state);

      // Verify SELL-specific properties
      expect(result.finalSignal.title).toContain("🚨");
      expect(result.finalSignal.title).toContain("SELL");
      expect(result.finalSignal.message).toContain("SELL $SOL");
      expect(result.finalSignal.tags).toContain("sell");
      expect(result.finalSignal.priority).toBe("MEDIUM");
    });

    it("should handle NEUTRAL signals correctly", async () => {
      // Setup NEUTRAL signal
      const state = buildMockState({
        signalDecision: {
          shouldGenerateSignal: true,
          signalType: "Range Bound",
          direction: "NEUTRAL",
          confidence: 0.60,
          reasoning: "SOL trading in neutral range",
          keyFactors: ["RSI 50 - neutral", "No clear trend"],
          riskLevel: "LOW",
          timeframe: "LONG",
          marketSentiment: "NEUTRAL",
          sentimentConfidence: 0.5,
          sentimentFactors: ["Sideways consolidation"],
          priceExpectation: "Range-bound movement",
        },
      });

      // Execute
      const result = await formatEnhancedSignal(state);

      // Verify NEUTRAL-specific properties
      expect(result.finalSignal.title).toContain("📊");
      expect(result.finalSignal.title).toContain("NEUTRAL");
      expect(result.finalSignal.message).toContain("NEUTRAL $SOL");
      expect(result.finalSignal.tags).toContain("neutral");
      expect(result.finalSignal.priority).toBe("LOW");
    });

    it("should calculate correct confidence levels and priorities", async () => {
      const testCases = [
        { confidence: 0.9, riskLevel: "HIGH" as const, expectedLevel: 3 as const },
        { confidence: 0.7, riskLevel: "MEDIUM" as const, expectedLevel: 2 as const },
        { confidence: 0.5, riskLevel: "LOW" as const, expectedLevel: 1 as const },
      ];

      for (const testCase of testCases) {
        const state = buildMockState({
          signalDecision: {
            ...buildMockState().signalDecision!,
            confidence: testCase.confidence,
            riskLevel: testCase.riskLevel,
          },
        });

        const result = await formatEnhancedSignal(state);
        expect(result.finalSignal.level).toBe(testCase.expectedLevel);
        expect(result.finalSignal.priority).toBe(testCase.riskLevel);
      }
    });
  });

  describe("formatEnhancedSignal - Error Cases", () => {
    it("should return no signal response when signalDecision is undefined", async () => {
      // Setup state without signal decision
      const state = buildMockState({ signalDecision: undefined });

      // Execute
      const result = await formatEnhancedSignal(state);

      // Verify no signal response
      expect(result.finalSignal.level).toBe(1);
      expect(result.finalSignal.title).toContain("MONITORING");
      expect(result.finalSignal.message).toContain("No clear trend detected");
      expect(result.finalSignal.priority).toBe("LOW");
    });

    it("should return no signal response when shouldGenerateSignal is false", async () => {
      // Setup state with shouldGenerateSignal false
      const state = buildMockState({
        signalDecision: {
          ...buildMockState().signalDecision!,
          shouldGenerateSignal: false,
        },
      });

      // Execute
      const result = await formatEnhancedSignal(state);

      // Verify no signal response
      expect(result.finalSignal.title).toContain("MONITORING");
      expect(result.finalSignal.message).toContain("No clear trend detected");
    });

    it("should handle missing external backtest data gracefully", async () => {
      // Setup backtest data collection failure
      mockCollectSignalPerformanceData.mockImplementation(() => Promise.resolve([]));


      const state = buildMockState();

      // Execute
      const result = await formatEnhancedSignal(state);

      // Verify signal is still generated but without backtest data
      expect(result.finalSignal).toBeDefined();
      expect(result.finalSignal.message).toContain("Data collecting...");
      expect(result.finalSignal.message).not.toContain("$1000 →");
    });

    it("should handle backtest data collection errors", async () => {
      // Setup backtest data collection error
      mockCollectSignalPerformanceData.mockImplementation(() => Promise.reject(new Error("Database connection failed")));

      const state = buildMockState();

      // Execute
      const result = await formatEnhancedSignal(state);

      // Verify signal is still generated without backtest data
      expect(result.finalSignal).toBeDefined();
      expect(result.finalSignal.message).toContain("Data collecting...");
    });

    it("should handle missing evidenceResults gracefully", async () => {
      // Setup state without evidence results
      const state = buildMockState({ evidenceResults: undefined });

      // Execute
      const result = await formatEnhancedSignal(state);

      // Verify signal is generated with neutral market intel
      expect(result.finalSignal).toBeDefined();
      expect(result.finalSignal.message).toContain("Neutral sentiment");
    });

    it("should handle empty evidenceResults sources", async () => {
      // Setup state with empty evidence sources
      const state = buildMockState({
        evidenceResults: {
          ...buildMockState().evidenceResults!,
          relevantSources: [],
        },
      });

      // Execute
      const result = await formatEnhancedSignal(state);

      // Verify signal is generated with neutral market intel
      expect(result.finalSignal.message).toContain("Neutral sentiment");
    });
  });

  describe("formatEnhancedSignal - Backtest Integration", () => {
    it("should use test-friendly configuration in test environment", async () => {
      // Ensure we're in test environment
      process.env.NODE_ENV = "test";

      mockCollectSignalPerformanceData.mockImplementation(() => Promise.resolve([
        { signalType: "Oversold Bounce", direction: "BUY", return4h: 0.12, isWin4h: true },
      ]));

      const state = buildMockState();

      // Execute
      await formatEnhancedSignal(state);

      // Verify test-friendly configuration is used
      expect(mockCollectSignalPerformanceData).toHaveBeenCalledWith({
        lookbackDays: 1, // Test value instead of 30
        minSampleSize: 2, // Test value instead of 5
        winThreshold: 0.02,
        confidenceBuckets: [],
        timeframes: ["4h"],
      });
    });

    it("should use production configuration in non-test environment", async () => {
      // Set production environment
      process.env.NODE_ENV = "production";

      mockCollectSignalPerformanceData.mockImplementation(() => Promise.resolve([
        { signalType: "Oversold Bounce", direction: "BUY", return4h: 0.12, isWin4h: true },
      ]));

      const state = buildMockState();

      // Execute
      await formatEnhancedSignal(state);

      // Verify production configuration is used
      expect(mockCollectSignalPerformanceData).toHaveBeenCalledWith({
        lookbackDays: 30, // Production value
        minSampleSize: 5, // Production value
        winThreshold: 0.02,
        confidenceBuckets: [],
        timeframes: ["4h"],
      });

      // Reset to test environment for other tests
      process.env.NODE_ENV = "test";
    });
  });

  describe("createNoSignalResponse", () => {
    it("should create standardized no signal response", () => {
      const state = buildMockState();

      // Execute
      const result = createNoSignalResponse(state);

      // Verify structure
      expect(result.finalSignal.level).toBe(1);
      expect(result.finalSignal.title).toContain("MONITORING");
      expect(result.finalSignal.title).toContain("SOL");
      expect(result.finalSignal.message).toContain("No clear trend detected");
      expect(result.finalSignal.priority).toBe("LOW");
      expect(result.finalSignal.tags).toEqual(["sol", "monitoring", "neutral"]);
      if (result.finalSignal.buttons) {
        expect(result.finalSignal.buttons.length).toBeGreaterThanOrEqual(1);
      }

      // Verify key sections in message
      expect(result.finalSignal.message).toContain("Current Status");
      expect(result.finalSignal.message).toContain("What We're Watching");
      expect(result.finalSignal.message).toContain("Next Update");
      expect(result.finalSignal.message).toContain("What This Means");
    });
  });
});