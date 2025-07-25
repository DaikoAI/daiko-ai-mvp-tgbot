import { START, StateGraph } from "@langchain/langgraph";
import type { TechnicalAnalysis } from "../../db/schema/technical-analysis";
import { logger } from "../../utils/logger";
import { dataFetchRouter, formatSignalRouter, llmAnalysisRouter, staticFilterRouter } from "./graph-route";
import { signalGraphState } from "./graph-state";
import { fetchDataSources } from "./nodes/data-fetch";
import { formatEnhancedSignal } from "./nodes/enhanced-signal-formatter";
import { analyzeLLMSignal } from "./nodes/llm-analysis";
import { applyStaticFilter } from "./nodes/static-filter";

/**
 * Initialize Signal Graph
 *
 * テスト用に Signal Graph を初期化する関数
 * エージェントとconfigオブジェクトを返す
 */
export const initSignalGraph = () => {
  const workflow = new StateGraph(signalGraphState)
    // ノード定義
    .addNode("static_filter", applyStaticFilter)
    .addNode("data_fetch", fetchDataSources)
    .addNode("llm_analysis", analyzeLLMSignal)
    .addNode("format_signal", formatEnhancedSignal)

    // エッジ定義
    .addEdge(START, "static_filter")
    .addConditionalEdges("static_filter", staticFilterRouter)
    .addConditionalEdges("data_fetch", dataFetchRouter)
    .addConditionalEdges("llm_analysis", llmAnalysisRouter)
    .addConditionalEdges("format_signal", formatSignalRouter);

  const graph = workflow.compile();

  return { graph };
};

/**
 * Generate Signal using compiled graph
 */
export const generateSignal = async (input: {
  tokenAddress: string;
  tokenSymbol: string;
  currentPrice: number;
  technicalAnalysis: TechnicalAnalysis;
}) => {
  logger.info("Starting signal generation", {
    tokenAddress: input.tokenAddress,
    tokenSymbol: input.tokenSymbol,
    currentPrice: input.currentPrice,
  });

  try {
    const { graph } = initSignalGraph();

    const result = await graph.invoke({
      tokenAddress: input.tokenAddress,
      tokenSymbol: input.tokenSymbol,
      currentPrice: input.currentPrice,
      technicalAnalysis: input.technicalAnalysis,
    });

    logger.info("Signal generation completed", {
      tokenAddress: input.tokenAddress,
      hasSignal: result.finalSignal?.level > 0,
      signalLevel: result.finalSignal?.level,
      priority: result.finalSignal?.priority,
    });

    return result;
  } catch (error) {
    logger.error("Signal generation failed", {
      tokenAddress: input.tokenAddress,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
};
