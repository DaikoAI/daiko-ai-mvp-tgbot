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
 * Create sophisticated market snapshot combining technical analysis and fundamental data
 */
const createMarketSnapshot = (state: SignalGraphState): string => {
  const { signalDecision, technicalAnalysis, evidenceResults } = state;

  if (!signalDecision) {
    return "Market conditions are currently within normal parameters with no significant directional bias.";
  }

  // Analyze technical context
  const analyzer = new TechnicalIndicatorAnalyzer(technicalAnalysis);
  const bulletPoints = analyzer.getBulletPoints();

  // Extract key insights from technical analysis
  const keyIndicators = {
    momentum: bulletPoints.some(
      (point) =>
        point.includes("oversold") ||
        point.includes("overbought") ||
        point.includes("momentum") ||
        point.includes("RSI"),
    ),
    volatility: bulletPoints.some(
      (point) =>
        point.includes("volatility") ||
        point.includes("ATR") ||
        point.includes("high volatility") ||
        point.includes("low volatility"),
    ),
    trend: bulletPoints.some(
      (point) =>
        point.includes("trend") || point.includes("ADX") || point.includes("breakout") || point.includes("direction"),
    ),
  };

  // Extract fundamental context from signal decision
  const fundamentalContext = signalDecision?.sentimentFactors?.length > 0
    ? signalDecision.sentimentFactors.slice(0, 3).join(", ")
    : null;

  const marketSentiment = signalDecision?.marketSentiment || "NEUTRAL";
  const qualityScore = evidenceResults?.qualityScore || 0;

  // Create narrative based on signal strength and context
  let narrative = "";

  if (signalDecision.confidence >= 0.8) {
    // High confidence signals - strong narrative
    narrative =
      signalDecision.direction === "BUY"
        ? "Strong accumulation opportunity identified. Multiple technical indicators align with supportive market conditions."
        : "Significant distribution pressure detected. Technical patterns suggest cautious positioning.";
  } else if (signalDecision.confidence >= 0.6) {
    // Medium confidence - balanced narrative
    narrative =
      signalDecision.direction === "BUY"
        ? "Moderate buying opportunity emerging. Technical setup shows potential but requires careful timing."
        : "Mixed signals present. Market structure suggests reduced risk exposure may be prudent.";
  } else {
    // Lower confidence - cautious narrative
    narrative = "Market showing transitional behavior. Current technical setup warrants watchful monitoring.";
  }

  // Add technical context
  if (keyIndicators.momentum) {
    if (signalDecision.direction === "BUY") {
      narrative += ` Price momentum is building from oversold levels, suggesting potential reversal dynamics.`;
    } else {
      narrative += ` Momentum indicators signal weakening buying pressure and potential trend exhaustion.`;
    }
  }

  if (keyIndicators.volatility) {
    if (signalDecision.riskLevel === "HIGH") {
      narrative += ` Elevated volatility suggests larger position sizing caution.`;
    } else {
      narrative += ` Volatility remains manageable for standard position allocation.`;
    }
  }

  // Integrate fundamental context if available and high quality
  if (fundamentalContext && qualityScore > 0.5) {
    const sentiment =
      marketSentiment === "BULLISH" ? "supportive" : marketSentiment === "BEARISH" ? "concerning" : "neutral";
    narrative += ` Market narratives around ${fundamentalContext.toLowerCase()} appear ${sentiment} for this positioning.`;
  }

  // Add market structure insight
  if (technicalAnalysis) {
    const rsi = parseFloat(technicalAnalysis.rsi || "50");
    const vwapDev = parseFloat(technicalAnalysis.vwap_deviation || "0");

    if (Math.abs(vwapDev) > 3) {
      narrative += ` Current price sits ${vwapDev > 0 ? "significantly above" : "well below"} institutional activity levels.`;
    } else if (rsi < 30) {
      narrative += ` Asset appears oversold relative to recent trading ranges.`;
    } else if (rsi > 70) {
      narrative += ` Asset shows overbought characteristics requiring careful exit planning.`;
    }
  }

  return narrative;
};

/**
 * Creates a simple signal response with modern formatting
 */
export const createSimpleSignalResponse = (state: SignalGraphState) => {
  const { signalDecision, tokenSymbol, tokenAddress, currentPrice } = state;

  if (!signalDecision) {
    return createNoSignalResponse(state);
  }

  const config = SIGNAL_CONFIG[signalDecision.direction as keyof typeof SIGNAL_CONFIG];
  const timeframe = TIMEFRAME_CONFIG[signalDecision.timeframe as keyof typeof TIMEFRAME_CONFIG];
  const riskLabel = signalDecision.riskLevel.charAt(0) + signalDecision.riskLevel.slice(1).toLowerCase();

  // Analyze technical indicators
  const analyzer = new TechnicalIndicatorAnalyzer(state.technicalAnalysis);
  const indicatorBullets = analyzer.getBulletPoints();

  // Build why section - format as simple bullet points
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

  // Generate suggested action based on direction
  const actionMap = {
    BUY: `Consider gradual buy entry. Re-check chart after ${timeframe.note}`,
    SELL: `Consider partial or full sell. Re-check chart after ${timeframe.note}`,
    NEUTRAL: `Hold current position. Re-check market after ${timeframe.note}`,
  };
  const suggestedAction = actionMap[signalDecision.direction as keyof typeof actionMap];

  // Build information sources section if available with enhanced metadata
  let sourcesSection = "";
  if (state.evidenceResults?.relevantSources?.length > 0) {
    const sources = state.evidenceResults.relevantSources.slice(0, 3); // Limit to 3 sources
    const sourceLinks = sources
      .map((source, index) => {
        if (source?.url && source?.title) {
          const title = (source.title || "").slice(0, 50); // Truncate long titles
          const domain =
            source.domain ||
            (() => {
              try {
                return new URL(source.url).hostname;
              } catch {
                return "unknown";
              }
            })();
          return `${index + 1}. [${title}](${source.url}) (${domain})`;
        }
        return null;
      })
      .filter(Boolean)
      .join("\n");

    // Add market sentiment and search metadata
    const marketSentiment = state.signalDecision?.marketSentiment || "NEUTRAL";
    const { searchTime = 0, totalResults = 0 } = state.evidenceResults || {};
    const sentimentEmoji = marketSentiment === "BULLISH" ? "📈" : marketSentiment === "BEARISH" ? "📉" : "⚖️";

    if (sourceLinks) {
      sourcesSection = `\n\n📰 *Information Sources* ${sentimentEmoji} ${marketSentiment}
${sourceLinks}
_Found ${totalResults} sources in ${(searchTime / 1000).toFixed(1)}s_`;
    }
  }

  // Create sophisticated market snapshot
  const marketSnapshot = createMarketSnapshot(state);

  // Build final message in the exact format from the example
  const message = `${config.emoji} ${signalDecision.direction} $${tokenSymbol.toUpperCase()}
Risk: ${riskLabel}
Price: _$${currentPrice.toString()}_
Confidence: ${Math.round(signalDecision.confidence * 100)}%
Timeframe: ${timeframe.label} (${timeframe.note} recommended)

🗒️ *Market Snapshot*
${marketSnapshot}

🔍 *Why?*
${whySection}

🎯 *Suggested Action*
${suggestedAction}${sourcesSection}

⚠️ DYOR - Always do your own research.`;

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
      title: `🔍 [WATCH] $${tokenSymbol.toUpperCase()}`,
      message: `🔍 **[WATCH] $${tokenSymbol.toUpperCase()}**
📊 Status: **Monitoring** | 🎯 Market: **Neutral Range** | ⚠️ Risk: **Low**
⏰ **Next Check**: Regular monitoring mode

📈 **Analysis Summary**
Current technical indicators are within normal parameters. No significant trend breakouts or momentum shifts detected at this time.

🎯 **Suggested Action**
Continue monitoring market conditions. No immediate action required.

⚠️ DYOR - Always do your own research.`,
      priority: "LOW" as const,
      tags: [tokenSymbol.toLowerCase(), "monitoring", "neutral"],
      buttons: createPhantomButtons(tokenAddress, tokenSymbol),
    },
  };
};

/**
 * Main signal formatting node with LLM fallback
 */
export const formatSignal = async (state: SignalGraphState) => {
  logger.info("Starting signal formatting", {
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

  // Use simple template formatting for consistency
  logger.info("Using simple template-based signal formatting", {
    tokenAddress: state.tokenAddress,
    signalType: state.signalDecision?.signalType,
  });

  return createSimpleSignalResponse(state);
};
