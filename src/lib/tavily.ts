import { tavily as createTavilyClient, type TavilySearchOptions, type TavilySearchResponse } from "@tavily/core";
import type { TavilyAggregatedSearchResult } from "../types/tavily";
import { logger } from "../utils/logger";

// Tavily API configuration
const tavilyApiKey = process.env.TAVILY_API_KEY;

// Initialize Tavily client instance
let tavilyClient: ReturnType<typeof createTavilyClient> | null = null;

if (tavilyApiKey) {
  try {
    tavilyClient = createTavilyClient({ apiKey: tavilyApiKey });
    logger.info("Tavily client initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize Tavily client", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Failed to initialize Tavily client");
  }
} else {
  logger.warn("TAVILY_API_KEY not found, Tavily client will be disabled");
}

/**
 * Execute a search query using the Tavily API
 */
export const search = async (options: TavilySearchOptions): Promise<TavilySearchResponse> => {
  if (!tavilyClient) {
    throw new Error("Tavily client not available - API key not configured");
  }

  const { query, ...restOptions } = options;

  logger.debug("Executing Tavily search", {
    query,
    searchDepth: restOptions.searchDepth,
    maxResults: restOptions.maxResults,
    includeDomains: restOptions.includeDomains?.length || 0,
    excludeDomains: restOptions.excludeDomains?.length || 0,
  });

  try {
    const response = await tavilyClient.search(query, {
      search_depth: restOptions.searchDepth,
      include_images: restOptions.includeImages,
      include_answer: restOptions.includeAnswer,
      include_raw_content: restOptions.includeRawContent,
      max_results: restOptions.maxResults,
      include_domains: restOptions.includeDomains?.length ? restOptions.includeDomains : undefined,
      exclude_domains: restOptions.excludeDomains?.length ? restOptions.excludeDomains : undefined,
    });

    logger.debug("Tavily search completed", {
      query,
      resultsCount: response.results.length,
      responseTime: response.responseTime,
    });

    return response;
  } catch (error) {
    logger.error("Tavily search failed", {
      query,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new Error(`Tavily search failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
};

/**
 * Execute multiple search queries in parallel
 */
export const searchMultiple = async (searches: TavilySearchOptions[]): Promise<TavilySearchResponse[]> => {
  if (!tavilyClient) {
    throw new Error("Tavily client not available - API key not configured");
  }

  if (searches.length === 0) {
    return [];
  }

  logger.debug("Executing multiple Tavily searches", { count: searches.length });

  try {
    const searchPromises = searches.map((searchOptions) => search(searchOptions));
    const results = await Promise.allSettled(searchPromises);

    const successfulResults: TavilySearchResponse[] = [];
    const failedSearches: Array<{ query: string; error: unknown }> = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        successfulResults.push(result.value);
      } else {
        failedSearches.push({
          query: searches[index]?.query || `search-${index}`,
          error: result.reason,
        });
      }
    });

    if (failedSearches.length > 0) {
      logger.warn("Some Tavily searches failed", {
        successful: successfulResults.length,
        failed: failedSearches.length,
        failedQueries: failedSearches.map((f) => f.query),
      });
    }

    return successfulResults;
  } catch (error) {
    logger.error("Multiple Tavily searches failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Multiple Tavily searches failed");
  }
};

/**
 * Aggregated search interface for convenience
 */
export const searchAggregated = async (options: {
  queries: string[];
  searchDepth?: "basic" | "advanced";
  maxResults?: number;
  deduplicateResults?: boolean;
}): Promise<TavilyAggregatedSearchResult> => {
  const searches: TavilySearchOptions[] = options.queries.map((query) => ({
    query,
    searchDepth: options.searchDepth,
    maxResults: options.maxResults,
  }));

  const responses = await searchMultiple(searches);
  const allResults = responses.flatMap((response) => response.results);

  let uniqueResults = allResults;
  if (options.deduplicateResults !== false) {
    const seen = new Set<string>();
    uniqueResults = allResults.filter((result) => {
      const key = result.url;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  return {
    allResults,
    uniqueResults,
    responseCount: responses.length,
  };
};

/**
 * Search for token-related information
 */
export const searchToken = async (
  tokenSymbol: string,
  options?: {
    searchDepth?: "basic" | "advanced";
    maxResults?: number;
  },
): Promise<TavilyAggregatedSearchResult> => {
  const queries = [
    `${tokenSymbol} cryptocurrency price analysis`,
    `${tokenSymbol} token news today`,
    `${tokenSymbol} crypto market sentiment`,
  ];

  return searchAggregated({
    queries,
    searchDepth: options?.searchDepth || "basic",
    maxResults: options?.maxResults || 3,
    deduplicateResults: true,
  });
};
