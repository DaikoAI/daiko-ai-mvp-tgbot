import { END } from "@langchain/langgraph";
import type { SignalGraphState } from "./graph-state";

/**
 * Signal Generator Router
 *
 * シグナル生成プロセスの各ステップ間のルーティングを管理
 * 状態に基づいて次に実行すべきノードを決定
 */
export const signalRouter = (
  state: SignalGraphState,
): "static_filter" | "llm_analysis" | "format_signal" | typeof END => {
  // Static Filter未実行の場合
  if (!state.staticFilterResult) {
    return "static_filter";
  }

  // LLM Analysis未実行の場合
  if (!state.signalDecision) {
    return "llm_analysis";
  }

  // Signal Formatting未実行の場合
  if (!state.finalSignal) {
    return "format_signal";
  }

  // 全ステップ完了
  return END;
};

/**
 * Static Filter後のルーティング
 * フィルタ結果に基づいてdata fetch実行可否を判定
 */
export const staticFilterRouter = (state: SignalGraphState): "data_fetch" | typeof END => {
  if (!state.staticFilterResult) {
    throw new Error("Static filter result not found");
  }

  // 静的フィルタを通過した場合のみdata fetchを実行
  if (state.staticFilterResult.shouldProceed) {
    return "data_fetch";
  }

  // フィルタで除外された場合は終了
  return END;
};

/**
 * Data Fetch後のルーティング
 * data fetch結果に基づいてLLM分析の実行可否を判定
 */
export const dataFetchRouter = (state: SignalGraphState): "llm_analysis" | typeof END => {
  if (!state.evidenceResults) {
    throw new Error("Evidence results not found");
  }

  // searchStrategyに基づいてLLM分析の実行を決定
  if (state.evidenceResults.searchStrategy === "FUNDAMENTAL_SEARCH" || state.evidenceResults.searchStrategy === "FAILED") {
    return "llm_analysis";
  }

  // SKIPの場合は終了
  return END;
};

/**
 * LLM Analysis後のルーティング
 * 分析結果に基づいてフォーマット処理の実行可否を判定
 */
export const llmAnalysisRouter = (state: SignalGraphState): "format_signal" | typeof END => {
  if (!state.signalDecision) {
    throw new Error("Signal decision not found");
  }

  // シグナル生成が決定された場合のみフォーマット処理を実行
  if (state.signalDecision.shouldGenerateSignal) {
    return "format_signal";
  }

  // シグナル生成不要の場合は終了
  return END;
};

/**
 * Format Signal後のルーティング
 * フォーマット完了後は常に終了
 */
export const formatSignalRouter = (_state: SignalGraphState): typeof END => {
  return END;
};
