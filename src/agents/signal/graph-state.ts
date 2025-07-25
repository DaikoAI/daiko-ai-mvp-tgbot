import { Annotation, MemorySaver } from "@langchain/langgraph";
import type { TechnicalAnalysis } from "../../db/schema/technical-analysis";

export const memory = new MemorySaver();

/**
 * Signal Generator Graph State
 *
 * シグナル生成プロセスの状態管理
 * - 入力データ（トークン情報、テクニカル分析結果）
 * - 各ステップの処理結果
 * - 最終的なシグナル出力
 */
export const signalGraphState = Annotation.Root({
  // === Input Data ===
  tokenAddress: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),

  tokenSymbol: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),

  currentPrice: Annotation<number>({
    reducer: (x, y) => y ?? x,
  }),

  technicalAnalysis: Annotation<TechnicalAnalysis>({
    reducer: (x, y) => y ?? x,
  }),

  // === Static Filter Results ===
  staticFilterResult: Annotation<{
    shouldProceed: boolean;
    triggeredIndicators: string[];
    signalCandidates: string[];
    confluenceScore: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
  }>({
    reducer: (x, y) => y ?? x,
  }),

  // === LLM Analysis Results ===
  signalDecision: Annotation<{
    shouldGenerateSignal: boolean;
    signalType: string;
    direction: "BUY" | "SELL" | "NEUTRAL";
    confidence: number;
    reasoning: string;
    keyFactors: string[];
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    timeframe: "SHORT" | "MEDIUM" | "LONG";
    marketSentiment: "BULLISH" | "BEARISH" | "NEUTRAL"; // Overall market sentiment based on news analysis
    sentimentConfidence: number; // Confidence level in sentiment analysis (0-1)
    sentimentFactors: string[]; // Key factors influencing market sentiment
    priceExpectation: string; // What might happen to price and why
  }>({
    reducer: (x, y) => y ?? x,
  }),

  // === Evidence Search Results (Tavily SDK) ===
  evidenceResults: Annotation<{
    relevantSources: Array<{
      title: string;
      url: string;
      content: string;
      score: number;
      domain: string;
      publishedDate?: string;
    }>;
    searchQueries: string[];
    totalResults: number;
    searchTime: number;
    qualityScore: number;
    searchStrategy: "BASIC" | "ADVANCED" | "SKIP" | "FAILED" | "RSS_NEWS" | "FUNDAMENTAL_SEARCH";
  }>({
    reducer: (x, y) => y ?? x,
  }),

  // === Final Output ===
  finalSignal: Annotation<{
    level: 1 | 2 | 3;
    title: string;
    message: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
    tags: string[];
    buttons?: Array<{
      text: string;
      url?: string;
      callback_data?: string;
    }>;
  }>({
    reducer: (x, y) => y ?? x,
  }),
});

export type SignalGraphState = typeof signalGraphState.State;
