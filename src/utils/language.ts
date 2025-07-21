import { ChatOpenAI } from "@langchain/openai";
import { LANGUAGE_DISPLAY_NAMES, LANGUAGE_GREETINGS } from "../constants/languages";
import { logger } from "./logger";

export interface DetectedLanguage {
  code: string;
  name: string;
  confidence: number;
}

/**
 * Detect language from user message using LLM
 */
export const detectLanguageFromMessage = async (message: string): Promise<DetectedLanguage | null> => {
  try {
    if (message.trim().length < 3) {
      return null;
    }

    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0,
    });

    const prompt = `Analyze the following message and detect its language.

Message: "${message}"

Respond with ONLY a JSON object in this exact format:
{
  "code": "ISO_639_language_code",
  "name": "Language Name",
  "confidence": confidence_score_0_to_1
}

Examples:
- For English: {"code": "en", "name": "English", "confidence": 0.95}
- For Japanese: {"code": "ja", "name": "Japanese", "confidence": 0.98}
- For Spanish: {"code": "es", "name": "Spanish", "confidence": 0.92}

Use standard ISO 639-1 codes when possible, ISO 639-2 for less common languages.
If you cannot detect the language with confidence > 0.7, respond with null.`;

    const response = await model.invoke(prompt);
    const responseText = response.content.toString().trim();

    logger.debug("detectLanguageFromMessage", "LLM response:", responseText);

    // Try to parse JSON response
    try {
      if (responseText === "null") {
        return null;
      }

      const parsed = JSON.parse(responseText) as DetectedLanguage;

      // Validate response structure
      if (!parsed.code || !parsed.name || typeof parsed.confidence !== "number") {
        logger.warn("detectLanguageFromMessage", "Invalid response structure:", parsed);
        return null;
      }

      // Only return if confidence is high enough
      if (parsed.confidence < 0.7) {
        logger.info("detectLanguageFromMessage", "Low confidence detection:", parsed);
        return null;
      }

      return {
        code: parsed.code.toLowerCase(),
        name: parsed.name,
        confidence: parsed.confidence,
      };
    } catch (parseError) {
      logger.error("detectLanguageFromMessage", "Failed to parse LLM response:", parseError);
      return null;
    }
  } catch (error) {
    logger.error("detectLanguageFromMessage", "Error detecting language:", error);
    return null;
  }
};

/**
 * Get language name from code for display purposes
 */
export const getLanguageDisplayName = (code: string): string => {
  return (
    LANGUAGE_DISPLAY_NAMES[code.toLowerCase() as keyof typeof LANGUAGE_DISPLAY_NAMES] || `🌐 ${code.toUpperCase()}`
  );
};

/**
 * Generate language instruction for LLM prompts based on user's language preference
 */
export const getLanguageInstruction = (languageCode?: string): string => {
  if (!languageCode || languageCode === "en") {
    return "Respond in English.";
  }

  // Get the display name for better context
  const displayName = getLanguageDisplayName(languageCode);
  const cleanLanguageName = displayName
    .replace(
      /^🇸🇦 |^🇺🇸 |^🇯🇵 |^🇰🇷 |^🇨🇳 |^🇪🇸 |^🇫🇷 |^🇩🇪 |^🇷🇺 |^🇧🇷 |^🇮🇳 |^🇹🇭 |^🇻🇳 |^🇹🇷 |^🇵🇱 |^🇳🇱 |^🇸🇪 |^🇳🇴 |^🇩🇰 |^🇫🇮 |^🇨🇿 |^🇭🇺 |^🇷🇴 |^🇧🇬 |^🇭🇷 |^🇸🇰 |^🇸🇮 |^🇪🇪 |^🇱🇻 |^🇱🇹 |^🇬🇷 |^🇮🇱 |^🇮🇷 |^🇵🇰 |^🇧🇩 |^🇱🇰 |^🇲🇲 |^🇰🇭 |^🇱🇦 |^🇬🇪 |^🇦🇲 |^🇦🇿 |^🇰🇿 |^🇰🇬 |^🇺🇿 |^🇹🇯 |^🇲🇳 |^🇮🇩 |^🇲🇾 |^🇵🇭 |^🇰🇪 |^🇪🇹 |^🇳🇬 |^🇿🇦 |^🇲🇬 |^🇷🇼 |^🇸🇴 |^🇪🇷 |^🇵🇪 |^🇵🇾 |^🇭🇹 |^🇳🇿 |^🇫🇯 |^🇹🇴 |^🇼🇸 |^🇵🇫 |^🏝️ |^🇲🇹 |^🇮🇪 |^🏴󠁧󠁢󠁷󠁬󠁳󠁿 |^🏴 |^🇦🇺 |^🇨🇦 |^🇮🇹 |^🌐 /,
      "",
    )
    .trim();

  return `IMPORTANT: You must respond in ${cleanLanguageName} (language code: ${languageCode}). All of your output must be in this language, including explanations, analysis, and any text content. Maintain the same professional tone and format, but use ${cleanLanguageName} language throughout your entire response.`;
};

/**
 * Get language-specific greeting based on user's language preference
 */
export const getLanguageGreeting = (languageCode?: string): string => {
  return LANGUAGE_GREETINGS[languageCode?.toLowerCase() as keyof typeof LANGUAGE_GREETINGS] || "👋";
};

/**
 * Translate text using LLM
 */
export const translateTextWithLLM = async (text: string, targetLanguage: string): Promise<string> => {
  try {
    // If target language is English or not provided, return original text
    if (!targetLanguage || targetLanguage === "en") {
      return text;
    }

    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0,
    });

    const languageDisplayName = getLanguageDisplayName(targetLanguage);
    const cleanLanguageName = languageDisplayName
      .replace(
        /^🇸🇦 |^🇺🇸 |^🇯🇵 |^🇰🇷 |^🇨🇳 |^🇪🇸 |^🇫🇷 |^🇩🇪 |^🇷🇺 |^🇧🇷 |^🇮🇳 |^🇹🇭 |^🇻🇳 |^🇹🇷 |^🇵🇱 |^🇳🇱 |^🇸🇪 |^🇳🇴 |^🇩🇰 |^🇫🇮 |^🇨🇿 |^🇭🇺 |^🇷🇴 |^🇧🇬 |^🇭🇷 |^🇸🇰 |^🇸🇮 |^🇪🇪 |^🇱🇻 |^🇱🇹 |^🇬🇷 |^🇮🇱 |^🇮🇷 |^🇵🇰 |^🇧🇩 |^🇱🇰 |^🇲🇲 |^🇰🇭 |^🇱🇦 |^🇬🇪 |^🇦🇲 |^🇦🇿 |^🇰🇿 |^🇰🇬 |^🇺🇿 |^🇹🇯 |^🇲🇳 |^🇮🇩 |^🇲🇾 |^🇵🇭 |^🇰🇪 |^🇪🇹 |^🇳🇬 |^🇿🇦 |^🇲🇬 |^🇷🇼 |^🇸🇴 |^🇪🇷 |^🇵🇪 |^🇵🇾 |^🇭🇹 |^🇳🇿 |^🇫🇯 |^🇹🇴 |^🇼🇸 |^🇵🇫 |^🏝️ |^🇲🇹 |^🇮🇪 |^🏴󠁧󠁢󠁷󠁬󠁳󠁿 |^🏴 |^🇦🇺 |^🇨🇦 |^🇮🇹 |^🌐 /,
        "",
      )
      .trim();

    const prompt = `Translate the following English text to ${cleanLanguageName} (language code: ${targetLanguage}).

Important guidelines:
- Maintain the same tone and style (professional trading/crypto context)
- Keep all formatting (Markdown, emojis, symbols like $, %, etc.) exactly as is
- Preserve technical terms, ticker symbols, numbers, and percentages
- Do not translate brand names or technical indicators (RSI, VWAP, etc.)
- Ensure the translation is natural and appropriate for crypto trading context

Text to translate:
"${text}"

Respond with ONLY the translated text, preserving all original formatting and structure.`;

    const response = await model.invoke(prompt);
    const translatedText = response.content.toString().trim();

    logger.debug("translateTextWithLLM", "Translation completed", {
      targetLanguage,
      cleanLanguageName,
      originalLength: text.length,
      translatedLength: translatedText.length,
    });

    return translatedText;
  } catch (error) {
    logger.error("translateTextWithLLM", "Translation failed, returning original text", {
      targetLanguage,
      error: error instanceof Error ? error.message : String(error),
    });
    // Return original text if translation fails
    return text;
  }
};
