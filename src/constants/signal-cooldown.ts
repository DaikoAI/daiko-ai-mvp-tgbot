/**
 * Smart Signal Cooldown Configuration
 * Volatility + Trend based dynamic cooldown system
 */

export const COOLDOWN_CONFIG = {
  /** Base cooldown time in minutes */
  BASE_MINUTES: 30,

  /** Minimum cooldown time in minutes (high volatility limit) */
  MIN_COOLDOWN: 15,

  /** Maximum cooldown time in minutes (low volatility limit) */
  MAX_COOLDOWN: 120,

  /** Volatility calculation settings */
  VOLATILITY: {
    /** ATR_PERCENT reference value for normal volatility */
    REFERENCE_ATR: 3.0,
    /** Minimum volatility factor multiplier */
    MIN_FACTOR: 0.3,
    /** Maximum volatility factor multiplier */
    MAX_FACTOR: 2.0,
  },

  /** Trend strength settings */
  TREND: {
    /** ADX threshold for strong trend detection */
    STRONG_TREND_THRESHOLD: 25,
    /** Multiplier for strong trend (shorter cooldown) */
    STRONG_TREND_FACTOR: 0.7,
    /** Multiplier for range/weak trend (longer cooldown) */
    WEAK_TREND_FACTOR: 1.3,
  },

  /** RSI extremity settings */
  RSI: {
    /** Overbought threshold */
    OVERBOUGHT_THRESHOLD: 70,
    /** Oversold threshold */
    OVERSOLD_THRESHOLD: 30,
    /** Multiplier for RSI extremity (shorter cooldown at extremes) */
    EXTREMITY_FACTOR: 0.8,
    /** Multiplier for normal RSI range */
    NORMAL_FACTOR: 1.0,
  },

  /** Similar signal detection settings */
  SIMILARITY: {
    /** Time window in hours to check for similar signals */
    LOOKBACK_HOURS: 2,
    /** Confidence difference threshold for similarity */
    CONFIDENCE_THRESHOLD: 0.1,
  },
} as const;

/**
 * Cooldown calculation factors based on market conditions
 */
export const MARKET_CONDITIONS = {
  /** Memecoin conditions (high volatility) */
  MEME_COIN: {
    atrMin: 8.0,
    cooldownRange: { min: 15, max: 30 },
    description: "High volatility memecoin",
  },

  /** High volatility altcoin */
  HIGH_VOLATILITY: {
    atrMin: 5.0,
    cooldownRange: { min: 30, max: 60 },
    description: "High volatility altcoin",
  },

  /** Normal volatility token */
  NORMAL: {
    atrMin: 2.0,
    cooldownRange: { min: 45, max: 90 },
    description: "Normal volatility token",
  },

  /** Stable/low volatility asset */
  STABLE: {
    atrMin: 0,
    cooldownRange: { min: 60, max: 120 },
    description: "Low volatility stable asset",
  },
} as const;

/**
 * Signal strength levels for cooldown adjustment
 */
export const SIGNAL_STRENGTH = {
  HIGH: { min: 0.8, cooldownMultiplier: 0.6 },
  MEDIUM: { min: 0.6, cooldownMultiplier: 0.8 },
  LOW: { min: 0.4, cooldownMultiplier: 1.0 },
  WEAK: { min: 0, cooldownMultiplier: 1.2 },
} as const;

export type MarketCondition = keyof typeof MARKET_CONDITIONS;
export type SignalStrengthLevel = keyof typeof SIGNAL_STRENGTH;