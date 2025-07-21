import { TIMEOUT_MS } from "../constants";
import { EXCLUDED_TOKENS } from "../constants/signal-cooldown";
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

// Escape function for HTML
export const escapeHTML = (text: string): string => {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

// Escape function for regular Markdown (minimal escaping)
export const escapeMarkdown = (text: string): string => {
  // Only escape characters that could interfere with basic markdown parsing
  // Don't escape * _ ` if they are part of intended markdown formatting
  return text;
};

/**
 * Check if a token should be excluded from signal generation
 */
export const isExcludedToken = (tokenAddress: string): { excluded: boolean; reason?: string } => {
  if (EXCLUDED_TOKENS.STABLECOINS.includes(tokenAddress)) {
    return { excluded: true, reason: "STABLECOIN" };
  }

  return { excluded: false };
};
