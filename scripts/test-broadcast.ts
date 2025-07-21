#!/usr/bin/env bun

import { logger } from "../src/utils/logger";

async function testBroadcast() {
  logger.info("📢 Starting broadcast test execution");

  // Mock broadcast function (replace with actual implementation)
  const mockBroadcast = async (message: string) => {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      totalUsers: 150,
      successCount: 142,
      failureCount: 8,
      failedUsers: ["user1", "user2"],
      results: [],
    };
  };

  try {
    const testMessage = `📊 **Test Broadcast Message**

🚀 This is a comprehensive test of our broadcasting system!

**Features Testing:**
• ✅ Markdown formatting
• 📱 Mobile optimization
• 🔗 Button integration
• 🌐 Multi-language support
• ⚡ Rate limiting compliance

**Technical Validation:**
• Message length: ${Math.random().toFixed(0)} characters
• Emoji rendering: 🎯🚀📊⚠️✅
• Special characters: $, %, #, @

🎯 **Call to Action**
This message tests our complete broadcast pipeline including error handling and user feedback.

📋 *Always verify broadcast results!*`;

    logger.info("📤 Sending comprehensive test message to all users...");

    const stats = await mockBroadcast(testMessage);

    if (stats.successCount > 0) {
      const message = `✅ Broadcast completed successfully!
📊 Statistics:
  • Total users: ${stats.totalUsers}
  • Successful sends: ${stats.successCount}
  • Failed sends: ${stats.failureCount}
  • Success rate: ${((stats.successCount / stats.totalUsers) * 100).toFixed(1)}%`;

      logger.info(message);
    }

    if (stats.failureCount > 0) {
      logger.warn(`⚠️ Failed to send to ${stats.failureCount} users`, {
        failedUsers: stats.failedUsers.slice(0, 5), // Show first 5 failed users
        totalFailed: stats.failureCount,
      });
    }
  } catch (error) {
    logger.error("❌ Broadcast test execution failed:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

testBroadcast();
