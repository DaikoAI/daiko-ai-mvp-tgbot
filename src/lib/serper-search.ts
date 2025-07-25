import type { TavilyAggregatedSearchResult, TavilySearchResult } from "../types/tavily";
import { logger } from "../utils/logger";

// Serper API configuration
const SERPER_API_URL = "https://google.serper.dev/search";
const SEARCH_TIMEOUT_MS = 30000;

interface SerperSearchResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
  position: number;
}

interface SerperApiResponse {
  organic: SerperSearchResult[];
  searchParameters: {
    q: string;
    gl: string;
    hl: string;
  };
  searchInformation: {
    totalResults: string;
    timeTaken: number;
  };
}

/**
 * Execute a search using Serper API (Google Search)
 */
const executeSerperSearch = async (query: string, maxResults: number): Promise<SerperSearchResult[]> => {
  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    logger.warn("SERPER_API_KEY not configured, skipping search");
    return [];
  }

  try {
    logger.debug("Executing Serper search", { query, maxResults });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    const response = await fetch(SERPER_API_URL, {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        num: maxResults,
        gl: "us", // Country
        hl: "en", // Language
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status} ${response.statusText}`);
    }

    const data: SerperApiResponse = await response.json();
    const results = data.organic || [];

    logger.debug("Serper search completed", {
      query,
      resultsCount: results.length,
      totalResults: data.searchInformation?.totalResults
    });

    return results.slice(0, maxResults);

  } catch (error) {
    logger.error("Serper search failed", { query, error });
    return [];
  }
};

/**
 * Convert Serper results to Tavily format for compatibility
 */
const convertSerperToTavilyFormat = (serperResults: SerperSearchResult[]): TavilySearchResult[] => {
  return serperResults
    .filter(result => result.title && result.link && result.snippet)
    .map((result, index) => ({
      title: result.title,
      url: result.link,
      content: result.snippet,
      score: Math.max(0.1, 1.0 - (index * 0.05)), // Decreasing score based on position
      publishedDate: result.date,
    }));
};

/**
 * Create targeted search queries for token fundamental analysis
 */
const createFundamentalQueries = (tokenSymbol: string, tokenAddress?: string): string[] => {
  const baseQueries = [
    `${tokenSymbol} cryptocurrency fundamental analysis 2024`,
    `${tokenSymbol} token roadmap partnerships news`,
    `${tokenSymbol} blockchain adoption use cases`,
    `${tokenSymbol} price prediction analyst reports`,
    `${tokenSymbol} development activity github commits`,
  ];

  // Add contract-specific queries if address is provided
  if (tokenAddress) {
    baseQueries.push(
      `${tokenSymbol} smart contract audit security ${tokenAddress}`,
      `${tokenSymbol} tokenomics supply distribution`
    );
  }

  return baseQueries;
};

/**
 * Execute a single search query
 */
export const search = async (
  query: string,
  options?: { maxResults?: number }
): Promise<TavilySearchResult[]> => {
  const maxResults = options?.maxResults || 5;

  try {
    const serperResults = await executeSerperSearch(query, maxResults);
    return convertSerperToTavilyFormat(serperResults);
  } catch (error) {
    logger.error("Search failed", { query, error });
    return [];
  }
};

/**
 * Execute multiple search queries in parallel
 */
export const searchMultiple = async (
  queries: string[],
  options?: { maxResults?: number }
): Promise<TavilySearchResult[][]> => {
  if (queries.length === 0) {
    return [];
  }

  logger.debug("Executing multiple Serper searches", { count: queries.length });

  try {
    const searchPromises = queries.map((query) => search(query, options));
    const results = await Promise.allSettled(searchPromises);

    const successfulResults: TavilySearchResult[][] = [];
    const failedSearches: Array<{ query: string; error: unknown }> = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successfulResults.push(result.value);
      } else {
        failedSearches.push({
          query: queries[index] ?? `search-${index}`,
          error: result.reason,
        });
      }
    });

    if (failedSearches.length > 0) {
      logger.warn("Some Serper searches failed", {
        successful: successfulResults.length,
        failed: failedSearches.length,
        failedQueries: failedSearches.map((f) => f.query),
      });
    }

    return successfulResults;
  } catch (error) {
    logger.error("Multiple Serper searches failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Multiple Serper searches failed");
  }
};

/**
 * Aggregated search interface for token fundamental analysis
 */
export const searchAggregated = async (options: {
  queries: string[];
  searchDepth?: "basic" | "advanced";
  maxResults?: number;
  deduplicateResults?: boolean;
}): Promise<TavilyAggregatedSearchResult> => {
  const maxResultsPerQuery = options.searchDepth === "advanced"
    ? Math.ceil((options.maxResults || 15) / options.queries.length)
    : 3;

  const searchResults = await searchMultiple(options.queries, {
    maxResults: maxResultsPerQuery,
  });

  const allResults = searchResults.flat();

  let uniqueResults = allResults;
  if (options.deduplicateResults !== false) {
    const seen = new Set<string>();
    uniqueResults = allResults.filter((result) => {
      if (seen.has(result.url)) {
        return false;
      }
      seen.add(result.url);
      return true;
    });
  }

  return {
    allResults,
    uniqueResults,
    responseCount: searchResults.length,
  };
};

/**
 * Search for token-specific fundamental information
 */
export const searchToken = async (
  tokenSymbol: string,
  options?: {
    searchDepth?: "basic" | "advanced";
    maxResults?: number;
    tokenAddress?: string;
  },
): Promise<TavilyAggregatedSearchResult> => {
  const queries = createFundamentalQueries(tokenSymbol, options?.tokenAddress);

  return searchAggregated({
    queries,
    searchDepth: options?.searchDepth || "advanced",
    maxResults: options?.maxResults || 15,
    deduplicateResults: true,
  });
};

/**
 * Check if Serper API is available
 */
export const isGooglerAvailable = async (): Promise<boolean> => {
  const apiKey = process.env.SERPER_API_KEY;
  return !!apiKey;
};

/**
 * No installation needed for Serper API
 */
export const installGoogler = async (): Promise<boolean> => {
  logger.info("Serper API search - no installation needed");
  return true;
};