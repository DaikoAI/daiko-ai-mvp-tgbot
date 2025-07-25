import { beforeEach, describe, expect, mock, test } from "bun:test";
import { fetchDataSources } from "../../../src/agents/signal/nodes/data-fetch";

// Mock the enhanced fundamental search results
const mockFundamentalResults = {
  allResults: [
    {
      title: "Solana Foundation Announces Major Partnership with Fortune 500 Company",
      url: "https://coindesk.com/business/solana-foundation-partnership-fortune-500",
      content:
        "Solana Foundation has announced a groundbreaking partnership that will significantly expand enterprise adoption of the blockchain technology.",
      score: 0.95,
      publishedDate: "2024-01-15",
    },
    {
      title: "Solana Network Upgrade Improves Transaction Throughput by 40%",
      url: "https://cointelegraph.com/news/solana-network-upgrade-improves-transaction-throughput",
      content:
        "The latest Solana network upgrade has successfully increased transaction throughput, demonstrating the network's continued technological advancement.",
      score: 0.92,
      publishedDate: "2024-01-14",
    },
    {
      title: "DeFi Protocol Built on Solana Reaches $1B TVL Milestone",
      url: "https://decrypt.co/solana-defi-protocol-1b-tvl-milestone",
      content:
        "A major DeFi protocol on Solana has crossed the $1 billion Total Value Locked threshold, indicating strong ecosystem growth.",
      score: 0.88,
      publishedDate: "2024-01-13",
    },
  ],
  uniqueResults: [
    {
      title: "Solana Foundation Announces Major Partnership with Fortune 500 Company",
      url: "https://coindesk.com/business/solana-foundation-partnership-fortune-500",
      content:
        "Solana Foundation has announced a groundbreaking partnership that will significantly expand enterprise adoption of the blockchain technology.",
      score: 0.95,
      publishedDate: "2024-01-15",
    },
    {
      title: "Solana Network Upgrade Improves Transaction Throughput by 40%",
      url: "https://cointelegraph.com/news/solana-network-upgrade-improves-transaction-throughput",
      content:
        "The latest Solana network upgrade has successfully increased transaction throughput, demonstrating the network's continued technological advancement.",
      score: 0.92,
      publishedDate: "2024-01-14",
    },
    {
      title: "DeFi Protocol Built on Solana Reaches $1B TVL Milestone",
      url: "https://decrypt.co/solana-defi-protocol-1b-tvl-milestone",
      content:
        "A major DeFi protocol on Solana has crossed the $1 billion Total Value Locked threshold, indicating strong ecosystem growth.",
      score: 0.88,
      publishedDate: "2024-01-13",
    },
  ],
  responseCount: 3,
};

const mockBearishResults = {
  allResults: [
    {
      title: "Solana Network Experiences Major Security Breach and Hack",
      url: "https://coindesk.com/tech/solana-network-hack-security-breach",
      content:
        "The Solana blockchain network suffered a major security breach and hack exploit vulnerability, with millions lost to attackers. This security breach raises serious concerns about the network's safety.",
      score: 0.9,
      publishedDate: "2024-01-15",
    },
    {
      title: "Regulatory Crackdown and Investigation into Solana Foundation",
      url: "https://cointelegraph.com/news/regulatory-crackdown-solana-foundation",
      content:
        "Regulatory authorities have launched a major investigation lawsuit penalty into Solana Foundation following failed delayed postponed project launches and bear market conditions.",
      score: 0.85,
      publishedDate: "2024-01-14",
    },
  ],
  uniqueResults: [
    {
      title: "Solana Network Experiences Major Security Breach and Hack",
      url: "https://coindesk.com/tech/solana-network-hack-security-breach",
      content:
        "The Solana blockchain network suffered a major security breach and hack exploit vulnerability, with millions lost to attackers. This security breach raises serious concerns about the network's safety.",
      score: 0.9,
      publishedDate: "2024-01-15",
    },
    {
      title: "Regulatory Crackdown and Investigation into Solana Foundation",
      url: "https://cointelegraph.com/news/regulatory-crackdown-solana-foundation",
      content:
        "Regulatory authorities have launched a major investigation lawsuit penalty into Solana Foundation following failed delayed postponed project launches and bear market conditions.",
      score: 0.85,
      publishedDate: "2024-01-14",
    },
  ],
  responseCount: 2,
};

const mockEmptyResults = {
  allResults: [],
  uniqueResults: [],
  responseCount: 0,
};

// Mock the entire tavily module to use searchAggregated
mock.module("../../../src/lib/tavily", () => ({
  searchAggregated: mock(() => Promise.resolve(mockFundamentalResults)),
}));

describe("Enhanced Fundamental Data Fetch", () => {
  let mockState: any;

  beforeEach(async () => {
    mockState = {
      tokenAddress: "So11111111111111111111111111111111111111112",
      tokenSymbol: "SOL",
      currentPrice: 254.32,
    };

    // Reset mocks
    const { searchAggregated } = await import("../../../src/lib/tavily");
    (searchAggregated as any).mockClear();
    (searchAggregated as any).mockResolvedValue(mockFundamentalResults);
  });

  describe("Basic Functionality", () => {
    test("should successfully fetch and process fundamental data", async () => {
      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults).toBeDefined();
      expect(result.evidenceResults?.relevantSources).toHaveLength(3);
      expect(result.evidenceResults?.totalResults).toBe(3);
      expect(result.evidenceResults?.searchStrategy).toBe("FUNDAMENTAL");
      expect(result.evidenceResults?.qualityScore).toBeGreaterThan(0.5);
    });

    test("should use searchAggregated with fundamental queries", async () => {
      const { searchAggregated } = await import("../../../src/lib/tavily");

      await fetchDataSources(mockState);

      expect(searchAggregated).toHaveBeenCalledWith({
        queries: expect.any(Array),
        searchDepth: "advanced",
        maxResults: 15, // Updated from 20 to 15 for single comprehensive query
        deduplicateResults: true,
      });
    });

    test("should handle empty search results gracefully", async () => {
      const { searchAggregated } = await import("../../../src/lib/tavily");
      (searchAggregated as any).mockResolvedValueOnce(mockEmptyResults);

      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults).toBeDefined();
      expect(result.evidenceResults?.relevantSources).toHaveLength(0);
      expect(result.evidenceResults?.searchStrategy).toBe("FUNDAMENTAL");
      expect(result.evidenceResults?.qualityScore).toBe(0.1);
      expect(result.evidenceResults?.totalResults).toBe(0);
    });
  });

  describe("Market Sentiment Analysis", () => {
    test("should correctly identify bullish sentiment from fundamental sources", async () => {
      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults?.qualityScore).toBeGreaterThan(0.6);
      expect(result.evidenceResults?.relevantSources.length).toBeGreaterThan(0);
    });

    test("should correctly identify bearish sentiment", async () => {
      const { searchAggregated } = await import("../../../src/lib/tavily");
      (searchAggregated as any).mockResolvedValueOnce(mockBearishResults);

      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults?.qualityScore).toBeGreaterThan(0.5);
      expect(result.evidenceResults?.relevantSources.length).toBeGreaterThan(0);
    });

    test("should default to neutral sentiment for balanced or unclear signals", async () => {
      const { searchAggregated } = await import("../../../src/lib/tavily");
      (searchAggregated as any).mockResolvedValueOnce(mockEmptyResults);

      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults?.qualityScore).toBe(0.1);
      expect(result.evidenceResults?.relevantSources).toHaveLength(0);
    });
  });

  describe("Source Quality Analysis", () => {
    test("should calculate quality score based on domain reputation", async () => {
      const result = await fetchDataSources(mockState);

      // Should have high quality score due to high-reputation domains
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
      const { searchAggregated } = await import("../../../src/lib/tavily");
      (searchAggregated as any).mockRejectedValue(new Error("API timeout"));

      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults).toBeDefined();
      expect(result.evidenceResults?.searchStrategy).toBe("FAILED");
      expect(result.evidenceResults?.relevantSources).toHaveLength(0);
      expect(result.evidenceResults?.qualityScore).toBe(0);
    });

    test("should handle API key errors specifically", async () => {
      const { searchAggregated } = await import("../../../src/lib/tavily");
      (searchAggregated as any).mockRejectedValue(new Error("API key not configured"));

      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults).toBeDefined();
      expect(result.evidenceResults?.searchStrategy).toBe("SKIP");
      expect(result.evidenceResults?.relevantSources).toHaveLength(0);
      expect(result.evidenceResults?.qualityScore).toBe(0);
    });
  });

  describe("Fundamental Analysis Features", () => {
    test("should include fundamental search queries", async () => {
      const { searchAggregated } = await import("../../../src/lib/tavily");

      await fetchDataSources(mockState);

      const calledWith = (searchAggregated as any).mock.calls[0][0];
      const queries = calledWith.queries;

      // Now expects single comprehensive query containing all keywords
      expect(queries).toHaveLength(1);
      expect(queries[0]).toContain("SOL");
      expect(queries[0]).toContain("fundamentals");
      expect(queries[0]).toContain("tokenomics");
    });

    test("should include contract-specific queries when token address provided", async () => {
      const { searchAggregated } = await import("../../../src/lib/tavily");

      await fetchDataSources(mockState);

      const calledWith = (searchAggregated as any).mock.calls[0][0];
      const queries = calledWith.queries;

      expect(queries.some((q: string) => q.includes("So11111111111111111111111111111111111111112"))).toBe(true);
      expect(queries.some((q: string) => q.includes("contract analysis security audit"))).toBe(true);
      expect(queries.some((q: string) => q.includes("on-chain metrics holder distribution"))).toBe(true);
    });

    test("should use advanced search depth for better quality", async () => {
      const { searchAggregated } = await import("../../../src/lib/tavily");

      await fetchDataSources(mockState);

      const calledWith = (searchAggregated as any).mock.calls[0][0];
      expect(calledWith.searchDepth).toBe("advanced");
      expect(calledWith.maxResults).toBe(15); // Updated from 20 to 15
    });

    test("should track search performance metrics", async () => {
      const result = await fetchDataSources(mockState);

      expect(result.evidenceResults?.searchTime).toBeGreaterThanOrEqual(0);
      expect(result.evidenceResults?.totalResults).toBe(3);
      expect(result.evidenceResults?.searchQueries).toBeDefined();
      expect(result.evidenceResults?.searchQueries.length).toBe(1); // Single comprehensive query
    });
  });
});
