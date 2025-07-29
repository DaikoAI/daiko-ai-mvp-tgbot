import { escapeMarkdown } from "../../utils";

/**
 * Telegram message templates
 */

/**
 * Welcome message shown when user starts the bot
 */
export const welcomeMessage = `
🌟 *Welcome to Daiko AI!* 🌟

Daiko AI is an advanced AI assistant that supports your daily life.

📈 *Main Features*:
• 🔗 Track your Solana portfolio by simply entering your wallet address
• 📈 Get real-time signals and alerts for your assets
• 📰 Receive concise summaries and insights about your portfolio
• 🚀 Stay updated with important market movements relevant to your holdings

🔗 *Social Links*:
• [Official Website](https://daiko.ai)
• [Twitter](https://x.com/DaikoAI)

ℹ️ *About Privacy*:
Daiko AI collects your conversation content and basic usage data to provide better service. This information is used only for AI improvement and personalized support.

📝 *Available Commands*:
• /start - Display this message
• /setup - Profile settings
• /help - Display help
• /feedback - Send feedback

Click the button below to agree to the Terms of Service and start your journey with Daiko AI!
`;

/**
 * Format signal information for Telegram message
 * @param signal - Signal data with new format structure
 * @param tokenSymbol - Token symbol
 * @param currentPrice - Current token price
 */
export const formatSignalMessage = (
  signal: {
    title: string;
    body: string;
    direction: string | null;
    confidence: string | null;
    explanation: string | null;
    timestamp: Date;
    value?: {
      level?: number;
      priority?: string;
      tags?: string[];
      buttons?: Array<{ text: string; url?: string; callback_data?: string }>;
    };
  },
  _tokenSymbol: string,
  currentPrice?: number,
): string => {
  // If the signal already contains the new formatted message in body, use it directly
  if (signal.body?.includes("Market Snapshot")) {
    // Add timestamp and powered by footer to the new format
    const timestamp = new Date(signal.timestamp).toLocaleString("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    return `${signal.body}

🕐 *Time*: ${escapeMarkdown(timestamp)} UTC

💡 *Powered by Daiko AI*`;
  }

  // Legacy format handling for backward compatibility
  const directionEmoji = {
    BUY: "🟢",
    SELL: "🔴",
    NEUTRAL: "🟡",
  };

  const confidencePercentage = signal.confidence ? Math.round(parseFloat(signal.confidence) * 100) : null;

  const priceInfo = currentPrice ? `📊 *Current Price*: $${currentPrice.toFixed(6)}\n` : "";

  const directionInfo = signal.direction
    ? `${directionEmoji[signal.direction as keyof typeof directionEmoji] || "⚪"} *Direction*: ${signal.direction}\n`
    : "";

  const confidenceInfo = confidencePercentage ? `🎯 *Confidence*: ${confidencePercentage}%\n` : "";

  const explanationInfo = signal.explanation ? `\n💡 *Analysis*:\n${escapeMarkdown(signal.explanation)}\n` : "";

  const timestamp = new Date(signal.timestamp).toLocaleString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return `${escapeMarkdown(signal.title)}

${escapeMarkdown(signal.body)}

${priceInfo}${directionInfo}${confidenceInfo}${explanationInfo}
🕐 *Time*: ${escapeMarkdown(timestamp)} UTC

💡 *Powered by Daiko AI*`;
};
