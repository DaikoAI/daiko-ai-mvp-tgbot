import { searchAggregated } from "../../../lib/tavily";
import type { TavilySearchResult } from "../../../types/tavily";
import { logger } from "../../../utils/logger";
import type { SignalGraphState } from "../graph-state";

// Constants for API limits and timeouts
const MAX_SEARCH_DURATION_MS = 30000; // 30 seconds

// High-quality domains for fundamental analysis
const FUNDAMENTAL_DOMAINS = [
  "cryptoslate.com",
  "decrypt.co",
  "theblock.co",
  "coindesk.com",
  "cointelegraph.com",
  "blockworks.co",
  "messari.io",
  "defipulse.com",
  "dappradar.com",
  "bankless.com",
  "chainanalysis.com",
  "nansen.ai",
  "glassnode.com",
  "x.com",
  "twitter.com",
  "reddit.com",
  "medium.com",
  "substack.com",
];

// Low-quality domains to exclude
const EXCLUDED_DOMAINS = [
  "coinmarketcap.com",
  "coingecko.com",
  "dexscreener.com",
  "dextools.io",
  "tradingview.com",
  "investing.com",
  "yahoo.com",
  "marketwatch.com",
];

/**
 * Create enhanced search queries for fundamental analysis
 */
const createFundamentalQueries = (tokenSymbol: string, tokenAddress?: string) => {
  const baseQueries = [
    // Fundamental analysis focused queries
    `${tokenSymbol} token fundamentals utility roadmap team`,
    `${tokenSymbol} crypto ecosystem partnerships adoption`,
    `${tokenSymbol} blockchain technology use case real world`,
    `${tokenSymbol} tokenomics supply demand economics`,
    `${tokenSymbol} developer activity community governance`,
  ];

  // Add address-specific queries if available
  if (tokenAddress) {
    baseQueries.push(
      `${tokenAddress} token contract analysis security audit`,
      `${tokenSymbol} ${tokenAddress} on-chain metrics holder distribution`,
    );
  }

  return baseQueries;
};

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
 * Enhanced Data Fetch Node using Tavily SDK wrapper with fundamental analysis focus
 * Returns raw source data for LLM-based sentiment analysis in llm-analysis step
 */
export const fetchDataSources = async (state: SignalGraphState) => {
  const { tokenSymbol, tokenAddress } = state;
  const startTime = Date.now();

  logger.info("Starting enhanced fundamental data fetch", {
    tokenSymbol,
    tokenAddress,
    maxDuration: MAX_SEARCH_DURATION_MS,
    fundamentalDomains: FUNDAMENTAL_DOMAINS.length,
    excludedDomains: EXCLUDED_DOMAINS.length,
  });

  try {
    // Create enhanced fundamental analysis queries
    const fundamentalQueries = createFundamentalQueries(tokenSymbol, tokenAddress);

    // Execute enhanced search with domain filtering
    const searchResult = await searchAggregated({
      queries: fundamentalQueries,
      searchDepth: "advanced", // Use advanced search for better quality
      maxResults: 20, // 2 results per query for more diverse sources
      deduplicateResults: true,
    });

    const searchDuration = Date.now() - startTime;

    if (!searchResult || !searchResult.uniqueResults || searchResult.uniqueResults.length === 0) {
      logger.warn("No fundamental search results returned", {
        tokenSymbol,
        tokenAddress,
        searchDuration,
        queriesUsed: fundamentalQueries.length,
        responseCount: searchResult?.responseCount || 0,
      });

      return {
        evidenceResults: {
          relevantSources: [],
          searchQueries: fundamentalQueries,
          totalResults: 0,
          searchTime: searchDuration,
          qualityScore: 0.1,
          searchStrategy: "FUNDAMENTAL" as const,
        },
      };
    }

    // Process and convert results with quality filtering
    const allSources = convertToEvidenceFormat(searchResult.uniqueResults);

    // Filter out excluded domains and prioritize fundamental domains
    const qualitySources = allSources
      .filter((source) => !EXCLUDED_DOMAINS.includes(source.domain))
      .sort((a, b) => {
        const aIsFundamental = FUNDAMENTAL_DOMAINS.includes(a.domain);
        const bIsFundamental = FUNDAMENTAL_DOMAINS.includes(b.domain);

        if (aIsFundamental && !bIsFundamental) return -1;
        if (!aIsFundamental && bIsFundamental) return 1;
        return b.score - a.score; // Sort by score if both are same tier
      })
      .slice(0, 5); // Limit to top 5 quality sources

    // Calculate quality score based on source quality and relevance
    const fundamentalSourceCount = qualitySources.filter((s) => FUNDAMENTAL_DOMAINS.includes(s.domain)).length;

    // Quality score weights based on empirical testing
    const SCORE_WEIGHT = 0.7; // Weight for average relevance score
    const FUNDAMENTAL_WEIGHT = 0.3; // Weight for fundamental source ratio

    const avgScore =
      qualitySources.length > 0
        ? qualitySources.reduce((sum, source) => sum + source.score, 0) / qualitySources.length
        : 0;

    const fundamentalRatio = qualitySources.length > 0 ? fundamentalSourceCount / qualitySources.length : 0;

    const qualityScore = Math.min(avgScore * SCORE_WEIGHT + fundamentalRatio * FUNDAMENTAL_WEIGHT, 1);

    logger.info("Fundamental data fetch completed", {
      tokenSymbol,
      tokenAddress,
      totalSources: allSources.length,
      qualitySources: qualitySources.length,
      fundamentalSources: fundamentalSourceCount,
      searchDuration,
      qualityScore: qualityScore.toFixed(2),
      responseCount: searchResult.responseCount,
    });

    return {
      evidenceResults: {
        relevantSources: qualitySources,
        searchQueries: fundamentalQueries,
        totalResults: searchResult.allResults.length,
        searchTime: searchDuration,
        qualityScore,
        searchStrategy: "FUNDAMENTAL" as const,
      },
    };
  } catch (error) {
    const searchDuration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("Fundamental data fetch failed", {
      tokenSymbol,
      tokenAddress,
      error: errorMessage,
      searchDuration,
    });

    // Check if the error is due to missing API key
    const isApiKeyError = errorMessage.includes("API key not configured");
    const searchStrategy = isApiKeyError ? ("SKIP" as const) : ("FAILED" as const);

    return {
      evidenceResults: {
        relevantSources: [],
        searchQueries: [],
        totalResults: 0,
        searchTime: searchDuration,
        qualityScore: 0,
        searchStrategy,
      },
    };
  }
};
