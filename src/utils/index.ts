import { TIMEOUT_MS } from "../constants";
import type { StreamChunk } from "../types";
import { logger } from "./logger";

// timeout processing
export const createTimeoutPromise = (timeoutMs: number = TIMEOUT_MS): Promise<never> =>
  new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs));

export const dumpTokenUsage = (chunk: StreamChunk) => {
  // Dump token usage
  if (
    "analyzer" in chunk &&
    chunk.analyzer?.messages?.length > 0 &&
    chunk.analyzer.messages[chunk.analyzer.messages.length - 1]?.usage_metadata
  ) {
    logger.info(
      "message handler",
      "Usage metadata (analyzer)",
      chunk.analyzer.messages[chunk.analyzer.messages.length - 1].usage_metadata,
    );
  } else if (
    "generalist" in chunk &&
    chunk.generalist?.messages?.length > 0 &&
    chunk.generalist.messages[chunk.generalist.messages.length - 1]?.usage_metadata
  ) {
    logger.info(
      "message handler",
      "Usage metadata (generalist)",
      chunk.generalist.messages[chunk.generalist.messages.length - 1].usage_metadata,
    );
  }
};

export const isAnalyzerMessage = (chunk: StreamChunk) => {
  return "analyzer" in chunk && chunk.analyzer?.messages?.length > 0;
};

export const isGeneralistMessage = (chunk: StreamChunk) => {
  return "generalist" in chunk && chunk.generalist?.messages?.length > 0;
};

/**
 * Sleep utility for rate limiting
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Convert number or undefined to string or null
 * undefined値をnullに変換するヘルパー関数
 */
export const convertToString = (value: number | undefined): string | null => {
  return value !== undefined ? value.toString() : null;
};

// Escape function for MarkdownV2
export const escapeMarkdownV2 = (text: string): string => {
  return text.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
};

/**
 * Escape MarkdownV2 special characters while preserving AI-generated markdown syntax
 * Protects *bold*, _italic_, `code`, ```code blocks```, and other markdown while escaping problematic characters
 */
export const escapeMarkdownV2ForAI = (text: string): string => {
  // Step 1: Protect existing markdown syntax by replacing with placeholders
  const protectedPatterns: Array<{ placeholder: string; regex: RegExp; replacement: string }> = [
    // Code blocks (triple backticks)
    { placeholder: "__CODEBLOCK__", regex: /```([^`]+)```/g, replacement: "```$1```" },
    // Inline code (single backticks)
    { placeholder: "__INLINECODE__", regex: /`([^`]+)`/g, replacement: "`$1`" },
    // Bold text
    { placeholder: "__BOLD__", regex: /\*([^*]+)\*/g, replacement: "*$1*" },
    // Italic text
    { placeholder: "__ITALIC__", regex: /_([^_]+)_/g, replacement: "_$1_" },
    // Underlined text
    { placeholder: "__UNDERLINE__", regex: /__([^_]+)__/g, replacement: "__$1__" },
    // Strikethrough
    { placeholder: "__STRIKE__", regex: /~([^~]+)~/g, replacement: "~$1~" },
    // Spoiler
    { placeholder: "__SPOILER__", regex: /\|\|([^|]+)\|\|/g, replacement: "||$1||" },
  ];

  let processedText = text;
  const replacements: Array<{ placeholder: string; original: string }> = [];

  // Replace markdown patterns with placeholders
  protectedPatterns.forEach(({ placeholder, regex, replacement }) => {
    let match;
    let counter = 0;
    while ((match = regex.exec(processedText)) !== null) {
      const uniquePlaceholder = `${placeholder}_${counter++}_`;
      replacements.push({ placeholder: uniquePlaceholder, original: match[0] });
      processedText = processedText.replace(match[0], uniquePlaceholder);
      regex.lastIndex = 0; // Reset regex to avoid infinite loops
    }
  });

  // Step 2: Escape special characters in the remaining text
  processedText = processedText.replace(/[_*\[\]()~`>#+\-=|{}.!\\]/g, "\\$&");

  // Step 3: Restore protected markdown
  replacements.forEach(({ placeholder, original }) => {
    processedText = processedText.replace(placeholder, original);
  });

  return processedText;
};
