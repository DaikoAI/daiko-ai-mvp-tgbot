import { z } from "zod";
import { createPhantomButtons } from "../../../lib/phantom";
import { getLanguageDisplayName } from "../../../utils/language";
import { logger } from "../../../utils/logger";
import { safeParseNumber } from "../../../utils/number";
import { gpt4oMini } from "../../model";
import type { SignalGraphState } from "../graph-state";
import { signalFormattingPrompt } from "../prompts/signal-analysis";

/**
 * Button Schema for Telegram Inline Keyboard
 * Fixed schema for OpenAI structured output compatibility
 */
const buttonSchema = z.object({
  text: z.string(),
  url: z.string().nullable().optional(),
  callback_data: z.string().nullable().optional(),
});

/**
 * Zod schema for validating structured output from LLM
 */
const signalFormattingSchema = z.object({
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  title: z.string(),
  message: z.string(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  tags: z.array(z.string()),
  buttons: z.array(buttonSchema).nullable().optional(),
});

/**
 * Simple template-based signal formatter (LLM-free fallback)
 */
const createSimpleSignalResponse = (state: SignalGraphState) => {
  const { signalDecision, tokenSymbol, tokenAddress, currentPrice, userLanguage } = state;

  if (!signalDecision) {
    // fallback safety – should not happen as caller checks existence
    return createNoSignalResponse(tokenAddress, tokenSymbol, userLanguage);
  }

  // English base text (will be translated by LLM if needed)
  const text = {
    price: "Price",
    confidence: "Confidence",
    risk: "Risk",
    timeframe: "Timeframe",
    marketSnapshot: "Market Snapshot",
    why: "Why?",
    suggestedAction: "Suggested Action",
    dyor: "DYOR - Always do your own research.",
  };

  // Mapping helpers --------------------------------------------------
  const actionEmoji = signalDecision.direction === "BUY" ? "🚀" : signalDecision.direction === "SELL" ? "🚨" : "📊";
  const riskLabel =
    signalDecision.riskLevel === "HIGH" ? "High" : signalDecision.riskLevel === "MEDIUM" ? "Medium" : "Low";
  const timeframeLabel =
    signalDecision.timeframe === "SHORT"
      ? "Short-term"
      : signalDecision.timeframe === "MEDIUM"
        ? "Mid-term"
        : "Long-term";
  const timeframeNote =
    signalDecision.timeframe === "SHORT"
      ? "1-4h re-check"
      : signalDecision.timeframe === "MEDIUM"
        ? "4-12h re-check"
        : "12-24h re-check";

  // Format price with appropriate decimal places
  const formatPrice = (price: number): string => {
    if (price >= 1) {
      return price.toFixed(2);
    } else if (price >= 0.01) {
      return price.toFixed(4);
    } else {
      return price.toFixed(8).replace(/\.?0+$/, "");
    }
  };

  // Build bullet list for Why section (max 3) --------------------------------
  const buildIndicatorBullets = () => {
    const bullets: string[] = [];
    const ta = state.technicalAnalysis;

    if (!ta) return bullets;

    // Helper function to validate and format technical indicators
    const validIndicators: Array<{ name: string; value: number; condition: string }> = [];

    // RSI validation and interpretation
    const rsiValue = safeParseNumber(ta.rsi);
    if (rsiValue !== null) {
      let condition = "";
      if (rsiValue >= 80) condition = "extremely overbought conditions favor sellers";
      else if (rsiValue >= 70) condition = "overbought conditions favor sellers";
      else if (rsiValue <= 20) condition = "extremely oversold conditions favor buyers";
      else if (rsiValue <= 30) condition = "oversold conditions favor buyers";
      else if (rsiValue >= 45 && rsiValue <= 55) condition = "neutral momentum, no strong bias";
      else condition = rsiValue > 50 ? "slightly bullish momentum" : "slightly bearish momentum";

      validIndicators.push({
        name: `RSI ${rsiValue.toFixed(0)}`,
        value: rsiValue,
        condition: condition,
      });
    }

    // Bollinger Bands %B validation and interpretation
    const percentB = safeParseNumber(ta.percent_b);
    if (percentB !== null) {
      let condition = "";
      if (percentB >= 1.0) condition = "price breaking above upper band (potential reversal)";
      else if (percentB >= 0.8) condition = "approaching overbought territory";
      else if (percentB <= 0.0) condition = "price touching lower band (potential support)";
      else if (percentB <= 0.2) condition = "approaching oversold territory";
      else condition = `price within normal trading range (${(percentB * 100).toFixed(0)}% of band)`;

      validIndicators.push({
        name: `Bollinger %B ${(percentB * 100).toFixed(0)}%`,
        value: percentB,
        condition: condition,
      });
    }

    // ADX validation and interpretation
    const adxValue = safeParseNumber(ta.adx);
    if (adxValue !== null) {
      let condition = "";
      if (adxValue >= 50) condition = "extremely strong trend - high conviction trade";
      else if (adxValue >= 25) condition = "strong trend developing";
      else if (adxValue >= 15) condition = "moderate trend strength building";
      else condition = "weak trend - range-bound market";

      // Include direction if available
      const direction = ta.adx_direction || "NEUTRAL";
      if (direction !== "NEUTRAL" && adxValue >= 20) {
        condition += ` (${direction.toLowerCase()}ward)`;
      }

      validIndicators.push({
        name: `ADX ${adxValue.toFixed(0)}`,
        value: adxValue,
        condition: condition,
      });
    }

    // VWAP Deviation validation and interpretation
    const vwapDev = safeParseNumber(ta.vwap_deviation);
    if (vwapDev !== null) {
      const absDeviation = Math.abs(vwapDev);
      let condition = "";
      if (absDeviation >= 10) condition = `extreme ${vwapDev > 0 ? "premium" : "discount"} to volume-weighted average`;
      else if (absDeviation >= 5) condition = `significant ${vwapDev > 0 ? "premium" : "discount"} to VWAP`;
      else if (absDeviation >= 2) condition = `moderate ${vwapDev > 0 ? "premium" : "discount"} to fair value`;
      else condition = "trading near volume-weighted fair value";

      validIndicators.push({
        name: `VWAP Dev ${vwapDev > 0 ? "+" : ""}${vwapDev.toFixed(1)}%`,
        value: absDeviation,
        condition: condition,
      });
    }

    // OBV Z-Score validation and interpretation
    const obvZScore = safeParseNumber(ta.obv_zscore);
    if (obvZScore !== null) {
      const absZScore = Math.abs(obvZScore);
      let condition = "";
      if (absZScore >= 2.5) condition = `extreme volume ${obvZScore > 0 ? "accumulation" : "distribution"} detected`;
      else if (absZScore >= 1.5) condition = `strong volume ${obvZScore > 0 ? "buying" : "selling"} pressure`;
      else if (absZScore >= 0.5) condition = `moderate volume ${obvZScore > 0 ? "inflow" : "outflow"}`;
      else condition = "balanced volume activity";

      validIndicators.push({
        name: `Volume Flow ${obvZScore > 0 ? "+" : ""}${obvZScore.toFixed(1)}σ`,
        value: absZScore,
        condition: condition,
      });
    }

    // ATR Percent validation and interpretation
    const atrPercent = safeParseNumber(ta.atr_percent);
    if (atrPercent !== null) {
      let condition = "";
      if (atrPercent >= 8) condition = "extremely high volatility - large price swings expected";
      else if (atrPercent >= 5) condition = "high volatility - increased risk and opportunity";
      else if (atrPercent >= 3) condition = "moderate volatility - normal price movement";
      else condition = "low volatility - range-bound price action";

      validIndicators.push({
        name: `Volatility ${atrPercent.toFixed(1)}%`,
        value: atrPercent,
        condition: condition,
      });
    }

    // Sort by relevance/importance (prioritize extreme values)
    validIndicators.sort((a, b) => {
      // Prioritize RSI extremes, then Bollinger extremes, then strong ADX
      if (a.name.includes("RSI") && (a.value >= 70 || a.value <= 30)) return -1;
      if (b.name.includes("RSI") && (b.value >= 70 || b.value <= 30)) return 1;
      if (a.name.includes("Bollinger") && (a.value >= 0.8 || a.value <= 0.2)) return -1;
      if (b.name.includes("Bollinger") && (b.value >= 0.8 || b.value <= 0.2)) return 1;
      if (a.name.includes("ADX") && a.value >= 25) return -1;
      if (b.name.includes("ADX") && b.value >= 25) return 1;
      return 0;
    });

    // Return top 3 most relevant indicators
    return validIndicators.slice(0, 3).map((indicator) => `${indicator.name} - ${indicator.condition}`);
  };

  const indicatorBullets = buildIndicatorBullets();
  const whyBullets =
    indicatorBullets.length > 0
      ? indicatorBullets.map((b) => `• ${b}`).join("\n")
      : signalDecision.keyFactors
          .slice(0, 3)
          .map((factor) => `• ${factor}`)
          .join("\n");

  // Suggested action – reuse reasoning of direction & risk
  const suggestedAction = (() => {
    if (signalDecision.direction === "BUY") {
      return `Consider gradual *buy* entry, re-evaluate price after ${timeframeNote}`;
    }
    if (signalDecision.direction === "SELL") {
      return `Consider partial or full *sell*. Re-check chart after ${timeframeNote}`;
    }
    return `Hold current position. Re-check market after ${timeframeNote}`;
  })();

  const confidencePct = Math.round(signalDecision.confidence * 100);

  const baseMessage = `${actionEmoji} **[${signalDecision.direction}] $${tokenSymbol.toUpperCase()}**
📊 ${text.price}: **$${formatPrice(currentPrice)}** | 🎯 ${text.confidence}: **${confidencePct}%** | ⚠️ ${text.risk}: **${riskLabel}**
⏰ ${text.timeframe}: **${timeframeLabel}** (${timeframeNote})

🗒️ *${text.marketSnapshot}*
${signalDecision.reasoning}

🔍 *${text.why}*
${whyBullets}

🎯 **${text.suggestedAction}**
${suggestedAction}

⚠️ ${text.dyor}`;

  const level = signalDecision.riskLevel === "HIGH" ? 3 : signalDecision.riskLevel === "MEDIUM" ? 2 : 1;

  return {
    finalSignal: {
      level: level as 1 | 2 | 3,
      title: `${actionEmoji} [${signalDecision.direction}] $${tokenSymbol.toUpperCase()}`,
      message: baseMessage,
      priority: signalDecision.riskLevel as "LOW" | "MEDIUM" | "HIGH",
      tags: [
        tokenSymbol.toLowerCase(),
        signalDecision.signalType.toLowerCase(),
        signalDecision.direction.toLowerCase(),
      ],
      buttons: createPhantomButtons(tokenAddress, tokenSymbol),
    },
  };
};

/**
 * Default response when no signal should be generated
 */
const createNoSignalResponse = (tokenAddress: string, tokenSymbol: string, userLanguage: string = "en") => {
  // English base text (will be translated by LLM if needed)
  const text = {
    watchTitle: "[WATCH]",
    status: "Status",
    monitoring: "Monitoring",
    market: "Market",
    neutralRange: "Neutral Range",
    risk: "Risk",
    nextCheck: "Next Check",
    analysisSummary: "Analysis Summary",
    technicalNormal:
      "Current technical indicators are within normal parameters. No significant trend breakouts or momentum shifts detected at this time.",
    whatThisMeans: "What This Means",
    priceConsolidating: "Price action is consolidating",
    noClearBias: "No clear directional bias established",
    marketWaiting: "Market waiting for catalyst",
    nextSteps: "Next Steps",
    continueMonitoring: "Continue monitoring for trend development",
    watchLevels: "Watch key support/resistance levels",
    stayAlert: "Stay alert for momentum changes",
    patienceMessage: "Sometimes the best trade is no trade. Patience often pays off in crypto markets!",
    notifyMessage: "We'll notify you when clearer opportunities emerge",
  };

  const baseMessage = `🔍 **${text.watchTitle} $${tokenSymbol.toUpperCase()}**
📊 ${text.status}: **${text.monitoring}** | 🎯 ${text.market}: **${text.neutralRange}** | ⚠️ ${text.risk}: **Low**
⏰ **${text.nextCheck}**: Regular monitoring mode

📈 **${text.analysisSummary}**
${text.technicalNormal}

🔄 **${text.whatThisMeans}**
• *${text.priceConsolidating}*
• *${text.noClearBias}*
• *${text.marketWaiting}*

⏰ **${text.nextSteps}**
• 👀 **${text.continueMonitoring}**
• 📊 **${text.watchLevels}**
• ⚡ **${text.stayAlert}**

💡 *${text.patienceMessage}*

🔔 _${text.notifyMessage}_`;

  return {
    finalSignal: {
      level: 1 as const,
      title: `🔍 ${text.watchTitle} $${tokenSymbol.toUpperCase()}`,
      message: baseMessage,
      priority: "LOW" as const,
      tags: [tokenSymbol.toLowerCase(), "monitoring", "neutral"],
      buttons: createPhantomButtons(tokenAddress, tokenSymbol),
    },
  };
};

/**
 * Signal Formatter Node
 * Formats generated signals for Telegram
 */
export const formatSignal = async (state: SignalGraphState): Promise<Partial<SignalGraphState>> => {
  try {
    logger.info("Starting signal formatting", {
      tokenAddress: state.tokenAddress,
      hasAnalysis: !!state.signalDecision,
      hasStaticFilter: !!state.staticFilterResult,
      hasTechnicalAnalysis: !!state.technicalAnalysis,
      userLanguage: state.userLanguage,
    });

    // When no signal should be generated
    if (!state.signalDecision?.shouldGenerateSignal) {
      logger.info("No signal required, creating monitoring response", {
        tokenAddress: state.tokenAddress,
        hasSignalDecision: !!state.signalDecision,
        shouldGenerateSignal: state.signalDecision?.shouldGenerateSignal,
        userLanguage: state.userLanguage,
      });
      return createNoSignalResponse(state.tokenAddress, state.tokenSymbol, state.userLanguage);
    }

    // Detailed validation of required data
    const missingData = [];
    if (!state.signalDecision) missingData.push("signalDecision");
    if (!state.technicalAnalysis) missingData.push("technicalAnalysis");
    if (!state.staticFilterResult) missingData.push("staticFilterResult");

    if (missingData.length > 0) {
      logger.error("Missing required data for signal formatting", {
        tokenAddress: state.tokenAddress,
        missingData,
        signalDecision: state.signalDecision ? "present" : "missing",
        technicalAnalysis: state.technicalAnalysis ? "present" : "missing",
        staticFilterResult: state.staticFilterResult ? "present" : "missing",
      });

      // Instead of creating a fallback error message, return empty object to skip signal generation
      logger.info("Missing required data, skipping signal generation", {
        tokenAddress: state.tokenAddress,
        tokenSymbol: state.tokenSymbol,
        missingData,
      });
      return {};
    }

    // Get language display name for better LLM context
    const languageDisplayName = getLanguageDisplayName(state.userLanguage || "en")
      .replace(
        /^🇸🇦 |^🇺🇸 |^🇯🇵 |^🇰🇷 |^🇨🇳 |^🇪🇸 |^🇫🇷 |^🇩🇪 |^🇷🇺 |^🇧🇷 |^🇮🇳 |^🇹🇭 |^🇻🇳 |^🇹🇷 |^🇵🇱 |^🇳🇱 |^🇸🇪 |^🇳🇴 |^🇩🇰 |^🇫🇮 |^🇨🇿 |^🇭🇺 |^🇷🇴 |^🇧🇬 |^🇭🇷 |^🇸🇰 |^🇸🇮 |^🇪🇪 |^🇱🇻 |^🇱🇹 |^🇬🇷 |^🇮🇱 |^🇮🇷 |^🇵🇰 |^🇧🇩 |^🇱🇰 |^🇲🇲 |^🇰🇭 |^🇱🇦 |^🇬🇪 |^🇦🇲 |^🇦🇿 |^🇰🇿 |^🇰🇬 |^🇺🇿 |^🇹🇯 |^🇲🇳 |^🇮🇩 |^🇲🇾 |^🇵🇭 |^🇰🇪 |^🇪🇹 |^🇳🇬 |^🇿�� |^🇲🇬 |^🇷🇼 |^🇸🇲 |^🇪🇷 |^🇵🇪 |^🇵🇭 |^🇭🇹 |^🇳🇿 |^🇫🇯 |^🇹🇴 |^🇼🇸 |^🇵🇫 |^🏝️ |^🇲🇹 |^🇮🇪 |^🏴󠁧󠁢󠁷󠁬󠁳󠁿 |^🏴 |^🇦🇺 |^🇨🇦 |^🇮🇹 |^🌐 /,
        "",
      )
      .trim();

    // Prepare and validate prompt variables
    const promptVariables = {
      tokenSymbol: state.tokenSymbol,
      tokenAddress: state.tokenAddress,
      signalType: state.signalDecision.signalType,
      direction: state.signalDecision.direction,
      currentPrice: state.currentPrice.toString(),
      confidence: Math.round(state.signalDecision.confidence * 100).toString(),
      riskLevel: state.signalDecision.riskLevel,
      timeframe: state.signalDecision.timeframe,
      reasoning: state.signalDecision.reasoning,
      keyFactors: state.signalDecision.keyFactors.join(", "),
      marketSentiment: state.signalDecision.marketSentiment,
      priceExpectation: state.signalDecision.priceExpectation,
      technicalData: JSON.stringify({
        rsi: state.technicalAnalysis.rsi,
        vwapDeviation: state.technicalAnalysis.vwap_deviation,
        percentB: state.technicalAnalysis.percent_b,
        adx: state.technicalAnalysis.adx,
        atrPercent: state.technicalAnalysis.atr_percent,
        obvZScore: state.technicalAnalysis.obv_zscore,
      }),
      language: languageDisplayName || "English",
    } as const;

    // Validate prompt variables
    const requiredVariables = [
      "tokenSymbol",
      "tokenAddress",
      "signalType",
      "direction",
      "currentPrice",
      "confidence",
      "riskLevel",
      "timeframe",
      "reasoning",
      "keyFactors",
      "marketSentiment",
      "priceExpectation",
      "technicalData",
      "language",
    ];
    const missingVariables = requiredVariables.filter(
      (key) =>
        promptVariables[key as keyof typeof promptVariables] === undefined ||
        promptVariables[key as keyof typeof promptVariables] === null ||
        promptVariables[key as keyof typeof promptVariables] === "",
    );

    if (missingVariables.length > 0) {
      logger.error("Missing or invalid prompt variables, using simple template fallback", {
        tokenAddress: state.tokenAddress,
        missingVariables,
        allVariables: Object.keys(promptVariables),
      });
      return createSimpleSignalResponse(state);
    }

    logger.info("Executing signal formatting with LLM", {
      tokenAddress: state.tokenAddress,
      signalType: state.signalDecision.signalType,
      direction: state.signalDecision.direction,
      confidence: state.signalDecision.confidence,
      userLanguage: state.userLanguage,
      languageDisplayName,
    });

    // LLM signal formatting
    const chain = signalFormattingPrompt.pipe(gpt4oMini.withStructuredOutput(signalFormattingSchema));

    logger.info("About to invoke LLM chain", {
      tokenAddress: state.tokenAddress,
      chainConfigured: true,
    });

    // Add timeout to prevent infinite hanging
    const result = (await Promise.race([
      chain.invoke(promptVariables),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("LLM formatting timeout after 60 seconds")), 60000),
      ),
    ])) as z.infer<typeof signalFormattingSchema>;

    logger.info("LLM formatting result received", {
      tokenAddress: state.tokenAddress,
      hasResult: !!result,
      level: result?.level,
      priority: result?.priority,
      hasMessage: !!result?.message,
      messageLength: result?.message?.length,
      userLanguage: state.userLanguage,
    });

    logger.info("Signal formatting completed", {
      tokenAddress: state.tokenAddress,
      level: result.level,
      priority: result.priority,
    });

    // Add buttons to the result
    const finalSignalWithButtons = {
      ...result,
      buttons: createPhantomButtons(state.tokenAddress, state.tokenSymbol),
    };

    return { finalSignal: finalSignalWithButtons };
  } catch (error) {
    logger.error("LLM signal formatting failed, using simple template fallback", {
      tokenAddress: state.tokenAddress,
      tokenSymbol: state.tokenSymbol,
      error: error instanceof Error ? error.message : error,
      userLanguage: state.userLanguage,
    });

    // Try simple template-based formatting as fallback
    if (state.signalDecision && state.signalDecision.shouldGenerateSignal) {
      logger.info("Using simple template-based signal formatting", {
        tokenAddress: state.tokenAddress,
        signalType: state.signalDecision.signalType,
        userLanguage: state.userLanguage,
      });
      return createSimpleSignalResponse(state);
    }

    // Instead of creating a fallback error message, return null to avoid user confusion
    // This prevents "Analysis Error" messages when other tokens are working fine
    logger.info("Signal formatting failed completely, skipping signal generation", {
      tokenAddress: state.tokenAddress,
      tokenSymbol: state.tokenSymbol,
    });

    return {};
  }
};
