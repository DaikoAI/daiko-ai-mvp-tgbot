#!/usr/bin/env bun

import { broadcastMessage } from "../src/lib/telegram/utils";
import { logger } from "../src/utils/logger";

async function main() {
  console.log("📢 Starting broadcast test execution");
  logger.info("📢 Starting broadcast test execution");

  const startTime = Date.now();

  try {
    // 包括的なMarkdownテストメッセージ
    const testMessage = `🧪 **Test Message - Markdown Features**

This is a comprehensive test of Telegram's Markdown capabilities.

📊 **Market Analysis Example**
• Current Price: $0.001234
• 24h Change: +15.67%
• Volume: $1,234,567

🎯 *Technical Indicators*:
\`RSI\`: 72.5 (Overbought)
\`MACD\`: Bullish divergence detected
\`Support\`: $0.001100
\`Resistance\`: $0.001500

📈 **Signal Summary**
Direction: **BUY** 🚀
Confidence: **85%**
Risk Level: *MEDIUM* ⚖️

\`\`\`
Entry: $0.001200-$0.001250
Target 1: $0.001400 (+16%)
Target 2: $0.001600 (+33%)
Stop Loss: $0.001050 (-12%)
\`\`\`

🔗 **Useful Links**:
• [DexScreener](https://dexscreener.com)
• [Jupiter Swap](https://jup.ag)
• [Official Website](https://daiko.ai)

⚠️ _Always DYOR (Do Your Own Research)_

📅 Sent at: ${new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })}

If you receive this message with proper formatting, all Markdown features are working correctly ✅`;

    // テスト用ボタン
    const testButtons = [
      { text: "🚀 Buy on Jupiter", url: "https://jup.ag" },
      { text: "📊 View Chart", url: "https://dexscreener.com" },
      { text: "🔍 Token Info", url: "https://solscan.io" },
      { text: "📰 Latest News", url: "https://daiko.ai" },
    ];

    console.log("📤 Sending comprehensive test message to all users...");
    logger.info("📤 Sending comprehensive test message with buttons");

    const result = await broadcastMessage(testMessage, {
      parse_mode: "Markdown",
      disable_notification: false,
      buttons: testButtons,
    });

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    if (result.isOk()) {
      const stats = result.value;
      const message = `✅ Broadcast test completed successfully in ${executionTime}ms (${(executionTime / 1000).toFixed(2)}s)
📊 Results:
  - Total users: ${stats.totalUsers}
  - Successful sends: ${stats.successCount}
  - Failed sends: ${stats.failureCount}
  - Success rate: ${stats.totalUsers > 0 ? ((stats.successCount / stats.totalUsers) * 100).toFixed(1) : "0"}%`;

      console.log(message);
      logger.info("Broadcast test completed", {
        executionTimeMs: executionTime,
        totalUsers: stats.totalUsers,
        successCount: stats.successCount,
        failureCount: stats.failureCount,
        failedUsers: stats.failedUsers,
      });

      if (stats.failureCount > 0) {
        console.log(`⚠️  Failed to send to ${stats.failureCount} users`);
        logger.warn("Some sends failed", {
          failedUserIds: stats.failedUsers,
        });
      }
    } else {
      const errorMessage = `❌ Broadcast test failed: ${result.error.message}`;
      console.error(errorMessage);
      logger.error("Broadcast test failed", {
        error: result.error,
        executionTimeMs: executionTime,
      });
      process.exit(1);
    }
  } catch (error) {
    const endTime = Date.now();
    const executionTime = endTime - startTime;

    const errorMessage = `💥 Broadcast test crashed after ${executionTime}ms: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMessage);
    logger.error("Broadcast test crashed", {
      error: error instanceof Error ? error.message : String(error),
      executionTimeMs: executionTime,
    });
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Script execution failed:", error);
  logger.error("❌ Script execution failed:", error);
  process.exit(1);
});
