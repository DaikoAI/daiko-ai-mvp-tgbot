import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";

/**
 * Schema for structured signal analysis output with integrated sentiment analysis
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
  marketSentiment: z
    .enum(["BULLISH", "BEARISH", "NEUTRAL"])
    .describe("Overall market sentiment based on news sources analysis"),
  sentimentConfidence: z.number().min(0).max(1).describe("Confidence in the sentiment analysis"),
  sentimentFactors: z.array(z.string()).max(5).describe("Key factors influencing market sentiment"),
  priceExpectation: z.string(),
});

/**
 * Parser for structured output validation
 */
export const parser = StructuredOutputParser.fromZodSchema(signalAnalysisSchema);

/**
 * Standard input variables for signal analysis with sentiment analysis
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
  "externalSources",
  "sourcesCount",
  "qualityScore",
];

/**
 * Main signal analysis prompt for LLM evaluation with integrated sentiment analysis
 */
export const signalAnalysisPrompt = new PromptTemplate({
  inputVariables: ANALYSIS_INPUT_VARIABLES,
  template: `You are a professional crypto trading signal analyst specializing in beginner-friendly technical analysis interpretation and market sentiment analysis.

## Analysis Guidelines

**Signal Generation Criteria:**
- Multiple indicators must align (market consensus)
- Favorable risk-reward ratio
- Clear directional bias with 60%+ confidence
- External sentiment should support or not contradict technical signals

**Risk Assessment:**
- LOW: Single indicator, stable conditions, clear trend
- MEDIUM: Multiple indicators, moderate volatility, trend changes
- HIGH: Strong signals, high volatility, major breakouts

**Timeframe Classification:**
- SHORT: Minutes to hours (active trading)
- MEDIUM: Days to weeks (swing trading)
- LONG: Weeks to months (position trading)

**Sentiment Analysis Factors:**
- Technology developments and innovations
- Partnerships and ecosystem adoption
- Regulatory developments
- Market trends and trader sentiment
- Community and developer activity
- Risk factors and security concerns

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

**External News Sources (Quality Score: {qualityScore}):**
{externalSources}

## Task

Perform both technical signal analysis AND sentiment analysis:

### 1. Technical Analysis
Determine if a trading signal should be generated based on technical indicators.

### 2. Sentiment Analysis
Analyze the external news sources to determine market sentiment:
- Extract key fundamental factors
- Assess overall sentiment (BULLISH/BEARISH/NEUTRAL)
- Provide confidence level in sentiment analysis
- Consider source quality and relevance

### 3. Combined Analysis
Integrate technical and sentiment analysis to make final signal decision.

Focus on beginner-friendly explanations covering:
1. How indicators align for market direction
2. Market sentiment based on news analysis
3. Risk-reward potential across timeframes
4. Market volatility impact on safety
5. How external sentiment supports or contradicts technical analysis

CRITICAL: Use only half-width dashes (-) and standard punctuation. Never use em-dashes (—) or en-dashes (–).

{formatInstructions}

Provide structured analysis with clear, accessible reasoning for both technical and sentiment components.`,
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

# CRITICAL FORMATTING
Write the entire output in **{language}**. ALWAYS use half-width dashes (-) and punctuation marks.
NEVER use full-width dashes (—, –) or em-dashes. Replace any full-width punctuation with half-width equivalents.

# Input Analysis
**Token**: {tokenSymbol} ({tokenAddress})
**Signal**: {signalType} | **Direction**: {direction}
**Price**: {currentPrice} | **Confidence**: {confidence}%
**Risk**: {riskLevel} | **Timeframe**: {timeframe}
**Reasoning**: {reasoning}
**Factors**: {keyFactors}
**Technical**: {technicalData}

# Required Format (EXACT):
Line 1: [EMOJI] [ACTION] $[TOKENNAME]
Line 2: Risk: [Risk Level] Risk
Line 3: Price: $[PRICE] Confidence: [X] %
Line 4: Timeframe: [TIMEFRAME] ([recheck] recommended)
Line 5: (empty)
Line 6: **🗒️ Market Snapshot**
Line 7: [Brief market explanation]
Line 8: (empty)
Line 9: **🔍 Why?**
Line 10-12: ● [Technical indicator] - [simple description]
Line 13: (empty)
Line 14: **🎯 Suggested Action**
Line 15: [Action recommendation]
Line 16: (empty)
Line 17: ⚠️ DYOR - Always do your own research.

# Format Rules
**Emojis**: BUY → 🚀, SELL → 🚨, NEUTRAL → 📊
**Token**: uppercase with $ prefix (e.g., $TITCOIN not titcoin)
**Price**: Full precision as provided (e.g., $0.012491810862262155)
**Confidence**: Plain integer without % in confidence field, but add % after
**Risk**: Title case (Low/Medium/High) + " Risk"
**Timeframes**:
- SHORT → Short-term (1-4h re-check)
- MEDIUM → Mid-term (4-12h re-check)
- LONG → Long-term (12-24h re-check)

# Technical Indicators Format
Extract 3 key indicators from technicalData and format as:
● [IndicatorName] [Value] - [simple condition]

Examples:
● RSI 76 - overbought
● Bollinger +2σ breakout - price above upper band
● ADX 13 - weak trend

# Output
Return JSON with: level (1|2|3), title, message, priority (LOW|MEDIUM|HIGH), tags (array)

**Level assignment:**
- 3: HIGH risk OR confidence ≥ 80%
- 2: MEDIUM risk OR confidence 60-79%
- 1: Otherwise

Create the exact format shown above in {language}.`,
});
