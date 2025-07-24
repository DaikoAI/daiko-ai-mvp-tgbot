import { beforeEach, describe, expect, mock, test } from "bun:test";
import { fetchDataSources } from "../../../src/agents/signal/nodes/data-fetch";

// Mock the Tavily wrapper layer
const mockSearchResults = {
  allResults: [
    {
      title: "SOL Price Surges 15% as Solana Network Sees Record Activity",
      url: "https://cointelegraph.com/news/sol-price-surges-15-solana-network-record-activity",
      content:
        "Solana (SOL) price has surged 15% in the last 24 hours as the network experiences record-breaking activity. The bullish momentum is driven by increased adoption and positive market sentiment.",
      score: 0.95,
      publishedDate: "2024-01-01",
    },
    {
      title: "Solana DeFi TVL Reaches All-Time High Despite Market Volatility",
      url: "https://coinmarketcap.com/news/solana-defi-tvl-reaches-all-time-high",
      content:
        "Despite recent market volatility, Solana's DeFi ecosystem continues to grow with TVL reaching new highs.",
      score: 0.88,
      publishedDate: "2024-01-01",
    },
  ],
  uniqueResults: [
    {
      title: "SOL Price Surges 15% as Solana Network Sees Record Activity",
      url: "https://cointelegraph.com/news/sol-price-surges-15-solana-network-record-activity",
      content:
        "Solana (SOL) price has surged 15% in the last 24 hours as the network experiences record-breaking activity. The bullish momentum is driven by increased adoption and positive market sentiment.",
      score: 0.95,
      publishedDate: "2024-01-01",
    },
    {
      title: "Solana DeFi TVL Reaches All-Time High Despite Market Volatility",
      url: "https://coinmarketcap.com/news/solana-defi-tvl-reaches-all-time-high",
      content:
        "Despite recent market volatility, Solana's DeFi ecosystem continues to grow with TVL reaching new highs.",
      score: 0.88,
      publishedDate: "2024-01-01",
    },
  ],
  responseCount: 2,
};

// Mock the entire tavily module
mock.module("../../../src/lib/tavily", () => ({
  searchToken: mock(() => Promise.resolve(mockSearchResults)),
}));

describe("Tavily SDK Data Fetch with @tavily/core", () => {
  let mockState: any;

  beforeEach(async () => {
    mockState = {
      tokenAddress: "So11111111111111111111111111111111111111112",
      tokenSymbol: "SOL",
      currentPrice: 254.32,
    };

    // Reset mocks
    const { searchToken } = await import("../../../src/lib/tavily");
    (searchToken as any).mockClear();
    (searchToken as any).mockResolvedValue(mockSearchResults);
  });

  describe("Basic Functionality", () => {
    test("should successfully fetch and process token data using wrapper", async () => {
      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults).toBeDefined();
      expect(result.evidenceResults?.relevantSources).toHaveLength(2);
      expect(result.evidenceResults?.totalResults).toBe(2);
      expect(result.evidenceResults?.searchStrategy).toBe("BASIC");
      expect(result.evidenceResults?.qualityScore).toBeGreaterThan(0);
    });

    test("should use wrapper searchToken function with correct parameters", async () => {
      const { searchToken } = await import("../../../src/lib/tavily");

      await fetchDataSources(mockState);

      expect(searchToken).toHaveBeenCalledWith("SOL", {
        searchDepth: "basic",
        maxResults: 3,
      });
    });

    test("should handle unavailable Tavily client gracefully", async () => {
      const { searchToken } = await import("../../../src/lib/tavily");
      (searchToken as any).mockRejectedValue(new Error("Tavily client not available - API key not configured"));

      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults).toBeDefined();
      expect(result.evidenceResults?.relevantSources).toHaveLength(0);
      expect(result.evidenceResults?.searchStrategy).toBe("SKIP");
      expect(result.evidenceResults?.primaryCause).toBe("Tavily API key not configured");
    });
  });

  describe("Market Sentiment Analysis", () => {
    test("should correctly identify bullish sentiment from wrapper results", async () => {
      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults?.marketSentiment).toBe("BULLISH");
      expect(result.evidenceResults?.newsCategory).toBe("BULLISH");
    });

    test("should correctly identify bearish sentiment", async () => {
      const bearishResults = {
        ...mockSearchResults,
        allResults: [
          {
            title: "SOL Price Crashes 30% as Market Dumps Hard",
            url: "https://example.com/bearish-news",
            content: "SOL price has crashed dump dump crash bearish bearish sell sell decline fall risk concern",
            score: 0.9,
            publishedDate: "2024-01-01",
          },
        ],
        uniqueResults: [
          {
            title: "SOL Price Crashes 30% as Market Dumps Hard",
            url: "https://example.com/bearish-news",
            content: "SOL price has crashed dump dump crash bearish bearish sell sell decline fall risk concern",
            score: 0.9,
            publishedDate: "2024-01-01",
          },
        ],
      };

      const { searchToken } = await import("../../../src/lib/tavily");
      (searchToken as any).mockResolvedValueOnce(bearishResults);

      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults?.marketSentiment).toBe("BEARISH");
      expect(result.evidenceResults?.newsCategory).toBe("BEARISH");
    });
  });

  describe("Search Results Processing", () => {
    test("should handle no search results", async () => {
      const emptyResults = {
        allResults: [],
        uniqueResults: [],
        responseCount: 0,
      };

      const { searchToken } = await import("../../../src/lib/tavily");
      (searchToken as any).mockResolvedValueOnce(emptyResults);

      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults?.searchStrategy).toBe("BASIC");
      expect(result.evidenceResults?.relevantSources).toHaveLength(0);
      expect(result.evidenceResults?.primaryCause).toBe("No relevant sources found");
    });

    test("should calculate quality score correctly", async () => {
      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults?.qualityScore).toBeDefined();
      expect(result.evidenceResults?.qualityScore).toBeGreaterThan(0);
      expect(result.evidenceResults?.qualityScore).toBeLessThanOrEqual(1);
    });
  });

  describe("Error Handling", () => {
    test("should handle wrapper search errors gracefully", async () => {
      const { searchToken } = await import("../../../src/lib/tavily");
      (searchToken as any).mockRejectedValue(new Error("Wrapper search failed"));

      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults).toBeDefined();
      expect(result.evidenceResults?.searchStrategy).toBe("FAILED");
      expect(result.evidenceResults?.primaryCause).toContain("Search failed");
    });

    test("should handle API key error specifically", async () => {
      const { searchToken } = await import("../../../src/lib/tavily");
      (searchToken as any).mockRejectedValue(new Error("Tavily client not available - API key not configured"));

      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults?.searchStrategy).toBe("SKIP");
      expect(result.evidenceResults?.primaryCause).toBe("Tavily API key not configured");
    });
  });

  describe("Source Data Format", () => {
    test("should convert Tavily results to expected format", async () => {
      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults?.relevantSources).toBeDefined();
      expect(result.evidenceResults?.relevantSources[0]).toMatchObject({
        title: expect.any(String),
        url: expect.any(String),
        content: expect.any(String),
        score: expect.any(Number),
        domain: expect.any(String),
        publishedDate: expect.any(String),
      });
    });

    test("should compute domain from URL", async () => {
      const resultsWithoutDomain = {
        ...mockSearchResults,
        uniqueResults: [
          {
            title: "Test Article",
            url: "https://example.com/test",
            content: "Test content",
            score: 0.9,
            publishedDate: "2024-01-01",
          },
        ],
      };

      const { searchToken } = await import("../../../src/lib/tavily");
      (searchToken as any).mockResolvedValueOnce(resultsWithoutDomain);

      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults?.relevantSources).toBeDefined();
      expect(result.evidenceResults?.relevantSources).toHaveLength(1);
      expect(result.evidenceResults?.relevantSources[0]?.domain).toBe("example.com");
    });
  });
});
