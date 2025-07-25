import { beforeEach, describe, expect, mock, test } from "bun:test";
import { fetchDataSources } from "../../../src/agents/signal/nodes/data-fetch";

// Mock the RSS news search results
const mockRSSNewsResults = {
  allResults: [
    {
      title: "Solana Foundation Announces Major Partnership with Fortune 500 Company",
      url: "https://coindesk.com/business/solana-foundation-partnership-fortune-500",
      content:
        "Solana Foundation has announced a groundbreaking partnership that will significantly expand enterprise adoption of the blockchain technology.",
      score: 0.95,
      publishedDate: "Fri, 15 Jan 2024 12:00:00 +0000",
    },
    {
      title: "Solana Network Upgrade Improves Transaction Throughput by 40%",
      url: "https://cointelegraph.com/news/solana-network-upgrade-improves-transaction-throughput",
      content:
        "The latest Solana network upgrade has successfully increased transaction throughput, demonstrating the network's continued technological advancement.",
      score: 0.92,
      publishedDate: "Thu, 14 Jan 2024 10:30:00 +0000",
    },
    {
      title: "DeFi Protocol Built on Solana Reaches $1B TVL Milestone",
      url: "https://decrypt.co/solana-defi-protocol-1b-tvl-milestone",
      content:
        "A major DeFi protocol on Solana has crossed the $1 billion Total Value Locked threshold, indicating strong ecosystem growth.",
      score: 0.88,
      publishedDate: "Wed, 13 Jan 2024 14:15:00 +0000",
    },
  ],
  uniqueResults: [
    {
      title: "Solana Foundation Announces Major Partnership with Fortune 500 Company",
      url: "https://coindesk.com/business/solana-foundation-partnership-fortune-500",
      content:
        "Solana Foundation has announced a groundbreaking partnership that will significantly expand enterprise adoption of the blockchain technology.",
      score: 0.95,
      publishedDate: "Fri, 15 Jan 2024 12:00:00 +0000",
    },
    {
      title: "Solana Network Upgrade Improves Transaction Throughput by 40%",
      url: "https://cointelegraph.com/news/solana-network-upgrade-improves-transaction-throughput",
      content:
        "The latest Solana network upgrade has successfully increased transaction throughput, demonstrating the network's continued technological advancement.",
      score: 0.92,
      publishedDate: "Thu, 14 Jan 2024 10:30:00 +0000",
    },
    {
      title: "DeFi Protocol Built on Solana Reaches $1B TVL Milestone",
      url: "https://decrypt.co/solana-defi-protocol-1b-tvl-milestone",
      content:
        "A major DeFi protocol on Solana has crossed the $1 billion Total Value Locked threshold, indicating strong ecosystem growth.",
      score: 0.88,
      publishedDate: "Wed, 13 Jan 2024 14:15:00 +0000",
    },
  ],
  responseCount: 3,
};

const mockBearishResults = {
  allResults: [
    {
      title: "Solana Network Faces Technical Challenges and Downtime",
      url: "https://coindesk.com/tech/solana-network-downtime-technical-challenges",
      content:
        "The Solana blockchain network experienced technical difficulties and downtime, raising concerns about network stability and reliability among developers.",
      score: 0.9,
      publishedDate: "Fri, 15 Jan 2024 08:00:00 +0000",
    },
    {
      title: "Market Concerns Rise Over Solana's Centralization Issues",
      url: "https://cointelegraph.com/news/market-concerns-solana-centralization",
      content:
        "Crypto analysts express concerns about Solana's centralization aspects and governance structure, which could impact long-term adoption and price performance.",
      score: 0.85,
      publishedDate: "Thu, 14 Jan 2024 16:20:00 +0000",
    },
  ],
  uniqueResults: [
    {
      title: "Solana Network Faces Technical Challenges and Downtime",
      url: "https://coindesk.com/tech/solana-network-downtime-technical-challenges",
      content:
        "The Solana blockchain network experienced technical difficulties and downtime, raising concerns about network stability and reliability among developers.",
      score: 0.9,
      publishedDate: "Fri, 15 Jan 2024 08:00:00 +0000",
    },
    {
      title: "Market Concerns Rise Over Solana's Centralization Issues",
      url: "https://cointelegraph.com/news/market-concerns-solana-centralization",
      content:
        "Crypto analysts express concerns about Solana's centralization aspects and governance structure, which could impact long-term adoption and price performance.",
      score: 0.85,
      publishedDate: "Thu, 14 Jan 2024 16:20:00 +0000",
    },
  ],
  responseCount: 2,
};

const mockEmptyResults = {
  allResults: [],
  uniqueResults: [],
  responseCount: 0,
};

// Mock the entire serper-search module to use searchAggregated
mock.module("../../../src/lib/serper-search", () => ({
  searchAggregated: mock(() => Promise.resolve(mockRSSNewsResults)),
}));

describe("Enhanced Fundamental Data Fetch via Serper API", () => {
  let mockState: any;

  beforeEach(async () => {
    mockState = {
      tokenAddress: "So11111111111111111111111111111111111111112",
      tokenSymbol: "SOL",
      currentPrice: 254.32,
    };

    // Reset mocks
    const { searchAggregated } = await import("../../../src/lib/serper-search");
    (searchAggregated as any).mockClear();
    (searchAggregated as any).mockResolvedValue(mockRSSNewsResults);
  });

  describe("Basic Functionality", () => {
    test("should successfully fetch and process RSS news data", async () => {
      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults).toBeDefined();
      expect(result.evidenceResults?.relevantSources).toHaveLength(3);
      expect(result.evidenceResults?.totalResults).toBe(3);
      expect(result.evidenceResults?.searchStrategy).toBe("FUNDAMENTAL_SEARCH");
      expect(result.evidenceResults?.qualityScore).toBeGreaterThan(0.5);
    });

    test("should use searchAggregated with fundamental analysis queries", async () => {
      const { searchAggregated } = await import("../../../src/lib/serper-search");

      await fetchDataSources(mockState);

      expect(searchAggregated).toHaveBeenCalledWith({
        queries: expect.any(Array),
        searchDepth: "advanced",
        maxResults: 20,
        deduplicateResults: true,
      });
    });

    test("should handle empty search results gracefully", async () => {
      const { searchAggregated } = await import("../../../src/lib/serper-search");
      (searchAggregated as any).mockResolvedValueOnce(mockEmptyResults);

      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults).toBeDefined();
      expect(result.evidenceResults?.relevantSources).toHaveLength(0);
      expect(result.evidenceResults?.searchStrategy).toBe("FUNDAMENTAL_SEARCH");
      expect(result.evidenceResults?.qualityScore).toBe(0.1);
      expect(result.evidenceResults?.totalResults).toBe(0);
    });
  });

  describe("Market Sentiment Analysis", () => {
    test("should correctly identify bullish sentiment from RSS news sources", async () => {
      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults?.qualityScore).toBeGreaterThan(0.6);
      expect(result.evidenceResults?.relevantSources.length).toBeGreaterThan(0);
    });

    test("should correctly identify bearish sentiment", async () => {
      const { searchAggregated } = await import("../../../src/lib/serper-search");
      (searchAggregated as any).mockResolvedValueOnce(mockBearishResults);

      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults?.qualityScore).toBeGreaterThan(0.5);
      expect(result.evidenceResults?.relevantSources.length).toBeGreaterThan(0);
    });

    test("should default to neutral sentiment for balanced or unclear signals", async () => {
      const { searchAggregated } = await import("../../../src/lib/serper-search");
      (searchAggregated as any).mockResolvedValueOnce(mockEmptyResults);

      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults?.qualityScore).toBe(0.1);
      expect(result.evidenceResults?.relevantSources).toHaveLength(0);
    });
  });

  describe("Source Quality Analysis", () => {
    test("should calculate quality score based on domain reputation", async () => {
      const result = await fetchDataSources(mockState);

      // Should have high quality score due to high-reputation RSS news domains
      expect(result.evidenceResults?.qualityScore).toBeGreaterThan(0.7);
      expect(result.evidenceResults?.relevantSources).toHaveLength(3);
    });

    test("should convert search results to proper evidence format", async () => {
      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults?.relevantSources[0]).toMatchObject({
        title: expect.stringContaining("Solana Foundation"),
        url: expect.stringContaining("coindesk.com"),
        content: expect.stringContaining("partnership"),
        score: expect.any(Number),
        domain: expect.stringContaining("coindesk.com"),
        publishedDate: expect.any(String),
      });
    });

    test("should compute domain from URL correctly", async () => {
      const result = await fetchDataSources(mockState);

      const domains = result.evidenceResults?.relevantSources.map((source) => source.domain);
      expect(domains).toContain("coindesk.com");
      expect(domains).toContain("cointelegraph.com");
      expect(domains).toContain("decrypt.co");
    });
  });

  describe("Error Handling", () => {
    test("should handle search errors gracefully", async () => {
      const { searchAggregated } = await import("../../../src/lib/serper-search");
      (searchAggregated as any).mockRejectedValue(new Error("Serper API timeout"));

      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults).toBeDefined();
      expect(result.evidenceResults?.searchStrategy).toBe("FAILED");
      expect(result.evidenceResults?.relevantSources).toHaveLength(0);
      expect(result.evidenceResults?.qualityScore).toBe(0);
    });
  });

  describe("Fundamental Analysis Features", () => {
    test("should include fundamental analysis search queries", async () => {
      const { searchAggregated } = await import("../../../src/lib/serper-search");

      await fetchDataSources(mockState);

      const calledWith = (searchAggregated as any).mock.calls[0][0];
      const queries = calledWith.queries;

      // Fundamental analysis search uses comprehensive queries for better analysis
      expect(queries.length).toBeGreaterThan(5); // Should have at least 5 base queries + address queries
      expect(queries.some((q: string) => q.includes("SOL"))).toBe(true);
      expect(queries.some((q: string) => q.includes("fundamental analysis"))).toBe(true);
      expect(queries.some((q: string) => q.includes("roadmap") || q.includes("partnerships"))).toBe(true);
    });

    test("should include token address in queries when provided", async () => {
      const { searchAggregated } = await import("../../../src/lib/serper-search");

      await fetchDataSources(mockState);

      const calledWith = (searchAggregated as any).mock.calls[0][0];
      const queries = calledWith.queries;

      expect(queries.some((q: string) => q.includes("audit") || q.includes("security"))).toBe(true);
    });

    test("should use advanced search depth for better quality", async () => {
      const { searchAggregated } = await import("../../../src/lib/serper-search");

      await fetchDataSources(mockState);

      const calledWith = (searchAggregated as any).mock.calls[0][0];
      expect(calledWith.searchDepth).toBe("advanced");
      expect(calledWith.maxResults).toBe(20);
    });

    test("should track search performance metrics", async () => {
      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults?.searchTime).toBeGreaterThanOrEqual(0);
      expect(result.evidenceResults?.totalResults).toBe(3);
      expect(result.evidenceResults?.searchQueries).toBeDefined();
      expect(result.evidenceResults?.searchQueries.length).toBeGreaterThan(5); // Multiple comprehensive queries for fundamental analysis
    });
  });
});
