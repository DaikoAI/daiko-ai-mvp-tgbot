import { desc, eq } from "drizzle-orm";
import { generateSignal } from "./agents/signal/graph";
import { OHLCV_RETENTION } from "./constants/database";
import { isExcludedToken } from "./constants/signal-cooldown";
import { tokenOHLCV } from "./db";
import { createPhantomButtons } from "./lib/phantom";
import { shouldSkipDueToCooldown } from "./lib/signal-cooldown";
import { calculateTechnicalIndicators, convertTAtoDbFormat, type OHLCVData } from "./lib/ta";
import { getTACache } from "./lib/ta-cache";
import { sendMessage } from "./lib/telegram/utils";
import { fetchMultipleTokenOHLCV } from "./lib/vybe";
import { escapeMarkdown } from "./utils";
import {
  batchUpsert,
  cleanupAllTokensOHLCVByCount,
  createSignal,
  createTechnicalAnalysis,
  getRecentSignals,
  getTokenOHLCV,
  getTokens,
  getTokenSymbol,
  getUnprocessedTechnicalAnalyses,
  getUsersHoldingToken,
  markTechnicalAnalysisAsProcessed,
  syncAllUserTokenHoldings,
} from "./utils/db";
import { logger } from "./utils/logger";
import { safeParseFloat } from "./utils/number";

// every 5 minutes
export const runCronTasks = async () => {
  const start = new Date();
  logger.info(`cron start: ${start.toISOString()}`);

  // 1. トークンのOHLCVデータを更新
  await updateTokenOHLCVTask();

  // 2. テクニカル分析を実行
  await technicalAnalysisTask();

  // 3. シグナルを生成
  await generateSignalTask();

  // 4. シグナルをTelegramに送信
  await sendSignalToTelegram();

  // 5. ユーザーのトークン保有状況を同期
  await syncUserTokenHoldingsTask();

  // 1時間おきにクリーンアップを実行（5分間隔のcronが12回実行されるごと）
  if (start.getMinutes() === 0) {
    await cleanupOHLCVTask();
  }

  logger.info(`cron end: ${new Date().toISOString()}`);
};

const updateTokenOHLCVTask = async () => {
  const tokens = await getTokens();
  const tokenAddresses = tokens.map((t) => t.address);
  const result = await fetchMultipleTokenOHLCV(tokenAddresses, "5m");

  if (!result.isOk()) {
    logger.error("Failed to fetch OHLCV data", result.error);
    return;
  }

  const ohlcvValues = Object.entries(result.value).flatMap(([mintAddress, tokenResponse]) => {
    // 全てのOHLCVデータを処理（配列全体）
    return tokenResponse.map((ohlcvData) => ({
      token: mintAddress,
      timestamp: ohlcvData.time,
      open: ohlcvData.open,
      high: ohlcvData.high,
      low: ohlcvData.low,
      close: ohlcvData.close,
      volume: ohlcvData.volume,
    }));
  });

  if (ohlcvValues.length === 0) {
    logger.error("No OHLCV data found");
    return;
  }

  // 汎用batchUpsert関数を使用して効率的に処理
  await batchUpsert(tokenOHLCV, ohlcvValues, {
    conflictTarget: ["token", "timestamp"],
    updateFields: ["open", "high", "low", "close", "volume"],
  });
};

const technicalAnalysisTask = async () => {
  logger.info("Starting 6-indicator practical analysis task");

  const tokens = await getTokens();
  logger.info(`Analyzing ${tokens.length} tokens with practical trading indicators`);

  // テクニカル分析キャッシュのインスタンスを取得
  const cache = getTACache();

  const analysisPromises = tokens.map(async (token) => {
    // Check if token should be excluded from analysis
    const exclusionCheck = isExcludedToken(token.address);
    if (exclusionCheck.excluded) {
      logger.info(`Skipping technical analysis for excluded token: ${token.symbol}`, {
        tokenAddress: token.address,
        tokenSymbol: token.symbol,
        exclusionReason: exclusionCheck.reason,
      });
      return null;
    }

    // 最新100件のOHLCVデータを取得（テクニカル分析には十分なデータが必要）
    const ohlcvData = await getTokenOHLCV(token.address, 100);

    if (ohlcvData.length < 50) {
      logger.info(`Insufficient data for ${token.symbol}`, {
        dataLength: ohlcvData.length,
      });
      return null;
    }

    // OHLCVデータを数値に変換
    const numericData: OHLCVData[] = ohlcvData.map((d) => ({
      timestamp: d.timestamp,
      open: parseFloat(d.open),
      high: parseFloat(d.high),
      low: parseFloat(d.low),
      close: parseFloat(d.close),
      volume: parseFloat(d.volume),
    }));

    // 実戦的テクニカル指標を計算
    const analysis = calculateTechnicalIndicators(numericData);
    if (!analysis) {
      logger.info(`Failed to calculate practical indicators for ${token.symbol}`);
      return null;
    }

    // 最新の価格とタイムスタンプを取得
    const latestData = numericData[numericData.length - 1];
    const currentPrice = latestData.close;
    const currentTimestamp = latestData.timestamp;

    // 6指標の詳細値をログ出力（デバッグ用）
    logger.debug(`6-Indicator Analysis for ${token.symbol}`, {
      token: token.symbol,
      price: currentPrice.toFixed(6),
      vwap: analysis.vwap?.toFixed(6),
      vwapDeviation: analysis.vwapDeviation?.toFixed(2) + "%",
      obvZScore: analysis.obvZScore?.toFixed(1) + "σ",
      percentB: analysis.percentB?.toFixed(2),
      atrPercent: analysis.atrPercent?.toFixed(1) + "%",
      adx: analysis.adx?.toFixed(0),
      adxDirection: analysis.adxDirection,
      rsi: analysis.rsi?.toFixed(0),
    });

    // 分析結果をキャッシュに保存（次回実行時のため）
    cache.setCachedAnalysis(token.address, analysis, currentPrice, currentTimestamp);

    return {
      token,
      analysis,
      currentPrice,
      currentTimestamp,
    };
  });

  // 全トークンの分析を並行実行
  const results = await Promise.allSettled(analysisPromises);
  const successfulResults = results
    .filter(
      (result): result is PromiseFulfilledResult<NonNullable<Awaited<(typeof analysisPromises)[0]>>> =>
        result.status === "fulfilled" && result.value !== null,
    )
    .map((result) => result.value);

  if (successfulResults.length === 0) {
    logger.warn("No successful practical analysis results");
    return;
  }

  // テクニカル分析結果をデータベースに保存
  const analysisData = successfulResults.map((result) =>
    convertTAtoDbFormat(result.token.address, result.currentTimestamp, result.analysis),
  );

  if (analysisData.length === 0) {
    logger.error("No practical analysis data to save");
    return;
  }

  await createTechnicalAnalysis(analysisData);
};

/**
 * 個別トークンのシグナル生成処理
 * 各言語で個別にシグナルを生成し、複数のシグナルレコードを保存
 */
const processTokenSignal = async (analysis: any) => {
  // トークン情報を取得
  const { tokens, tokenOHLCV, getDB } = await import("./db");

  const db = getDB();

  const tokenInfo = await db.select().from(tokens).where(eq(tokens.address, analysis.token)).limit(1);

  if (tokenInfo.length === 0) {
    logger.warn("Token not found", { tokenAddress: analysis.token });
    return null;
  }

  const token = tokenInfo[0];

  // 現在価格を取得（最新のOHLCVから）
  const latestOHLCV = await db
    .select()
    .from(tokenOHLCV)
    .where(eq(tokenOHLCV.token, analysis.token))
    .orderBy(desc(tokenOHLCV.timestamp))
    .limit(1);

  if (latestOHLCV.length === 0) {
    logger.warn("No OHLCV data found", { tokenAddress: analysis.token });
    return null;
  }

  const currentPrice = parseFloat(latestOHLCV[0].close);

  // このトークンを保有しているユーザーの言語を取得
  const holdingUsers = await getUsersHoldingToken(analysis.token);
  if (holdingUsers.length === 0) {
    logger.info("No users holding token, skipping signal generation", {
      tokenAddress: analysis.token,
    });
    // 処理済みフラグを設定
    await markTechnicalAnalysisAsProcessed(analysis.id);
    return null;
  }

  // 必要な言語を抽出（重複排除）
  const requiredLanguages = [...new Set(holdingUsers.map((user) => user.language || "en"))];

  logger.info("Starting multi-language signal generation for token", {
    tokenAddress: analysis.token,
    tokenSymbol: token.symbol,
    currentPrice,
    requiredLanguages,
    totalUsers: holdingUsers.length,
  });

  const generatedSignals = [];

  // 各言語でシグナルを生成
  for (const language of requiredLanguages) {
    try {
      logger.info("Generating signal for language", {
        tokenAddress: analysis.token,
        language,
        tokenSymbol: token.symbol,
      });

      const result = await generateSignal({
        tokenAddress: analysis.token,
        tokenSymbol: token.symbol,
        currentPrice,
        technicalAnalysis: analysis,
        userLanguage: language, // 言語を指定してシグナル生成
      });

      // シグナルが生成されなかった場合はこの言語をスキップ
      if (!result.finalSignal || result.finalSignal.level < 1) {
        logger.info("No signal generated for language", {
          tokenAddress: analysis.token,
          tokenSymbol: token.symbol,
          language,
          hasResult: !!result,
          hasFinalSignal: !!result.finalSignal,
          signalLevel: result.finalSignal?.level,
        });
        continue;
      }

      // 言語別のシグナルIDを生成
      const signalId = `signal_${analysis.token}_${language}_${Date.now()}`;

      const createdSignal = await createSignal({
        id: signalId,
        token: analysis.token,
        signalType: result.signalDecision?.signalType || "TECHNICAL_ALERT",
        title: result.finalSignal.title,
        body: result.finalSignal.message,
        direction: result.signalDecision?.direction || "NEUTRAL",
        confidence: result.signalDecision?.confidence?.toString() || "0",
        explanation: result.signalDecision?.reasoning || "",
        timestamp: new Date(),
        value: {
          level: result.finalSignal.level,
          priority: result.finalSignal.priority,
          tags: result.finalSignal.tags,
          technicalAnalysisId: analysis.id,
          staticFilterResult: result.staticFilterResult,
          buttons: result.finalSignal.buttons || [],
          language, // 言語情報を保存
        },
      });

      generatedSignals.push({
        signalId: createdSignal.id,
        token: token.symbol,
        language,
        message: result.finalSignal.message,
      });

      logger.info("Signal generated and saved for language", {
        signalId: createdSignal.id,
        tokenAddress: analysis.token,
        tokenSymbol: token.symbol,
        language,
        signalType: result.signalDecision?.signalType,
        level: result.finalSignal.level,
        priority: result.finalSignal.priority,
      });
    } catch (error) {
      logger.error("Failed to generate signal for language", {
        tokenAddress: analysis.token,
        language,
        error: error instanceof Error ? error.message : String(error),
      });
      // エラーが発生してもother languagesの処理を続行
      continue;
    }
  }

  // 処理済みフラグを設定
  await markTechnicalAnalysisAsProcessed(analysis.id);

  if (generatedSignals.length === 0) {
    logger.warn("No signals generated for any language", {
      tokenAddress: analysis.token,
      tokenSymbol: token.symbol,
      requiredLanguages,
    });
    return null;
  }

  logger.info("Multi-language signal generation completed", {
    tokenAddress: analysis.token,
    tokenSymbol: token.symbol,
    totalLanguages: requiredLanguages.length,
    successfulSignals: generatedSignals.length,
    generatedLanguages: generatedSignals.map((s) => s.language),
  });

  return {
    tokenAddress: analysis.token,
    tokenSymbol: token.symbol,
    signals: generatedSignals,
  };
};

const generateSignalTask = async () => {
  logger.info("Starting signal generation task");

  try {
    // 処理済みでない技術分析データを取得
    const unprocessedAnalyses = await getUnprocessedTechnicalAnalyses(10);

    if (unprocessedAnalyses.length === 0) {
      logger.info("No unprocessed technical analysis data found for signal generation");
      return;
    }

    logger.info(`Found ${unprocessedAnalyses.length} unprocessed technical analyses`);

    // 各トークンに対してシグナル生成を並列実行
    const signalPromises = unprocessedAnalyses.map(async (analysis) => {
      try {
        // Convert technical analysis to required format with robust validation
        const technicalAnalysisResult = {
          atrPercent: safeParseFloat(analysis.atr_percent),
          adx: safeParseFloat(analysis.adx),
          rsi: safeParseFloat(analysis.rsi),
          vwap: safeParseFloat(analysis.vwap),
          vwapDeviation: safeParseFloat(analysis.vwap_deviation),
          obv: safeParseFloat(analysis.obv),
          obvZScore: safeParseFloat(analysis.obv_zscore),
          percentB: safeParseFloat(analysis.percent_b),
          bbWidth: safeParseFloat(analysis.bb_width),
          atr: safeParseFloat(analysis.atr),
          adxDirection: (analysis.adx_direction as "UP" | "DOWN" | "NEUTRAL") || "NEUTRAL",
        };

        // Validate that we have sufficient valid indicators for reliable analysis
        const validIndicators = Object.values(technicalAnalysisResult).filter(
          (val) => val !== null && val !== undefined && !isNaN(val as number),
        ).length;

        if (validIndicators < 3) {
          logger.warn("Insufficient valid technical indicators for signal generation", {
            tokenAddress: analysis.token,
            validIndicators,
            totalIndicators: Object.keys(technicalAnalysisResult).length,
            rsi: analysis.rsi,
            adx: analysis.adx,
            atrPercent: analysis.atr_percent,
            percentB: analysis.percent_b,
          });
          // Mark as processed to avoid reprocessing
          await markTechnicalAnalysisAsProcessed(analysis.id);
          return null;
        }

        // Check if signal generation should be skipped due to cooldown
        if (await shouldSkipDueToCooldown(analysis.token, technicalAnalysisResult)) {
          logger.info("Skipping signal generation due to cooldown", {
            tokenAddress: analysis.token,
            atrPercent: technicalAnalysisResult.atrPercent,
            adx: technicalAnalysisResult.adx,
            rsi: technicalAnalysisResult.rsi,
          });
          // Mark as processed to avoid reprocessing
          await markTechnicalAnalysisAsProcessed(analysis.id);
          return null;
        }

        return await processTokenSignal(analysis);
      } catch (error) {
        logger.error("Signal generation failed for token", {
          tokenAddress: analysis.token,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    });

    // 並列実行して結果を取得
    const results = await Promise.all(signalPromises);
    const generatedSignals = results.filter((result) => result !== null);

    // 生成されたシグナルの統計を計算
    const totalSignals = generatedSignals.reduce((sum, result) => sum + (result.signals?.length || 0), 0);

    logger.info("Signal generation task completed", {
      totalAnalyzed: unprocessedAnalyses.length,
      tokensProcessed: generatedSignals.length,
      totalSignalsGenerated: totalSignals,
      signalsByToken: generatedSignals.map((result) => ({
        tokenAddress: result.tokenAddress,
        tokenSymbol: result.tokenSymbol,
        signalCount: result.signals?.length || 0,
        languages: result.signals?.map((s) => s.language) || [],
      })),
    });
  } catch (error) {
    logger.error("Signal generation task failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const sendSignalToTelegram = async () => {
  logger.info("Starting signal-to-telegram task");

  try {
    const recentSignals = await getRecentSignals();

    if (recentSignals.length === 0) {
      logger.info("No recent signals found");
      return;
    }

    logger.info(`Processing ${recentSignals.length} recent signals in parallel`);

    // 各シグナルの処理を並列実行
    const signalPromises = recentSignals.map(async (signalData) => {
      try {
        const holdingUsers = await getUsersHoldingToken(signalData.token);

        if (holdingUsers.length === 0) {
          logger.info(`No users holding token, skipping signal ${signalData.id}`);
          return { signalId: signalData.id, skipped: true };
        }

        logger.info(`Sending signal ${signalData.id} to ${holdingUsers.length} users holding token`);

        // Get token symbol for button generation
        const tokenSymbol = await getTokenSymbol(signalData.token);

        // Get signal language from the stored signal data
        const signalLanguage = (signalData.value as any)?.language || "en";

        // Filter users to only those who match this signal's language
        const matchingUsers = holdingUsers.filter((user) => (user.language || "en") === signalLanguage);

        if (matchingUsers.length === 0) {
          logger.info(`No users for signal language ${signalLanguage}, skipping signal ${signalData.id}`);
          return { signalId: signalData.id, skipped: true };
        }

        logger.info(`Sending signal ${signalData.id} in ${signalLanguage} to ${matchingUsers.length} users`, {
          signalId: signalData.id,
          language: signalLanguage,
          userCount: matchingUsers.length,
        });

        // Generate buttons for this signal
        const buttons = createPhantomButtons(signalData.token, tokenSymbol || undefined);

        const result = await sendMessage(
          matchingUsers.map((u) => u.userId),
          escapeMarkdown(signalData.body),
          {
            parse_mode: "Markdown",
            buttons,
          },
        );

        if (!result.isOk()) {
          logger.error(`Failed to send signal ${signalData.id} due to system error`, {
            error: result.error,
            signalId: signalData.id,
            tokenAddress: signalData.token,
            language: signalLanguage,
            userCount: matchingUsers.length,
          });
          return { signalId: signalData.id, success: false, systemError: true, stats: null };
        }

        const stats = result.value;

        logger.info(`Signal ${signalData.id} sent successfully`, {
          signalId: signalData.id,
          tokenAddress: signalData.token,
          language: signalLanguage,
          totalUsers: stats.totalUsers,
          successCount: stats.successCount,
          failureCount: stats.failureCount,
        });

        return {
          signalId: signalData.id,
          success: true,
          systemError: false,
          stats,
        };
      } catch (error) {
        logger.error(`Failed to process signal ${signalData.id}`, {
          error: error instanceof Error ? error.message : String(error),
          signalId: signalData.id,
          tokenAddress: signalData.token,
        });
        return { signalId: signalData.id, success: false, systemError: true, stats: null };
      }
    });

    // 並列実行した結果を取得
    const results = await Promise.all(signalPromises);
    const successfulSends = results.filter((r) => r.success && !r.systemError);
    const failedSends = results.filter((r) => !r.success || r.systemError);
    const skippedSignals = results.filter((r) => "skipped" in r && r.skipped);

    logger.info("Signal-to-telegram task completed", {
      totalSignals: recentSignals.length,
      successfulSends: successfulSends.length,
      failedSends: failedSends.length,
      skippedSignals: skippedSignals.length,
      totalUsersSent: successfulSends.reduce((sum, r) => sum + (r.stats?.totalUsers || 0), 0),
      totalSuccessful: successfulSends.reduce((sum, r) => sum + (r.stats?.successCount || 0), 0),
      totalFailed: successfulSends.reduce((sum, r) => sum + (r.stats?.failureCount || 0), 0),
    });
  } catch (error) {
    logger.error("Signal-to-telegram task failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * OHLCVデータのクリーンアップタスク
 * 各トークンごとに最新500件のデータのみを保持し、古いデータを削除する
 */
const cleanupOHLCVTask = async () => {
  logger.info("Starting OHLCV data cleanup");

  try {
    // 定数から保持件数を取得
    await cleanupAllTokensOHLCVByCount(OHLCV_RETENTION.MAX_RECORDS_PER_TOKEN);

    logger.info(
      `Successfully completed OHLCV data cleanup, keeping ${OHLCV_RETENTION.MAX_RECORDS_PER_TOKEN} records per token`,
    );
  } catch (error) {
    logger.error("Failed to cleanup OHLCV data", error);
  }
};

/**
 * ユーザーのトークン保有状況を同期するタスク
 * 全ユーザーのトークン保有状況をHelius APIから取得して更新する
 */
const syncUserTokenHoldingsTask = async () => {
  logger.info("Starting user token holdings synchronization");

  try {
    const result = await syncAllUserTokenHoldings();

    logger.info("Successfully completed user token holdings synchronization", {
      totalUsers: result.totalUsers,
      successCount: result.successCount,
      failureCount: result.failureCount,
      successRate: result.totalUsers > 0 ? ((result.successCount / result.totalUsers) * 100).toFixed(1) + "%" : "0%",
    });
  } catch (error) {
    logger.error("Failed to sync user token holdings", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
