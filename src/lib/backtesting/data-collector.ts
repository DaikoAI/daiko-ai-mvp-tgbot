import { desc, sql } from "drizzle-orm";
import { getDB, signal, tokenOHLCV } from "../../db";
import { logger } from "../../utils/logger";
import type { BacktestConfig, SignalResult } from "./types";

/**
 * Collect historical signal performance data from database
 */
export const collectSignalPerformanceData = async (config: BacktestConfig): Promise<SignalResult[]> => {
  const db = getDB();
  const cutoffDate = new Date(Date.now() - config.lookbackDays * 24 * 60 * 60 * 1000);

  logger.info("Starting signal performance data collection", {
    lookbackDays: config.lookbackDays,
    cutoffDate: cutoffDate.toISOString(),
  });

  try {
    // Get all signals from the specified period
    const signals = await db
      .select()
      .from(signal)
      .where(sql`${signal.timestamp} >= ${cutoffDate}`)
      .orderBy(desc(signal.timestamp));

    logger.info(`Found ${signals.length} signals to analyze`);

    if (signals.length === 0) {
      return [];
    }

    // Process each signal to calculate performance
    const signalResults: SignalResult[] = [];
    const batchSize = 10;

    for (let i = 0; i < signals.length; i += batchSize) {
      const batch = signals.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(async (sig) => {
          try {
            return await calculateSignalPerformance(sig, config);
          } catch (error) {
            logger.warn("Failed to calculate performance for signal", {
              signalId: sig.id,
              error: error instanceof Error ? error.message : String(error),
            });
            return null;
          }
        }),
      );

      // Extract successful results
      const successfulResults = batchResults
        .filter(
          (result): result is PromiseFulfilledResult<SignalResult | null> =>
            result.status === "fulfilled" && result.value !== null,
        )
        .map((result) => result.value as SignalResult);

      signalResults.push(...successfulResults);

      // Log progress
      if (i % 50 === 0) {
        logger.info(`Processed ${Math.min(i + batchSize, signals.length)}/${signals.length} signals`);
      }
    }

    logger.info(`Successfully collected performance data for ${signalResults.length} signals`);
    return signalResults;
  } catch (error) {
    logger.error("Failed to collect signal performance data", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

/**
 * Calculate performance metrics for a single signal
 */
const calculateSignalPerformance = async (
  sig: typeof signal.$inferSelect,
  config: BacktestConfig,
): Promise<SignalResult | null> => {
  if (!sig.direction || !sig.confidence) {
    return null;
  }

  const signalTimestamp = Math.floor(sig.timestamp.getTime() / 1000);

  try {
    // Get entry price (closest OHLCV data to signal timestamp)
    const entryPriceData = await getClosestPrice(sig.token, signalTimestamp, 300); // 5 minutes tolerance
    if (!entryPriceData) {
      return null;
    }

    // Get exit prices for different timeframes
    const exitPrices = await Promise.all([
      getClosestPrice(sig.token, signalTimestamp + 3600, 1800), // 1h ± 30min
      getClosestPrice(sig.token, signalTimestamp + 14400, 3600), // 4h ± 1h
      getClosestPrice(sig.token, signalTimestamp + 86400, 7200), // 24h ± 2h
    ]);

    const [exitPrice1h, exitPrice4h, exitPrice24h] = exitPrices;

    // Calculate returns
    const return1h = exitPrice1h ? calculateReturn(entryPriceData.price, exitPrice1h.price, sig.direction) : null;
    const return4h = exitPrice4h ? calculateReturn(entryPriceData.price, exitPrice4h.price, sig.direction) : null;
    const return24h = exitPrice24h ? calculateReturn(entryPriceData.price, exitPrice24h.price, sig.direction) : null;

    // Determine wins based on threshold
    const isWin1h = return1h !== null ? return1h >= config.winThreshold : null;
    const isWin4h = return4h !== null ? return4h >= config.winThreshold : null;
    const isWin24h = return24h !== null ? return24h >= config.winThreshold : null;

    return {
      signalId: sig.id,
      tokenAddress: sig.token,
      direction: sig.direction as "BUY" | "SELL" | "NEUTRAL",
      confidence: parseFloat(sig.confidence),
      signalType: sig.signalType,
      timestamp: sig.timestamp,
      entryPrice: entryPriceData.price,
      exitPrice1h: exitPrice1h?.price || null,
      exitPrice4h: exitPrice4h?.price || null,
      exitPrice24h: exitPrice24h?.price || null,
      return1h,
      return4h,
      return24h,
      isWin1h,
      isWin4h,
      isWin24h,
    };
  } catch (error) {
    logger.warn("Error calculating signal performance", {
      signalId: sig.id,
      token: sig.token,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

/**
 * Get the closest price data to a target timestamp
 */
const getClosestPrice = async (
  tokenAddress: string,
  targetTimestamp: number,
  toleranceSeconds: number = 300,
): Promise<{ price: number; timestamp: number } | null> => {
  const db = getDB();

  try {
    const result = await db
      .select({
        close: tokenOHLCV.close,
        timestamp: tokenOHLCV.timestamp,
      })
      .from(tokenOHLCV)
      .where(
        sql`${tokenOHLCV.token} = ${tokenAddress}
            AND ${tokenOHLCV.timestamp} BETWEEN ${targetTimestamp - toleranceSeconds} AND ${targetTimestamp + toleranceSeconds}`,
      )
      .orderBy(sql`ABS(${tokenOHLCV.timestamp} - ${targetTimestamp})`)
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const priceData = result[0];
    if (!priceData) {
      return null;
    }

    const parsedPrice = parseFloat(priceData.close);
    if (isNaN(parsedPrice)) {
      logger.warn("Invalid price data encountered during parsing", {
        tokenAddress,
        invalidValue: priceData.close,
        timestamp: priceData.timestamp,
      });
      return null;
    }

    return {
      price: parsedPrice,
      timestamp: priceData.timestamp,
    };
  } catch (error) {
    logger.warn("Failed to get closest price", {
      tokenAddress,
      targetTimestamp,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

/**
 * Calculate return based on direction
 */
const calculateReturn = (entryPrice: number, exitPrice: number, direction: string): number => {
  if (entryPrice === 0) {
    logger.warn("Entry price is zero, cannot calculate return");
    return 0;
  }

  if (direction === "BUY") {
    return (exitPrice - entryPrice) / entryPrice;
  } else if (direction === "SELL") {
    return (entryPrice - exitPrice) / entryPrice;
  } else {
    // NEUTRAL - measure absolute price change
    return Math.abs(exitPrice - entryPrice) / entryPrice;
  }
};

/**
 * Filter signal results by timeframe for analysis
 */
export const filterSignalsByTimeframe = (signals: SignalResult[], timeframe: "1h" | "4h" | "24h"): SignalResult[] => {
  return signals.filter((signal) => {
    switch (timeframe) {
      case "1h":
        return signal.return1h !== null && signal.isWin1h !== null;
      case "4h":
        return signal.return4h !== null && signal.isWin4h !== null;
      case "24h":
        return signal.return24h !== null && signal.isWin24h !== null;
      default:
        return false;
    }
  });
};
