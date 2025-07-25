/**
 * Tavily search result from API response
 */
export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
}

/**
 * Aggregated search result for token searches
 */
export interface TavilyAggregatedSearchResult {
  allResults: TavilySearchResult[];
  uniqueResults: TavilySearchResult[];
  responseCount: number;
}

/**
 * Evidence results for signal graph state
 */
export interface EvidenceResults {
  relevantSources: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    domain: string;
    publishedDate?: string;
  }>;
  searchQueries: string[];
  totalResults: number;
  searchTime: number;
  marketSentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  primaryCause: string | null;
  searchStrategy: "BASIC" | "ADVANCED" | "SKIP" | "FAILED" | "RSS_NEWS" | "FUNDAMENTAL_SEARCH";
  qualityScore: number;
  newsCategory: "BULLISH" | "BEARISH" | "NEUTRAL";
}
