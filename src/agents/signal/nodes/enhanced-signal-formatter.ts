import { collectSignalPerformanceData } from "../../../lib/backtesting/data-collector";
import { calculateBacktestMetrics } from "../../../lib/backtesting/metrics-calculator";
import type { BacktestMetrics } from "../../../lib/backtesting/types";
import { createPhantomButtons } from "../../../lib/phantom";
import { TechnicalIndicatorAnalyzer } from "../../../lib/ta-analyzer";
import { logger } from "../../../utils/logger";
import type { SignalGraphState } from "../graph-state";

/**
 * Configuration for signal formatting
 */
interface SignalConfig {
  defaultInvestment: number;
  stopLossPercent: number;
  defaultTargetPercent: number;
  cacheTTLMs: number;
}

const STATIC_CONFIG: SignalConfig = {
  defaultInvestment: 1000,
  stopLossPercent: 2,
  defaultTargetPercent: 6,
  cacheTTLMs: 30 * 60 * 1000, // 30 minutes
};

/**
 * Get dynamic configuration based on current environment
 */
const getConfig = () => ({
  ...STATIC_CONFIG,
  minSampleSize: process.env.NODE_ENV === "test" ? 2 : 5,
  lookbackDays: process.env.NODE_ENV === "test" ? 1 : 30,
});

/**
 * Signal direction configuration
 */
const SIGNAL_CONFIG = {
  BUY: { emoji: "🚀" },
  SELL: { emoji: "🚨" },
  NEUTRAL: { emoji: "📊" },
} as const;

/**
 * Timeframe configuration
 */
const TIMEFRAME_CONFIG = {
  SHORT: { label: "Short-term", note: "1-4h re-check" },
  MEDIUM: { label: "Mid-term", note: "4-12h re-check" },
  LONG: { label: "Long-term", note: "12-24h re-check" },
} as const;

/**
 * Cache for backtest results
 */
interface BacktestCache {
  [key: string]: { metrics: BacktestMetrics; timestamp: number };
}

const backtestCache: BacktestCache = {};

/**
 * Get cached backtest metrics or fetch new ones
 */
const getSignalMetrics = async (
  signalType: string,
  direction: "BUY" | "SELL" | "NEUTRAL",
): Promise<BacktestMetrics | null> => {
  const cacheKey = `${signalType}_${direction}`;
  const cached = backtestCache[cacheKey];

  if (cached && Date.now() - cached.timestamp < getConfig().cacheTTLMs) {
    logger.debug("Using cached backtest metrics", { signalType, direction });
    return cached.metrics;
  }

  try {
    logger.info("Fetching backtest metrics for signal type", { signalType, direction });

    const config = {
      lookbackDays: getConfig().lookbackDays,
      minSampleSize: getConfig().minSampleSize,
      winThreshold: 0.02,
      confidenceBuckets: [],
      timeframes: ["4h"] as Array<"1h" | "4h" | "24h">,
    };

    const signalResults = await collectSignalPerformanceData(config);
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

    const metrics = calculateBacktestMetrics(filteredResults, "4h");

    if (metrics?.sampleSize >= config.minSampleSize) {
      backtestCache[cacheKey] = { metrics, timestamp: Date.now() };
      logger.info("Fetched and cached new backtest metrics", {
        signalType,
        direction,
        winRate: `${(metrics.winRate * 100).toFixed(1)}%`,
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
 * Calculate P/L simulation
 */
const calculatePLSimulation = (metrics: BacktestMetrics, investment = getConfig().defaultInvestment) => ({
  expectedProfit: Math.round(investment * metrics.avgReturn),
  expectedLoss: Math.round(investment * metrics.avgLoss),
  winRate: Math.round(metrics.winRate * 100),
  sampleSize: metrics.sampleSize,
  riskRewardRatio: metrics.riskRewardRatio,
});

/**
 * Generate action plan with specific price levels
 */
const generateActionPlan = (
  direction: "BUY" | "SELL" | "NEUTRAL",
  currentPrice: number,
  metrics: BacktestMetrics | null,
) => {
  const targetPercent = metrics
    ? metrics.riskRewardRatio * getConfig().stopLossPercent
    : getConfig().defaultTargetPercent;

  const entryPrice = currentPrice;
  const stopPrice =
    direction === "BUY"
      ? currentPrice * (1 - getConfig().stopLossPercent / 100)
      : currentPrice * (1 + getConfig().stopLossPercent / 100);
  const targetPrice =
    direction === "BUY" ? currentPrice * (1 + targetPercent / 100) : currentPrice * (1 - targetPercent / 100);

  return {
    entry: entryPrice.toFixed(8),
    stop: stopPrice.toFixed(8),
    target: targetPrice.toFixed(8),
    stopPercent: getConfig().stopLossPercent,
    targetPercent: Math.round(targetPercent),
  };
};

/**
 * Build market intel section
 */
const buildMarketIntelSection = (evidenceResults?: {
  relevantSources?: Array<{ url?: string; title?: string; domain?: string }>;
  marketSentiment?: string;
}) => {
  if (!evidenceResults?.relevantSources?.length) {
    return { sentiment: "NEUTRAL", sources: [], hasIntel: false };
  }

  const sources = evidenceResults.relevantSources
    .slice(0, 2)
    .map((source, index) => {
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
 * Build enhanced message sections
 */
const buildMessageSections = (data: {
  config: { emoji: string };
  tokenSymbol: string;
  direction: string;
  plPreview: ReturnType<typeof calculatePLSimulation> | null;
  whySection: string;
  actionPlan: ReturnType<typeof generateActionPlan>;
  marketIntel: ReturnType<typeof buildMarketIntelSection>;
  timeframe: { label: string; note: string };
}) => {
  const { plPreview, whySection, actionPlan, marketIntel, timeframe } = data;

  const quickDecision = plPreview
    ? `💰 *$${getConfig().defaultInvestment} → +$${plPreview.expectedProfit}* (${plPreview.winRate}% success, ${plPreview.sampleSize} signals tracked)`
    : "💰 *Expected Return*: Data collecting...";

  const strengthSection = whySection.split("\n").slice(0, 2).join("\n");

  const actionSection = `⚡ *Next Steps*
1️⃣ *Entry*: $${actionPlan.entry} (current market)
2️⃣ *Stop Loss*: $${actionPlan.stop} (${actionPlan.stopPercent}% protection)
3️⃣ *Target*: $${actionPlan.target} (+${actionPlan.targetPercent}% goal)`;

  const intelSection = marketIntel.hasIntel
    ? `📰 *Market Context* (${marketIntel.sentiment}): ${marketIntel.sources.length} sources analyzed`
    : "📰 *Market Context*: Neutral sentiment";

  const confidenceSection = plPreview
    ? `📈 *Our Track Record*
✅ Win Rate: ${plPreview.winRate}% (last ${plPreview.sampleSize} signals)
💡 *Risk Guidance*: Start with 25-50% position size
⚠️ *Max Loss*: $${plPreview.expectedLoss} if stop hit`
    : `📈 *Risk Guidance*
💡 Start with 25-50% of intended position
⚠️ Always use stop losses for protection`;

  return {
    quickDecision,
    strengthSection,
    actionSection,
    intelSection,
    confidenceSection,
    timeframe: `⏱️ *Timeframe*: ${timeframe.label} (${timeframe.note})`,
  };
};

/**
 * Build the complete enhanced message
 */
const buildEnhancedMessage = (data: Parameters<typeof buildMessageSections>[0]) => {
  const sections = buildMessageSections(data);

  return `${data.config.emoji} *${data.direction} $${data.tokenSymbol.toUpperCase()}*
${sections.quickDecision}

📊 *Why This Signal*
${sections.strengthSection}

${sections.actionSection}

${sections.intelSection}

${sections.confidenceSection}

${sections.timeframe}

🤖 _AI Analysis - Trade at your own discretion_`;
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

  // Fetch metrics and build content
  const metrics = await getSignalMetrics(signalDecision.signalType, signalDecision.direction);
  const analyzer = new TechnicalIndicatorAnalyzer(state.technicalAnalysis);
  const indicatorBullets = analyzer.getBulletPoints();

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

  const actionPlan = generateActionPlan(signalDecision.direction, currentPrice, metrics);
  const marketIntel = buildMarketIntelSection(state.evidenceResults);
  const plPreview = metrics ? calculatePLSimulation(metrics) : null;

  const message = buildEnhancedMessage({
    config,
    tokenSymbol,
    direction: signalDecision.direction,
    plPreview,
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

  if (!state.signalDecision?.shouldGenerateSignal) {
    logger.info("No signal decision or signal generation disabled", {
      tokenAddress: state.tokenAddress,
      shouldGenerateSignal: state.signalDecision?.shouldGenerateSignal,
    });
    return createNoSignalResponse(state);
  }

  logger.info("Using enhanced signal formatting with backtest integration", {
    tokenAddress: state.tokenAddress,
    signalType: state.signalDecision?.signalType,
  });

  return await createEnhancedSignalResponse(state);
};
