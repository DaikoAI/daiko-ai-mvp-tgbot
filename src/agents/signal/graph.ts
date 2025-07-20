import { START, StateGraph } from "@langchain/langgraph";
import { logger } from "../../utils/logger";
import { formatSignalRouter, llmAnalysisRouter, staticFilterRouter } from "./graph-route";
import { signalGraphState } from "./graph-state";
import { analyzeLLMSignal } from "./nodes/llm-analysis";
import { formatSignal } from "./nodes/signal-formatter";
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
    .addNode("llm_analysis", analyzeLLMSignal)
    .addNode("format_signal", formatSignal)

    // エッジ定義
    .addEdge(START, "static_filter")
    .addConditionalEdges("static_filter", staticFilterRouter)
    .addConditionalEdges("llm_analysis", llmAnalysisRouter)
    .addConditionalEdges("format_signal", formatSignalRouter);

  const graph = workflow.compile();

  return { graph };
};

/**
 * Signal Generator実行関数
 *
 * cronタスクから呼び出されるメイン関数
 * テクニカル分析結果からトレーディングシグナルを生成
 */
export const generateSignal = async (input: {
  tokenAddress: string;
  tokenSymbol: string;
  currentPrice: number;
  technicalAnalysis: any;
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
