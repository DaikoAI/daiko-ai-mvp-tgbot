import { z } from "zod";
import { createPhantomButtons } from "../../../lib/phantom";
import { logger } from "../../../utils/logger";
import { gpt4oMini } from "../../model";
import type { SignalGraphState } from "../graph-state";
import { signalFormattingPrompt } from "../prompts/signal-analysis";

/**
 * Button Schema for Telegram Inline Keyboard
 * Note: OpenAI Structured Outputs requires .optional().nullable() instead of just .optional()
 */
const ButtonSchema = z.object({
  text: z.string(),
  url: z.string().optional().nullable(),
  callback_data: z.string().optional().nullable(),
});

/**
 * Signal Formatting Schema
 * Zod schema for validating structured output from LLM
 */
const SignalFormattingSchema = z.object({
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  title: z.string(),
  message: z.string(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  tags: z.array(z.string()),
  buttons: z.array(ButtonSchema).optional(),
});

/**
 * Simple template-based signal formatter (LLM-free fallback)
 */
const createSimpleSignalResponse = (state: SignalGraphState) => {
  const { signalDecision, tokenSymbol, tokenAddress, currentPrice } = state;

  if (!signalDecision) {
    // fallback safety – should not happen as caller checks existence
    return createNoSignalResponse(tokenAddress, tokenSymbol);
  }

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
      ? "1-4 h re-check recommended"
      : signalDecision.timeframe === "MEDIUM"
        ? "4-12 h re-check recommended"
        : "12-24 h re-check recommended";

  // Build bullet list for Why section (max 3) --------------------------------
  const buildIndicatorBullets = () => {
    const bullets: string[] = [];
    const ta = state.technicalAnalysis;

    if (!ta) return bullets;

    // RSI
    if (ta.rsi !== null && ta.rsi !== undefined) {
      const rsiVal = Number(ta.rsi).toFixed(0);
      const interpretation = Number(ta.rsi) >= 70 ? "overbought" : Number(ta.rsi) <= 30 ? "oversold" : "neutral";
      bullets.push(`RSI ${rsiVal} - ${interpretation}`);
    }

    // Bollinger percent_b
    if (ta.percent_b !== null && ta.percent_b !== undefined) {
      const pB = Number(ta.percent_b);
      if (pB >= 1.0) bullets.push(`Bollinger +2σ breakout - price above upper band`);
      else if (pB <= 0.0) bullets.push(`Bollinger -2σ touch - price near lower band`);
    }

    // ADX
    if (ta.adx !== null && ta.adx !== undefined) {
      const adxVal = Number(ta.adx).toFixed(0);
      const strength = Number(ta.adx) >= 25 ? "strong trend" : "weak trend";
      bullets.push(`ADX ${adxVal} - ${strength}`);
    }

    return bullets.slice(0, 3);
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

  const message = `${actionEmoji} **[${signalDecision.direction}] ${tokenSymbol}** - ${riskLabel} Risk
Price: \`$${currentPrice.toString()}\`\tConfidence: **${confidencePct} %**
Timeframe: ${timeframeLabel} (${timeframeNote})

🗒️ *Market Snapshot*
${signalDecision.reasoning}

🔍 *Why?*
${whyBullets}

🎯 **Suggested Action**
${suggestedAction}

⚠️ DYOR - Always do your own research.`;

  const level = signalDecision.riskLevel === "HIGH" ? 3 : signalDecision.riskLevel === "MEDIUM" ? 2 : 1;

  return {
    finalSignal: {
      level: level as 1 | 2 | 3,
      title: `${actionEmoji} [${signalDecision.direction}] ${tokenSymbol}`,
      message,
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
const createNoSignalResponse = (tokenAddress: string, tokenSymbol: string) => {
  return {
    finalSignal: {
      level: 1 as const,
      title: `🔍 ${tokenSymbol} Market Watch`,
      message: `🔍 **${tokenSymbol} Market Analysis** 📊

⚡ **CURRENT STATUS**: *No Signal Generated*
🎯 **Market Condition**: Neutral trading range

📈 **Analysis Summary**
Current technical indicators are within normal parameters. No significant trend breakouts or momentum shifts detected at this time.

🔄 **What This Means**
• *Price action is consolidating*
• *No clear directional bias established*
• *Market waiting for catalyst*

⏰ **Next Steps**
• 👀 **Continue monitoring** for trend development
• 📊 **Watch key support/resistance levels**
• ⚡ **Stay alert** for momentum changes

💡 *Sometimes the best trade is no trade. Patience often pays off in crypto markets!*

🔔 _We'll notify you when clearer opportunities emerge_`,
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
    });

    // When no signal should be generated
    if (!state.signalDecision?.shouldGenerateSignal) {
      logger.info("No signal required, creating monitoring response", {
        tokenAddress: state.tokenAddress,
        hasSignalDecision: !!state.signalDecision,
        shouldGenerateSignal: state.signalDecision?.shouldGenerateSignal,
      });
      return createNoSignalResponse(state.tokenAddress, state.tokenSymbol);
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
      language: "English", // NEW - default language
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
      "language", // NEW
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
      promptVariables: {
        tokenSymbol: promptVariables.tokenSymbol,
        signalType: promptVariables.signalType,
        direction: promptVariables.direction,
        currentPrice: promptVariables.currentPrice,
        confidence: promptVariables.confidence,
      },
    });

    // LLM signal formatting
    const chain = signalFormattingPrompt.pipe(gpt4oMini.withStructuredOutput(SignalFormattingSchema));

    logger.info("About to invoke LLM chain", {
      tokenAddress: state.tokenAddress,
      chainConfigured: true,
    });

    const result = await chain.invoke(promptVariables);

    logger.info("LLM formatting result received", {
      tokenAddress: state.tokenAddress,
      hasResult: !!result,
      level: result?.level,
      priority: result?.priority,
      hasMessage: !!result?.message,
      messageLength: result?.message?.length,
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
      errorStack: error instanceof Error ? error.stack : undefined,
      errorName: error instanceof Error ? error.name : undefined,
      hasSignalDecision: !!state.signalDecision,
      hasTechnicalAnalysis: !!state.technicalAnalysis,
      hasStaticFilterResult: !!state.staticFilterResult,
      signalType: state.signalDecision?.signalType,
      direction: state.signalDecision?.direction,
    });

    // Try simple template-based formatting as fallback
    if (state.signalDecision && state.signalDecision.shouldGenerateSignal) {
      logger.info("Using simple template-based signal formatting", {
        tokenAddress: state.tokenAddress,
        signalType: state.signalDecision.signalType,
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
