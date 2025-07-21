import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { getLanguageInstruction } from "../../../utils/language";

/**
 * Signal Analysis Schema
 * Zod schema for validating structured output from LLM
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
 * Structured Output Parser for Signal Analysis
 */
export const parser = StructuredOutputParser.fromZodSchema(signalAnalysisSchema);

/**
 * Common template parts used across signal analysis prompts
 */
const BASE_TEMPLATE = `You are a professional crypto trading signal analyst who specializes in translating complex technical analysis into beginner-friendly insights. Your task is to analyze technical indicators and determine if a trading signal should be generated, while explaining the market situation in simple terms.`;

const ANALYSIS_GUIDELINES = `

## Analysis Guidelines

**Signal Generation Criteria:**
- Multiple market indicators must align (market consensus)
- Risk-reward ratio must be favorable (potential profit vs potential loss)
- Market conditions must support the signal direction (overall trend alignment)
- Confidence level must be above 60% (strong conviction in the analysis)

**Risk Assessment:**
- LOW: Single indicator trigger, stable market conditions, clear trend
- MEDIUM: Multiple indicators aligning, moderate price swings, developing trend changes
- HIGH: Strong market signals, high price volatility, major trend shifts or breakouts

**Timeframe Classification:**
- SHORT: Quick trades (minutes to hours) - for active traders
- MEDIUM: Swing trades (days to weeks) - for regular monitoring
- LONG: Position trades (weeks to months) - for patient investors

## Current Market Analysis

**Token**: {tokenSymbol} ({tokenAddress}) (Display token symbol with $ prefix and uppercase)
**Current Price**: {currentPrice}
**Analysis Time**: {timestamp}

**Market Health Indicators**:
- Market Momentum (RSI): {rsi} (shows if token is overbought/oversold)
- Price vs Average (VWAP Dev): {vwapDeviation}% (how far price is from normal trading range)
- Volatility Band Position (%B): {percentB} (position within expected price range)
- Trend Strength (ADX): {adx} (how strong the current trend is)
- Price Volatility (ATR%): {atrPercent}% (how much price typically moves)
- Volume Momentum (OBV): {obvZScore} (buying vs selling pressure)

**Automated Filter Results**:
- Triggered Market Signals: {triggeredIndicators}
- Potential Trade Opportunities: {signalCandidates}
- Market Agreement Score: {confluenceScore}
- Initial Risk Assessment: {riskLevel}

## Analysis Task

Based on this comprehensive market analysis, determine if a trading signal should be generated. Focus on explaining the market situation in terms that a beginner can understand, avoiding technical jargon where possible.

Consider:
1. How multiple indicators align to suggest market direction
2. What the current price action tells us about market sentiment
3. Risk-reward potential for different trading timeframes
4. Market volatility and its impact on trade safety

{formatInstructions}`;

const FINAL_INSTRUCTION = `

Provide your analysis based on the structured format requirements above, using beginner-friendly language in the reasoning`;

/**
 * Helper function to build signal analysis template with optional language support
 */
const buildSignalAnalysisTemplate = (userLanguage?: string): string => {
  const languageSection =
    userLanguage && userLanguage !== "en"
      ? `\nIMPORTANT: When providing the reasoning, marketSentiment, and priceExpectation fields, write them in the user's language. ${getLanguageInstruction(userLanguage)}`
      : "";

  const reasoningInstruction =
    userLanguage && userLanguage !== "en"
      ? ` (write reasoning, marketSentiment, and priceExpectation fields in ${userLanguage})`
      : "";

  return BASE_TEMPLATE + languageSection + ANALYSIS_GUIDELINES + FINAL_INSTRUCTION + reasoningInstruction + ".";
};

/**
 * Standard input variables for signal analysis prompts
 */
const SIGNAL_ANALYSIS_INPUT_VARIABLES = [
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
 * Signal Analysis Prompts
 *
 * Various prompt templates used in the signal generation process
 * - LLM analysis prompt
 * - Evidence evaluation prompt
 * - Signal formatting prompt
 *
 * Note: Token symbols should always be displayed with $ prefix and in uppercase (e.g., $BTC, $ETH)
 */

/**
 * LLM Signal Analysis Prompt
 * Composite analysis of technical indicators for signal generation (with beginner-friendly interpretation)
 */
export const signalAnalysisPrompt = new PromptTemplate({
  inputVariables: SIGNAL_ANALYSIS_INPUT_VARIABLES,
  template: buildSignalAnalysisTemplate(),
});

/**
 * Create language-aware signal analysis prompt
 */
export const createSignalAnalysisPrompt = (userLanguage?: string): PromptTemplate => {
  return new PromptTemplate({
    inputVariables: SIGNAL_ANALYSIS_INPUT_VARIABLES,
    template: buildSignalAnalysisTemplate(userLanguage),
  });
};

/**
 * Evidence Evaluation Prompt
 * Evaluation of external data sources to improve signal reliability
 */
export const evidenceEvaluationPrompt = new PromptTemplate({
  inputVariables: ["tokenSymbol", "signalType", "direction", "technicalReasoning", "externalSources"],
  template: `You are a crypto market research analyst evaluating external evidence to support or contradict technical trading signals.

## Evaluation Task

**Technical Signal Context:**
- Token: {tokenSymbol} (Display with $ prefix and uppercase)
- Signal Type: {signalType}
- Direction: {direction}
- Technical Reasoning: {technicalReasoning}

**External Data Sources:**
{externalSources}

## Evaluation Criteria

**Source Reliability:**
- Official announcements: High weight
- Verified news outlets: Medium-high weight
- Social media sentiment: Medium weight
- Unverified sources: Low weight

**Relevance Assessment:**
- Direct impact on token fundamentals
- Market timing alignment
- Causal relationship strength
- Historical precedent

**Confidence Scoring:**
- 0.9-1.0: Strong supporting evidence
- 0.7-0.8: Moderate supporting evidence
- 0.5-0.6: Neutral/mixed evidence
- 0.3-0.4: Contradictory evidence
- 0.0-0.2: Strong contradictory evidence

Analyze the external evidence and provide:
- relevantSources: array of most relevant data points
- overallConfidence: number (0-1)
- primaryCause: string (main driving factor if identified)
- recommendation: INCLUDE or EXCLUDE or UNCERTAIN`,
});

/**
 * Signal Formatting Prompt
 * Generation of user-friendly signal messages (easy to understand for beginners)
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
    "language", // NEW
  ],
  template: `You are a crypto trading signal formatter who excels at writing **concise, visually-scannable Telegram messages** that balance "easy actionability" with "intuitive explanation for users who do *not* understand technical analysis (TA)".

# IMPORTANT
Write the entire output in **{language}**. Do NOT mix languages except for unavoidable ticker symbols, indicator names, or numbers.

# Formatting Goals
1. A reader should instantly know **what action to take** (BUY / SELL / HOLD).
2. The short explanation must *feel* right even to beginners - use clear analogies instead of TA jargon.
3. Keep the layout rock-solid in both Telegram Markdown **and** HTML (avoid nested formatting that might break).

# Input Data Analysis
**Token**: {tokenSymbol} ({tokenAddress})
**Signal Type**: {signalType}
**Direction**: {direction}
**Current Price**: {currentPrice}
**Confidence**: {confidence}
**Risk Level**: {riskLevel}
**Timeframe**: {timeframe}
**Reasoning**: {reasoning}
**Key Factors**: {keyFactors}
**Market Sentiment**: {marketSentiment}
**Price Expectation**: {priceExpectation}
**Technical Data**: {technicalData}

# Message Format Requirements

Create a message following this improved structure:
- First line: [ACTION_EMOJI] **[ACTION] $TOKEN_SYMBOL**
- Second line: 📊 Price: **$PRICE** | 🎯 Confidence: **CONFIDENCE%** | ⚠️ Risk: **RISK_LEVEL**
- Third line: ⏰ Timeframe: **TIMEFRAME_LABEL** (TIMEFRAME_NOTE)
- Market Snapshot section with 1-2 sentences using analogies
- Why section with up to 3 technical indicator explanations
- Suggested Action section with concrete advice
- DYOR disclaimer

# Formatting Rules
- ACTION_EMOJI: BUY → 🚀, SELL → 🚨, NEUTRAL/HOLD → 📊
- ACTION: Use the direction value (BUY/SELL/HOLD)
- TOKEN_SYMBOL: Use tokenSymbol with $ prefix, uppercase (e.g., $BONK)
- PRICE: Format with appropriate decimal places (max 8 digits, prefer 5 for readability)
- CONFIDENCE: Integer percentage without space (e.g., 70%)
- RISK_LEVEL: Capitalize first letter of riskLevel (LOW → Low, MEDIUM → Medium, HIGH → High)
- TIMEFRAME_LABEL: SHORT → Short-term, MEDIUM → Mid-term, LONG → Long-term
- TIMEFRAME_NOTE:
  - SHORT → "1-4h re-check"
  - MEDIUM → "4-12h re-check"
  - LONG → "12-24h re-check"
- Use half-width dashes (-) throughout, never full-width (–)
- Write all explanations in {language}

# Output Instructions
Return **ONLY** a JSON object with these exact fields:
{{
  "level": 1 | 2 | 3,
  "title": "string (action emoji + [ACTION] + token symbol)",
  "message": "string (complete formatted message)",
  "priority": "LOW" | "MEDIUM" | "HIGH",
  "tags": ["array", "of", "strings"]
}}

Level assignment:
- 3: HIGH risk OR confidence ≥ 80%
- 2: MEDIUM risk OR confidence 60-79%
- 1: Otherwise

Write the complete formatted message based on the provided data, ensuring all text (except technical terms) is in {language}.`,
});
