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

  // Build final message in the exact format from the example
  const message = `${config.emoji} ${signalDecision.direction} $${tokenSymbol.toUpperCase()}
Risk: ${riskLabel}
Price: _$${currentPrice.toString()}_
Confidence: ${Math.round(signalDecision.confidence * 100)}%
Timeframe: ${timeframe.label} (${timeframe.note} recommended)

🗒️ *Market Snapshot*
${signalDecision.reasoning}

🔍 *Why?*
${whySection}

🎯 *Suggested Action*
${suggestedAction}

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
