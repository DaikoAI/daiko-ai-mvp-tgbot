#!/usr/bin/env bun

import { createSignal } from "../src/utils/db";

async function testSignal() {
  // Test with new signal format
  const testSignalData = {
    id: "test_signal_123",
    token: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    signalType: "TECHNICAL_ALERT",
    value: {
      level: 2,
      priority: "MEDIUM",
      tags: ["test", "technical", "buy"],
      technicalAnalysisId: "test_ta_123",
      buttons: [
        {
          text: "👻 Open Test Token in Phantom",
          url: "https://phantom.app/ul/browse/https%3A%2F%2Fdexscreener.com%2Fsolana%2FEKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
        },
      ],
    },
    title: "🚀 [BUY] Test Token",
    body: `🚀 **[BUY] Test Token** - Medium Risk
Price: \`$1.234\`\tConfidence: **75 %**
Timeframe: Mid-term (4-12 h re-check recommended)

🗒️ *Market Snapshot*
Strong momentum building like a spring ready to bounce back. Technical indicators suggest accumulation phase ending.

🔍 *Why?*
• RSI 35 - oversold conditions favor buyers
• Bollinger -1σ touch - price near support band
• ADX 28 - moderate trend strength building

🎯 **Suggested Action**
Consider gradual *buy* entry, re-evaluate price after 4-12 h re-check recommended

⚠️ DYOR - Always do your own research.`,
    direction: "BUY",
    confidence: "0.75",
    explanation:
      "Technical analysis indicates oversold conditions with potential for reversal. Multiple indicators suggest buying opportunity with medium risk profile.",
    timestamp: new Date(),
  };

  try {
    console.log("Testing signal creation with new format:", {
      ...testSignalData,
      body: `${testSignalData.body.substring(0, 100)}...`, // Truncate for readability
    });

    const result = await createSignal(testSignalData);
    console.log("Signal created successfully:", {
      id: result.id,
      token: result.token,
      signalType: result.signalType,
      title: result.title,
      direction: result.direction,
      confidence: result.confidence,
      timestamp: result.timestamp,
    });

    console.log("Signal value structure:", result.value);
  } catch (error) {
    console.error("Error creating signal:", error);

    // Display more detailed error information
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
  }
}

testSignal().catch(console.error);
