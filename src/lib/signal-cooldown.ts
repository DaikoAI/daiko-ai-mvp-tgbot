import {
    COOLDOWN_CONFIG,
    MARKET_CONDITIONS,
    SIGNAL_STRENGTH,
    type MarketCondition,
    type SignalStrengthLevel
} from "../constants/signal-cooldown";
import { logger } from "../utils/logger";
import type { TechnicalAnalysisResult } from "./ta";

/**
 * Calculate smart cooldown period based on volatility and trend strength
 * @param analysis Technical analysis result containing ATR, ADX, RSI
 * @param signalConfidence Signal confidence score (0.0 - 1.0)
 * @returns Cooldown period in minutes
 */
export const calculateSmartCooldown = (
  analysis: TechnicalAnalysisResult,
  signalConfidence: number = 0.5
): number => {
  const { atrPercent = 2, adx = 20, rsi = 50 } = analysis;

  try {
    // 1. Calculate volatility factor (inverse relationship with ATR)
    const volatilityFactor = Math.max(
      COOLDOWN_CONFIG.VOLATILITY.MIN_FACTOR,
      Math.min(
        COOLDOWN_CONFIG.VOLATILITY.MAX_FACTOR,
        COOLDOWN_CONFIG.VOLATILITY.REFERENCE_ATR / atrPercent
      )
    );

    // 2. Calculate trend factor (strong trend = shorter cooldown)
    const trendFactor = adx > COOLDOWN_CONFIG.TREND.STRONG_TREND_THRESHOLD
      ? COOLDOWN_CONFIG.TREND.STRONG_TREND_FACTOR
      : COOLDOWN_CONFIG.TREND.WEAK_TREND_FACTOR;

    // 3. Calculate RSI factor (extremity = shorter cooldown)
    const rsiFactor = (rsi > COOLDOWN_CONFIG.RSI.OVERBOUGHT_THRESHOLD ||
                      rsi < COOLDOWN_CONFIG.RSI.OVERSOLD_THRESHOLD)
      ? COOLDOWN_CONFIG.RSI.EXTREMITY_FACTOR
      : COOLDOWN_CONFIG.RSI.NORMAL_FACTOR;

    // 4. Calculate signal strength factor
    const strengthFactor = getSignalStrengthMultiplier(signalConfidence);

    // 5. Calculate final cooldown
    const baseCooldown = COOLDOWN_CONFIG.BASE_MINUTES;
    const calculatedCooldown = baseCooldown * volatilityFactor * trendFactor * rsiFactor * strengthFactor;

    // 6. Apply min/max constraints
    const finalCooldown = Math.max(
      COOLDOWN_CONFIG.MIN_COOLDOWN,
      Math.min(COOLDOWN_CONFIG.MAX_COOLDOWN, Math.round(calculatedCooldown))
    );

    // 7. Log calculation details
    logger.debug("Smart cooldown calculated", {
      atrPercent,
      adx,
      rsi,
      signalConfidence,
      volatilityFactor: volatilityFactor.toFixed(2),
      trendFactor: trendFactor.toFixed(2),
      rsiFactor: rsiFactor.toFixed(2),
      strengthFactor: strengthFactor.toFixed(2),
      calculatedCooldown: calculatedCooldown.toFixed(1),
      finalCooldown,
      marketCondition: classifyMarketCondition(atrPercent),
    });

    return finalCooldown;

  } catch (error) {
    logger.error("Error calculating smart cooldown, using base cooldown", {
      error: error instanceof Error ? error.message : String(error),
      atrPercent,
      adx,
      rsi,
    });
    return COOLDOWN_CONFIG.BASE_MINUTES;
  }
};

/**
 * Classify market condition based on ATR percentage
 */
export const classifyMarketCondition = (atrPercent: number): MarketCondition => {
  if (atrPercent >= MARKET_CONDITIONS.MEME_COIN.atrMin) return "MEME_COIN";
  if (atrPercent >= MARKET_CONDITIONS.HIGH_VOLATILITY.atrMin) return "HIGH_VOLATILITY";
  if (atrPercent >= MARKET_CONDITIONS.NORMAL.atrMin) return "NORMAL";
  return "STABLE";
};

/**
 * Get signal strength level based on confidence score
 */
export const getSignalStrengthLevel = (confidence: number): SignalStrengthLevel => {
  if (confidence >= SIGNAL_STRENGTH.HIGH.min) return "HIGH";
  if (confidence >= SIGNAL_STRENGTH.MEDIUM.min) return "MEDIUM";
  if (confidence >= SIGNAL_STRENGTH.LOW.min) return "LOW";
  return "WEAK";
};

/**
 * Get signal strength multiplier for cooldown calculation
 */
const getSignalStrengthMultiplier = (confidence: number): number => {
  const level = getSignalStrengthLevel(confidence);
  return SIGNAL_STRENGTH[level].cooldownMultiplier;
};

/**
 * Check if a token should skip signal generation due to cooldown
 * @param tokenAddress Token contract address
 * @param analysis Technical analysis result
 * @param signalConfidence Signal confidence score
 * @returns Promise<boolean> True if should skip due to cooldown
 */
export const shouldSkipDueToCooldown = async (
  tokenAddress: string,
  analysis: TechnicalAnalysisResult,
  signalConfidence: number = 0.5
): Promise<boolean> => {
  try {
    // Import here to avoid circular dependency
    const { getLastSignalTime } = await import("../utils/db");

    const lastSignalTime = await getLastSignalTime(tokenAddress);

    if (!lastSignalTime) {
      logger.debug("No previous signal found, proceeding with signal generation", {
        tokenAddress,
      });
      return false;
    }

    const cooldownMinutes = calculateSmartCooldown(analysis, signalConfidence);
    const isInCooldown = isWithinCooldown(lastSignalTime, cooldownMinutes);

    if (isInCooldown) {
      const timeRemaining = getRemainingCooldownTime(lastSignalTime, cooldownMinutes);
      logger.info("Token is in cooldown period, skipping signal generation", {
        tokenAddress,
        cooldownMinutes,
        timeRemainingMinutes: timeRemaining,
        lastSignalTime: lastSignalTime.toISOString(),
        marketCondition: classifyMarketCondition(analysis.atrPercent || 2),
      });
      return true;
    }

    logger.debug("Cooldown period has passed, proceeding with signal generation", {
      tokenAddress,
      cooldownMinutes,
      lastSignalTime: lastSignalTime.toISOString(),
    });

    return false;

  } catch (error) {
    logger.error("Error checking cooldown status, proceeding with signal generation", {
      error: error instanceof Error ? error.message : String(error),
      tokenAddress,
    });
    return false; // Fail open - proceed with signal generation if error
  }
};

/**
 * Check if current time is within cooldown period
 */
export const isWithinCooldown = (lastSignalTime: Date, cooldownMinutes: number): boolean => {
  const now = new Date();
  const cooldownMs = cooldownMinutes * 60 * 1000;
  return (now.getTime() - lastSignalTime.getTime()) < cooldownMs;
};

/**
 * Get remaining cooldown time in minutes
 */
export const getRemainingCooldownTime = (lastSignalTime: Date, cooldownMinutes: number): number => {
  const now = new Date();
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const elapsedMs = now.getTime() - lastSignalTime.getTime();
  const remainingMs = cooldownMs - elapsedMs;

  return Math.max(0, Math.ceil(remainingMs / (60 * 1000)));
};

/**
 * Get recommended cooldown for market condition (for monitoring/debugging)
 */
export const getRecommendedCooldownRange = (marketCondition: MarketCondition) => {
  return MARKET_CONDITIONS[marketCondition].cooldownRange;
};