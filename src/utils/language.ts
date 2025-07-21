import { LANGUAGE_DISPLAY_NAMES } from "../constants/languages";

const FLAG_EMOJI_PATTERN =
  /^🇸🇦 |^🇺🇸 |^🇯🇵 |^🇰🇷 |^🇨🇳 |^🇪🇸 |^🇫🇷 |^🇩🇪 |^🇷🇺 |^🇧🇷 |^🇮🇳 |^🇹🇭 |^🇻🇳 |^🇹🇷 |^🇵🇱 |^🇳🇱 |^🇸🇪 |^🇳🇴 |^🇩🇰 |^🇫🇮 |^🇨🇿 |^🇭🇺 |^🇷🇴 |^🇧🇬 |^🇭🇷 |^🇸🇰 |^🇸🇮 |^🇪🇪 |^🇱🇻 |^🇱🇹 |^🇬🇷 |^🇮🇱 |^🇮🇷 |^🇵🇰 |^🇧🇩 |^🇱🇰 |^🇲🇲 |^🇰🇭 |^🇱🇦 |^🇬🇪 |^🇦🇲 |^🇦🇿 |^🇰🇿 |^🇰🇬 |^🇺🇿 |^🇹🇯 |^🇲🇳 |^🇮🇩 |^🇲🇾 |^🇵🇭 |^🇰🇪 |^🇪🇹 |^🇳🇬 |^🇿🇦 |^🇲🇬 |^🇷🇼 |^🇸🇴 |^🇪🇷 |^🇵🇪 |^🇵🇾 |^🇭🇹 |^🇳🇿 |^🇫🇯 |^🇹🇴 |^🇼🇸 |^🇵🇫 |^🏝️ |^🇲🇹 |^🇮🇪 |^🏴󠁧󠁢󠁷󠁬󠁳󠁿 |^🏴 |^🇦🇺 |^🇨🇦 |^🇮🇹 |^🌐 /;

/**
 * Language utilities for multilingual support
 *
 * This module provides utilities for language handling without making additional LLM calls.
 * Language localization is handled at the prompt level using getLanguageInstruction().
 */

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
  const cleanLanguageName = displayName.replace(FLAG_EMOJI_PATTERN, "").trim();

  return `IMPORTANT: You must respond in ${cleanLanguageName} (language code: ${languageCode}). All of your output must be in this language, including explanations, analysis, and any text content. Maintain the same professional tone and format, but use ${cleanLanguageName} language throughout your entire response.`;
};
