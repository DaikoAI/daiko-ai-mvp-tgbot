import { RunnableSequence } from "@langchain/core/runnables";
import { logger } from "../../../utils/logger";
import { kimiK2 } from "../../model";
import type { SignalGraphState } from "../graph-state";
import { parser, signalAnalysisPrompt } from "../prompts/signal-analysis";

// Create runnable sequence with prompt, LLM, and parser
const chain = RunnableSequence.from([signalAnalysisPrompt, kimiK2, parser]);

/**
 * LLM Analysis Node (Original Implementation)
 *
 * 複合的なテクニカル指標分析によるシグナル生成判定
 * 静的フィルタを通過した場合のみ実行される
 */
export const analyzeLLMSignal = async (state: SignalGraphState) => {
  // 静的フィルタで除外された場合は早期リターン
  if (!state.staticFilterResult?.shouldProceed) {
    logger.info("Static filter rejected signal generation", {
      tokenAddress: state.tokenAddress,
      confluenceScore: state.staticFilterResult?.confluenceScore,
    });
    return null;
  }

  logger.info("Performing LLM signal analysis", {
    tokenAddress: state.tokenAddress,
    triggeredIndicators: state.staticFilterResult.triggeredIndicators,
  });

  try {
    const result = await chain.invoke({
      formatInstructions: parser.getFormatInstructions(),
      tokenSymbol: state.tokenSymbol,
      tokenAddress: state.tokenAddress,
      currentPrice: state.currentPrice.toString(),
      timestamp: new Date().toISOString(),
      rsi: state.technicalAnalysis.rsi?.toString() || "N/A",
      vwapDeviation: state.technicalAnalysis.vwap_deviation?.toString() || "N/A",
      percentB: state.technicalAnalysis.percent_b?.toString() || "N/A",
      adx: state.technicalAnalysis.adx?.toString() || "N/A",
      atrPercent: state.technicalAnalysis.atr_percent?.toString() || "N/A",
      obvZScore: state.technicalAnalysis.obv_zscore?.toString() || "N/A",
      triggeredIndicators: state.staticFilterResult.triggeredIndicators.join(", "),
      signalCandidates: state.staticFilterResult.signalCandidates.join(", "),
      confluenceScore: state.staticFilterResult.confluenceScore.toFixed(3),
      riskLevel: state.staticFilterResult.riskLevel,
    });

    logger.info("LLM signal analysis completed", {
      tokenAddress: state.tokenAddress,
      shouldGenerateSignal: result.shouldGenerateSignal,
      signalType: result.signalType,
      confidence: result.confidence,
    });

    return { signalDecision: result };
  } catch (error) {
    logger.error("LLM signal analysis failed", {
      tokenAddress: state.tokenAddress,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
};
