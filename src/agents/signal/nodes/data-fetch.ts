import { searchAggregated } from "../../../lib/serper-search";
import type { TavilySearchResult } from "../../../types/tavily";
import { logger } from "../../../utils/logger";
import type { SignalGraphState } from "../graph-state";

// Constants for API limits and timeouts
const MAX_SEARCH_DURATION_MS = 30000; // 30 seconds

// High-quality domains for fundamental analysis
const FUNDAMENTAL_DOMAINS = [
  "coindesk.com",
  "cointelegraph.com",
  "theblock.co",
  "decrypt.co",
  "bankless.com",
  "messari.io",
  "defipulse.com",
  "dappradar.com",
  "chainanalysis.com",
  "nansen.ai",
  "glassnode.com",
  "github.com",
  "medium.com",
  "blog.ethereum.org",
];

// Low-quality domains to exclude for fundamental analysis
const EXCLUDED_DOMAINS = [
  "coinmarketcap.com",
  "coingecko.com",
  "dexscreener.com",
  "dextools.io",
  "tradingview.com",
  "investing.com",
  "yahoo.com",
  "marketwatch.com",
  "reddit.com",
  "twitter.com",
  "x.com",
];

/**
 * Create comprehensive search queries for fundamental analysis
 * Returns queries optimized for token-specific fundamental information
 */
const createFundamentalQueries = (tokenSymbol: string, tokenAddress?: string) => {
  // Comprehensive fundamental analysis queries
  const queries = [
    `${tokenSymbol} cryptocurrency fundamental analysis 2024`,
    `${tokenSymbol} token roadmap partnerships announcements`,
    `${tokenSymbol} blockchain adoption use cases development`,
    `${tokenSymbol} price prediction analyst reports research`,
    `${tokenSymbol} tokenomics supply distribution staking`,
  ];

  // Add contract and technical analysis queries if address is provided
  if (tokenAddress) {
    queries.push(
      `${tokenSymbol} smart contract audit security report`,
      `${tokenSymbol} development activity github commits`
    );
  }

  return queries;
};

/**
 * Convert search results to the expected format for evidenceResults
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
 * Enhanced Data Fetch Node using Serper API for token fundamental analysis
 * Returns raw source data for LLM-based sentiment analysis in llm-analysis step
 */
export const fetchDataSources = async (state: SignalGraphState) => {
  const { tokenSymbol, tokenAddress } = state;
  const startTime = Date.now();

  logger.info("Starting fundamental data fetch via Serper API", {
    tokenSymbol,
    tokenAddress,
    maxDuration: MAX_SEARCH_DURATION_MS,
    fundamentalDomains: FUNDAMENTAL_DOMAINS.length,
    searchMethod: "SERPER_SEARCH",
  });

  try {
    // Create comprehensive queries for fundamental analysis
    const fundamentalQueries = createFundamentalQueries(tokenSymbol, tokenAddress);

    // Execute Serper API search for fundamental analysis
    const searchResult = await searchAggregated({
      queries: fundamentalQueries,
      searchDepth: "advanced", // Use advanced search for comprehensive coverage
      maxResults: 20, // Get more results for better fundamental analysis
      deduplicateResults: true,
    });

    const searchDuration = Date.now() - startTime;

    if (!searchResult || !searchResult.uniqueResults || searchResult.uniqueResults.length === 0) {
      logger.warn("No fundamental analysis results returned", {
        tokenSymbol,
        tokenAddress,
        searchDuration,
        queryUsed: fundamentalQueries,
        responseCount: searchResult?.responseCount || 0,
      });

      return {
        evidenceResults: {
          relevantSources: [],
          searchQueries: fundamentalQueries,
          totalResults: 0,
          searchTime: searchDuration,
          qualityScore: 0.1,
          searchStrategy: "FUNDAMENTAL_SEARCH" as const,
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
      .slice(0, 10); // Limit to top 10 quality sources

    // Calculate quality score based on source quality and relevance
    const fundamentalSourceCount = qualitySources.filter((s) => FUNDAMENTAL_DOMAINS.includes(s.domain)).length;

    // Quality score weights based on source reliability and relevance
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
      searchMethod: "SERPER_SEARCH",
    });

    return {
      evidenceResults: {
        relevantSources: qualitySources,
        searchQueries: fundamentalQueries,
        totalResults: searchResult.allResults.length,
        searchTime: searchDuration,
        qualityScore,
        searchStrategy: "FUNDAMENTAL_SEARCH" as const,
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

    return {
      evidenceResults: {
        relevantSources: [],
        searchQueries: [],
        totalResults: 0,
        searchTime: searchDuration,
        qualityScore: 0,
        searchStrategy: "FAILED" as const,
      },
    };
  }
};
