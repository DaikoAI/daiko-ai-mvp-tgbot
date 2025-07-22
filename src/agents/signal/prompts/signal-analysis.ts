import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";

/**
 * Schema for structured signal analysis output
 */
export const signalAnalysisSchema = z.object({
  shouldGenerateSignal: z.boolean(),
  signalType: z.string(),
  direction: z.enum(["BUY", "SELL", "NEUTRAL"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  keyFactors: z.array(z.string()).max(3),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  timeframe: z.enum(["SHORT", "MEDIUM", "LONG"]),
  marketSentiment: z.string(),
  priceExpectation: z.string(),
});

/**
 * Parser for structured output validation
 */
export const parser = StructuredOutputParser.fromZodSchema(signalAnalysisSchema);

/**
 * Standard input variables for signal analysis
 */
const ANALYSIS_INPUT_VARIABLES = [
  "tokenSymbol",
  "tokenAddress",
  "currentPrice",
  "timestamp",
  "rsi",
  "vwapDeviation",
  "percentB",
  "adx",
  "atrPercent",
  "obvZScore",
  "triggeredIndicators",
  "signalCandidates",
  "confluenceScore",
  "riskLevel",
  "formatInstructions",
];

/**
 * Main signal analysis prompt for LLM evaluation
 */
export const signalAnalysisPrompt = new PromptTemplate({
  inputVariables: ANALYSIS_INPUT_VARIABLES,
  template: `You are a professional crypto trading signal analyst specializing in beginner-friendly technical analysis interpretation.

## Analysis Guidelines

**Signal Generation Criteria:**
- Multiple indicators must align (market consensus)
- Favorable risk-reward ratio
- Clear directional bias with 60%+ confidence

**Risk Assessment:**
- LOW: Single indicator, stable conditions, clear trend
- MEDIUM: Multiple indicators, moderate volatility, trend changes
- HIGH: Strong signals, high volatility, major breakouts

**Timeframe Classification:**
- SHORT: Minutes to hours (active trading)
- MEDIUM: Days to weeks (swing trading)
- LONG: Weeks to months (position trading)

## Market Data

**Token**: {tokenSymbol} ({tokenAddress})
**Price**: {currentPrice} | **Time**: {timestamp}

**Technical Indicators:**
- RSI: {rsi} (momentum strength)
- VWAP Deviation: {vwapDeviation}% (price vs average)
- Bollinger %B: {percentB} (volatility position)
- ADX: {adx} (trend strength)
- ATR: {atrPercent}% (volatility level)
- OBV Z-Score: {obvZScore} (volume momentum)

**Filter Results:**
- Triggered: {triggeredIndicators}
- Candidates: {signalCandidates}
- Confluence: {confluenceScore}
- Risk: {riskLevel}

## Task

Analyze the data and determine if a trading signal should be generated. Use beginner-friendly explanations focusing on:
1. How indicators align for market direction
2. Current market sentiment and momentum
3. Risk-reward potential across timeframes
4. Market volatility impact on safety

{formatInstructions}

Provide structured analysis with clear, accessible reasoning.`,
});

/**
 * Evidence evaluation prompt for external data validation
 */
export const evidenceEvaluationPrompt = new PromptTemplate({
  inputVariables: ["tokenSymbol", "signalType", "direction", "technicalReasoning", "externalSources"],
  template: `You are evaluating external evidence to support or contradict technical trading signals.

**Signal Context:**
- Token: {tokenSymbol}
- Type: {signalType}
- Direction: {direction}
- Technical Basis: {technicalReasoning}

**External Sources:**
{externalSources}

**Evaluation Criteria:**
- Source reliability (official > verified > social > unverified)
- Market timing alignment
- Historical precedent strength
- Direct fundamental impact

**Confidence Scale:**
- 0.9-1.0: Strong supporting evidence
- 0.7-0.8: Moderate support
- 0.5-0.6: Neutral/mixed
- 0.3-0.4: Contradictory
- 0.0-0.2: Strong contradiction

Provide: relevantSources, overallConfidence (0-1), primaryCause, recommendation (INCLUDE/EXCLUDE/UNCERTAIN)`,
});

/**
 * Signal formatting prompt for user-friendly Telegram messages
 */
export const signalFormattingPrompt = new PromptTemplate({
  inputVariables: [
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
  ],
  template: `You are a crypto signal formatter creating concise, scannable Telegram messages.

# IMPORTANT
Write the entire output in **{language}**. Use half-width dashes (-) throughout.

# Input Analysis
**Token**: {tokenSymbol} ({tokenAddress})
**Signal**: {signalType} | **Direction**: {direction}
**Price**: {currentPrice} | **Confidence**: {confidence}%
**Risk**: {riskLevel} | **Timeframe**: {timeframe}
**Reasoning**: {reasoning}
**Factors**: {keyFactors}
**Technical**: {technicalData}

# Required Format (EXACT):
Line 1: [EMOJI] [ACTION] [tokenname] - [Risk Level] Risk
Line 2: Price: $[PRICE] Confidence: [X] %
Line 3: Timeframe: [TIMEFRAME] ([recheck] recommended)
Line 4: (empty)
Line 5: 🗒️ Market Snapshot
Line 6: [Brief market explanation]
Line 7: (empty)
Line 8: 🔍 Why?
Line 9-11: • [Technical indicator] - [simple description]
Line 12: (empty)
Line 13: 🎯 Suggested Action
Line 14: [Action recommendation]
Line 15: (empty)
Line 16: ⚠️ DYOR - Always do your own research.

# Format Rules
**Emojis**: BUY → 🚀, SELL → 🚨, NEUTRAL → 📊
**Token**: lowercase (e.g., titcoin not TITCOIN)
**Price**: Full precision as provided (e.g., $0.012491810862262155)
**Confidence**: Plain integer without % in confidence field, but add % after
**Risk**: Title case (Low/Medium/High) + " Risk"
**Timeframes**:
- SHORT → Short-term (1-4h re-check)
- MEDIUM → Mid-term (4-12h re-check)
- LONG → Long-term (12-24h re-check)

# Technical Indicators Format
Extract 3 key indicators from technicalData and format as:
• [IndicatorName] [Value] - [simple condition]

Examples:
• RSI 76 - overbought
• Bollinger +2σ breakout - price above upper band
• ADX 13 - weak trend

# Output
Return JSON with: level (1|2|3), title, message, priority (LOW|MEDIUM|HIGH), tags (array)

**Level assignment:**
- 3: HIGH risk OR confidence ≥ 80%
- 2: MEDIUM risk OR confidence 60-79%
- 1: Otherwise

Create the exact format shown above in {language}.`,
});
