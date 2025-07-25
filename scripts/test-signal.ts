#!/usr/bin/env bun

import { generateSignal } from "../src/agents/signal/graph";
import { logger } from "../src/utils/logger";

// Sample technical analysis data for testing
const sampleTechnicalAnalysis = {
  id: "test-123",
  token: "So11111111111111111111111111111111111111112",
  timestamp: Math.floor(Date.now() / 1000),
  rsi: "75.5", // Overbought condition to trigger signal
  vwap: "245.50",
  vwap_deviation: "3.2", // Above threshold
  obv: "1500000000",
  obv_zscore: "2.1",
  percent_b: "0.92", // Near upper Bollinger band
  bb_width: "0.045",
  atr: "12.34",
  atr_percent: "5.8",
  adx: "42.1", // Strong trend
  adx_direction: "UP",
  signalGenerated: false,
  createdAt: new Date(),
};

/**
 * Test script for new data fetch layer in signal generation
 */
async function testSignalWithDataFetch() {
  logger.info("=== Testing Signal Generation with Data Fetch Layer ===");

  try {
    const result = await generateSignal({
      tokenAddress: "So11111111111111111111111111111111111111112",
      tokenSymbol: "SOL",
      currentPrice: 254.32,
      technicalAnalysis: sampleTechnicalAnalysis,
    });

    logger.info("Signal generation test completed", {
      hasSignal: !!result.finalSignal,
      signalLevel: result.finalSignal?.level,
      priority: result.finalSignal?.priority,
      hasEvidenceResults: !!result.evidenceResults,
      evidenceSourcesCount: result.evidenceResults?.relevantSources?.length || 0,
      evidenceQualityScore: result.evidenceResults?.qualityScore,
      evidenceSearchStrategy: result.evidenceResults?.searchStrategy,
    });

    // Print the final message to see information sources
    if (result.finalSignal?.message) {
      console.log("\n=== Generated Signal Message ===");
      console.log(result.finalSignal.message);
      console.log("================================\n");
    }

    // Print evidence sources if available
    if (result.evidenceResults?.relevantSources && result.evidenceResults.relevantSources.length > 0) {
      console.log("\n=== Evidence Sources Found ===");
      result.evidenceResults.relevantSources.forEach((source, index) => {
        if (typeof source === "object" && source !== null && "url" in source && "title" in source) {
          console.log(`${index + 1}. ${source.title}`);
          console.log(`   URL: ${source.url}`);
        }
      });
      console.log("===============================\n");
    }

    return result;
  } catch (error) {
    logger.error("Signal generation test failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Run the test
testSignalWithDataFetch()
  .then(() => {
    logger.info("Test completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Test failed", error);
    process.exit(1);
  });
