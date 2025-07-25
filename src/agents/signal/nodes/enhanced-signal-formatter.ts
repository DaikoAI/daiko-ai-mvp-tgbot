import { collectSignalPerformanceData } from "../../../lib/backtesting/data-collector";
import { calculateBacktestMetrics } from "../../../lib/backtesting/metrics-calculator";
import type { BacktestMetrics } from "../../../lib/backtesting/types";
import { createPhantomButtons } from "../../../lib/phantom";
import { TechnicalIndicatorAnalyzer } from "../../../lib/ta-analyzer";
import { logger } from "../../../utils/logger";
import type { SignalGraphState } from "../graph-state";

/**
 * Configuration for signal direction display
 */
const SIGNAL_CONFIG = {
  BUY: { emoji: "🚀" },
  SELL: { emoji: "🚨" },
  NEUTRAL: { emoji: "📊" },
} as const;

/**
 * Configuration for timeframe display
 */
const TIMEFRAME_CONFIG = {
  SHORT: { label: "Short-term", note: "1-4h re-check" },
  MEDIUM: { label: "Mid-term", note: "4-12h re-check" },
  LONG: { label: "Long-term", note: "12-24h re-check" },
} as const;

/**
 * Cache for backtest results to avoid repeated database queries
 */
interface BacktestCache {
  [key: string]: {
    metrics: BacktestMetrics;
    timestamp: number;
  };
}

const backtestCache: BacktestCache = {};
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get cached backtest metrics or fetch new ones
 */
const getSignalMetrics = async (
  signalType: string,
  direction: "BUY" | "SELL" | "NEUTRAL",
): Promise<BacktestMetrics | null> => {
  const cacheKey = `${signalType}_${direction}`;
  const cached = backtestCache[cacheKey];

  // Return cached result if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    logger.debug("Using cached backtest metrics", { signalType, direction, cacheAge: Date.now() - cached.timestamp });
    return cached.metrics;
  }

  try {
    logger.info("Fetching backtest metrics for signal type", { signalType, direction });

    // Use existing backtesting infrastructure with test-friendly defaults
    const config = {
      lookbackDays: process.env.NODE_ENV === "test" ? 1 : 30, // Use 1 day for tests, 30 for production
      minSampleSize: process.env.NODE_ENV === "test" ? 2 : 5, // Reduce minimum sample size for tests
      winThreshold: 0.02,
      confidenceBuckets: [],
      timeframes: ["4h"] as ("1h" | "4h" | "24h")[],
    };

    // Collect signal performance data
    const signalResults = await collectSignalPerformanceData(config);

    // Filter for specific signal type and direction
    const filteredResults = signalResults.filter(
      (result) => result.signalType === signalType && result.direction === direction,
    );

    if (filteredResults.length < config.minSampleSize) {
      logger.warn("Insufficient sample size for backtest metrics", {
        signalType,
        direction,
        found: filteredResults.length,
        required: config.minSampleSize,
      });
      return null;
    }

    // Calculate metrics for 4h timeframe
    const metrics = calculateBacktestMetrics(filteredResults, "4h");

    if (metrics && metrics.sampleSize >= config.minSampleSize) {
      // Cache the result
      backtestCache[cacheKey] = {
        metrics: metrics,
        timestamp: Date.now(),
      };

      logger.info("Fetched and cached new backtest metrics", {
        signalType,
        direction,
        winRate: (metrics.winRate * 100).toFixed(1) + "%",
        sampleSize: metrics.sampleSize,
      });

      return metrics;
    }

    return null;
  } catch (error) {
    logger.error("Failed to fetch backtest metrics", {
      signalType,
      direction,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

/**
 * Calculate P/L simulation for $1000 investment
 */
const calculatePLSimulation = (metrics: BacktestMetrics, investment: number = 1000) => {
  const expectedProfit = Math.round(investment * metrics.avgReturn);
  const expectedLoss = Math.round(investment * metrics.avgLoss);
  const winRate = Math.round(metrics.winRate * 100);

  return {
    expectedProfit,
    expectedLoss,
    winRate,
    sampleSize: metrics.sampleSize,
    riskRewardRatio: metrics.riskRewardRatio,
  };
};

/**
 * Creates an enhanced signal response with backtest data
 */
export const createEnhancedSignalResponse = async (state: SignalGraphState) => {
  const { signalDecision, tokenSymbol, tokenAddress, currentPrice } = state;

  if (!signalDecision) {
    return createNoSignalResponse(state);
  }

  const config = SIGNAL_CONFIG[signalDecision.direction as keyof typeof SIGNAL_CONFIG];
  const timeframe = TIMEFRAME_CONFIG[signalDecision.timeframe as keyof typeof TIMEFRAME_CONFIG];
  const riskLabel = signalDecision.riskLevel.charAt(0) + signalDecision.riskLevel.slice(1).toLowerCase();

  // Fetch backtest metrics for this signal type
  const metrics = await getSignalMetrics(signalDecision.signalType, signalDecision.direction);

  // Analyze technical indicators
  const analyzer = new TechnicalIndicatorAnalyzer(state.technicalAnalysis);
  const indicatorBullets = analyzer.getBulletPoints();

  // Build why section with top 3 indicators
  const whySection =
    indicatorBullets.length > 0
      ? indicatorBullets
          .slice(0, 3)
          .map((bullet) => `● ${bullet}`)
          .join("\n")
      : signalDecision.keyFactors
          .slice(0, 3)
          .map((factor) => `● ${factor}`)
          .join("\n");

  // Generate action plan with entry/stop/target levels
  const actionPlan = generateActionPlan(signalDecision, currentPrice, metrics);

  // Build market intel section from evidence results
  const marketIntel = buildMarketIntelSection(state.evidenceResults);

  // Build P/L preview section if metrics available
  const plPreview = metrics ? calculatePLSimulation(metrics) : null;

  // Build the enhanced message
  const message = buildEnhancedMessage({
    config,
    tokenSymbol,
    plPreview,
    signalDecision,
    whySection,
    actionPlan,
    marketIntel,
    timeframe,
  });

  // Determine level based on risk and confidence
  const level =
    signalDecision.riskLevel === "HIGH" || signalDecision.confidence >= 0.8
      ? 3
      : signalDecision.riskLevel === "MEDIUM" || signalDecision.confidence >= 0.6
        ? 2
        : 1;

  return {
    finalSignal: {
      level: level as 1 | 2 | 3,
      title: `${config.emoji} ${signalDecision.direction} $${tokenSymbol.toUpperCase()} - ${riskLabel} Risk`,
      message,
      priority: signalDecision.riskLevel as "LOW" | "MEDIUM" | "HIGH",
      tags: [tokenSymbol.toLowerCase(), signalDecision.direction.toLowerCase(), signalDecision.riskLevel.toLowerCase()],
      buttons: createPhantomButtons(tokenAddress, tokenSymbol),
    },
  };
};

/**
 * Generate action plan with specific price levels
 */
const generateActionPlan = (
  signalDecision: { direction: "BUY" | "SELL" | "NEUTRAL" },
  currentPrice: number,
  metrics: BacktestMetrics | null,
) => {
  const stopLossPercent = 2; // 2% stop loss
  const targetPercent = metrics ? metrics.riskRewardRatio * stopLossPercent : 6; // Use RRR or default 6%

  const entryPrice = currentPrice;
  const stopPrice =
    signalDecision.direction === "BUY"
      ? currentPrice * (1 - stopLossPercent / 100)
      : currentPrice * (1 + stopLossPercent / 100);
  const targetPrice =
    signalDecision.direction === "BUY"
      ? currentPrice * (1 + targetPercent / 100)
      : currentPrice * (1 - targetPercent / 100);

  return {
    entry: entryPrice.toFixed(8),
    stop: stopPrice.toFixed(8),
    target: targetPrice.toFixed(8),
    stopPercent: stopLossPercent,
    targetPercent: Math.round(targetPercent),
  };
};

/**
 * Build market intel section from evidence results
 */
const buildMarketIntelSection = (
  evidenceResults:
    | {
        relevantSources?: Array<{
          url?: string;
          title?: string;
          domain?: string;
        }>;
        marketSentiment?: string;
      }
    | undefined,
) => {
  if (!evidenceResults?.relevantSources || evidenceResults.relevantSources.length === 0) {
    return {
      sentiment: "NEUTRAL",
      sources: [],
      hasIntel: false,
    };
  }

  const sources = evidenceResults.relevantSources
    .slice(0, 2)
    .map((source, index: number) => {
      if (source?.url && source?.title) {
        const title = source.title.slice(0, 45);
        const domain = source.domain || new URL(source.url).hostname;
        return `${index + 1}. [${title}](${source.url}) (${domain})`;
      }
      return null;
    })
    .filter((item): item is string => item !== null);

  return {
    sentiment: evidenceResults.marketSentiment || "NEUTRAL",
    sources,
    hasIntel: sources.length > 0,
  };
};

/**
 * Build the enhanced message with all components
 */
const buildEnhancedMessage = ({
  config,
  tokenSymbol,
  plPreview,
  signalDecision,
  whySection,
  actionPlan,
  marketIntel,
  timeframe,
}: {
  config: { emoji: string };
  tokenSymbol: string;
  plPreview: {
    expectedProfit: number;
    expectedLoss: number;
    winRate: number;
    sampleSize: number;
  } | null;
  signalDecision: { direction: string };
  whySection: string;
  actionPlan: {
    entry: string;
    stop: string;
    target: string;
    stopPercent: number;
    targetPercent: number;
  };
  marketIntel: {
    sentiment: string;
    sources: string[];
    hasIntel: boolean;
  };
  timeframe: { label: string; note: string };
}) => {
  // 1-second decision section - most important info upfront
  const quickDecisionSection = plPreview
    ? `💰 *$1000 → +$${plPreview.expectedProfit}* (${plPreview.winRate}% success, ${plPreview.sampleSize} signals tracked)`
    : `💰 *Expected Return*: Data collecting...`;

  // Simplified strength (max 2 bullets for clarity)
  const strengthSection = whySection.split("\n").slice(0, 2).join("\n");

  // Clear action with exact steps
  const actionSection = `⚡ *Next Steps*
1️⃣ *Entry*: $${actionPlan.entry} (current market)
2️⃣ *Stop Loss*: $${actionPlan.stop} (${actionPlan.stopPercent}% protection)
3️⃣ *Target*: $${actionPlan.target} (+${actionPlan.targetPercent}% goal)`;

  // Condensed intel
  const intelSection = marketIntel.hasIntel
    ? `📰 *Market Context* (${marketIntel.sentiment}): ${marketIntel.sources.length} sources analyzed`
    : "📰 *Market Context*: Neutral sentiment";

  // Clear risk guidance instead of "DYOR"
  const confidenceSection = plPreview
    ? `📈 *Our Track Record*
✅ Win Rate: ${plPreview.winRate}% (last ${plPreview.sampleSize} signals)
💡 *Risk Guidance*: Start with 25-50% position size
⚠️ *Max Loss*: $${plPreview.expectedLoss} if stop hit`
    : `📈 *Risk Guidance*
💡 Start with 25-50% of intended position
⚠️ Always use stop losses for protection`;

  // Combine with clear hierarchy
  return `${config.emoji} *${signalDecision.direction} $${tokenSymbol.toUpperCase()}*
${quickDecisionSection}

📊 *Why This Signal*
${strengthSection}

${actionSection}

${intelSection}

${confidenceSection}

⏱️ *Timeframe*: ${timeframe.label} (${timeframe.note})

🤖 _AI Analysis - Trade at your own discretion_`;
};

/**
 * Creates a standardized "no signal" response
 */
export const createNoSignalResponse = (state: SignalGraphState) => {
  const { tokenSymbol, tokenAddress } = state;

  return {
    finalSignal: {
      level: 1 as const,
      title: `👀 MONITORING $${tokenSymbol.toUpperCase()}`,
      message: `👀 *MONITORING $${tokenSymbol.toUpperCase()}*
📊 *Current Status*: No clear trend detected

🔍 *What We're Watching*
● Price staying within normal range
● Technical indicators in neutral zone
● No significant volume spikes

⏳ *Next Update*
We'll alert you when conditions change

💡 *What This Means*
✅ Good time to research fundamentals
✅ Set price alerts at key levels
✅ Wait for clearer signals

🤖 _No action needed right now - we're monitoring_`,
      priority: "LOW" as const,
      tags: [tokenSymbol.toLowerCase(), "monitoring", "neutral"],
      buttons: createPhantomButtons(tokenAddress, tokenSymbol),
    },
  };
};

/**
 * Main enhanced signal formatting node
 */
export const formatEnhancedSignal = async (state: SignalGraphState) => {
  logger.info("Starting enhanced signal formatting with backtest integration", {
    tokenAddress: state.tokenAddress,
    hasAnalysis: !!state.signalDecision,
    hasStaticFilter: !!state.staticFilterResult,
    hasTechnicalAnalysis: !!state.technicalAnalysis,
  });

  // Early exit if no signal decision exists
  if (!state.signalDecision) {
    logger.info("No signal decision found, returning no signal response", {
      tokenAddress: state.tokenAddress,
    });
    return createNoSignalResponse(state);
  }

  // When no signal should be generated
  if (!state.signalDecision.shouldGenerateSignal) {
    logger.info("Signal decision indicates no signal should be generated", {
      tokenAddress: state.tokenAddress,
      shouldGenerateSignal: state.signalDecision?.shouldGenerateSignal,
    });
    return createNoSignalResponse(state);
  }

  // Use enhanced formatting with backtest data
  logger.info("Using enhanced signal formatting with backtest integration", {
    tokenAddress: state.tokenAddress,
    signalType: state.signalDecision?.signalType,
  });

  return await createEnhancedSignalResponse(state);
};
