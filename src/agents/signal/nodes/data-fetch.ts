import { searchToken } from "../../../lib/tavily";
import type { TavilySearchResult } from "../../../types/tavily";
import { logger } from "../../../utils/logger";
import type { SignalGraphState } from "../graph-state";

// Constants for API limits and timeouts
const MAX_SEARCH_DURATION_MS = 30000; // 30 seconds

/**
 * Convert TavilySearchResult to the expected format for evidenceResults
 */
const convertToEvidenceFormat = (results: TavilySearchResult[]) => {
  return results.map((result) => ({
    title: result.title,
    url: result.url,
    content: result.content,
    score: result.score,
    domain: new URL(result.url).hostname,
    publishedDate: result.publishedDate,
  }));
};

/**
 * Enhanced Data Fetch Node using Tavily SDK wrapper
 */
export const fetchDataSources = async (state: SignalGraphState) => {
  const { tokenSymbol, tokenAddress } = state;
  const startTime = Date.now();

  logger.info("Starting enhanced data fetch with Tavily wrapper", {
    tokenSymbol,
    tokenAddress,
    maxDuration: MAX_SEARCH_DURATION_MS,
  });

  try {
    // Execute enhanced token search with current context
    const searchResult = await searchToken(tokenSymbol, {
      searchDepth: "basic",
      maxResults: 3,
    });

    const searchDuration = Date.now() - startTime;

    if (!searchResult || !searchResult.uniqueResults || searchResult.uniqueResults.length === 0) {
      logger.warn("No search results returned", {
        tokenSymbol,
        tokenAddress,
        searchDuration,
        responseCount: searchResult?.responseCount || 0,
      });

      return {
        evidenceResults: {
          relevantSources: [],
          searchQueries: [],
          totalResults: 0,
          searchTime: searchDuration,
          marketSentiment: "NEUTRAL" as const,
          primaryCause: "No relevant sources found",
          searchStrategy: "BASIC" as const,
          qualityScore: 0.1,
          newsCategory: "NEUTRAL" as const,
        },
      };
    }

    // Process and convert results
    const relevantSources = convertToEvidenceFormat(searchResult.uniqueResults);

    // Basic sentiment analysis based on content
    const sentimentKeywords = {
      bullish: ["bullish", "moon", "pump", "rocket", "green", "up", "rise", "gain", "profit", "buy"],
      bearish: ["bearish", "crash", "dump", "red", "down", "fall", "loss", "sell", "decline"],
    };

    let bullishCount = 0;
    let bearishCount = 0;

    relevantSources.forEach((source) => {
      const content = source.content.toLowerCase();
      bullishCount += sentimentKeywords.bullish.filter((word) => content.includes(word)).length;
      bearishCount += sentimentKeywords.bearish.filter((word) => content.includes(word)).length;
    });

    const marketSentiment =
      bullishCount > bearishCount * 1.2 ? "BULLISH" : bearishCount > bullishCount * 1.2 ? "BEARISH" : "NEUTRAL";

    // Calculate quality score based on relevance and recency
    // Calculate quality score based on relevance and recency
    const avgScore = relevantSources.length > 0
      ? relevantSources.reduce((sum, source) => sum + source.score, 0) / relevantSources.length
      : 0;
    const qualityScore = Math.min(avgScore * (relevantSources.length / 3), 1);

    logger.info("Data fetch completed successfully", {
      tokenSymbol,
      tokenAddress,
      resultsCount: relevantSources.length,
      searchDuration,
      marketSentiment,
      qualityScore: qualityScore.toFixed(2),
      responseCount: searchResult.responseCount,
    });

    return {
      evidenceResults: {
        relevantSources,
        searchQueries: [],
        totalResults: searchResult.allResults.length,
        searchTime: searchDuration,
        marketSentiment,
        primaryCause: null,
        searchStrategy: "BASIC" as const,
        qualityScore,
        newsCategory: marketSentiment as "BULLISH" | "BEARISH" | "NEUTRAL",
      },
    };
  } catch (error) {
    const searchDuration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("Data fetch failed", {
      tokenSymbol,
      tokenAddress,
      error: errorMessage,
      searchDuration,
    });

    // Check if the error is due to missing API key
    const isApiKeyError = errorMessage.includes("API key not configured");
    const primaryCause = isApiKeyError ? "Tavily API key not configured" : `Search failed: ${errorMessage}`;
    const searchStrategy = isApiKeyError ? ("SKIP" as const) : ("FAILED" as const);

    return {
      evidenceResults: {
        relevantSources: [],
        searchQueries: [],
        totalResults: 0,
        searchTime: searchDuration,
        marketSentiment: "NEUTRAL" as const,
        primaryCause,
        searchStrategy,
        qualityScore: 0,
        newsCategory: "NEUTRAL" as const,
      },
    };
  }
};
