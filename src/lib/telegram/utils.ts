import { err, ok, type Result } from "neverthrow";
import type { BroadcastResult, TelegramError } from "../../types";
import { getUserIds, getUserProfile } from "../../utils/db";
import { getLanguageDisplayName } from "../../utils/language";
import { logger } from "../../utils/logger";
import { getBotInstance } from "./bot";

export interface SendMessageOptions {
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  disable_notification?: boolean;
  buttons?: Array<{
    text: string;
    url: string;
  }>;
}

export interface SendMessageToUserOptions extends SendMessageOptions {
  userLanguage?: string;
}

/**
 * Send message to multiple users with language localization support
 */
export const sendMessage = async (
  userIds: string[],
  message: string,
  options: SendMessageOptions = {},
): Promise<Result<BroadcastResult, TelegramError>> => {
  if (userIds.length === 0) {
    return err({ type: "invalid_user", message: "No user IDs provided" });
  }

  try {
    const bot = getBotInstance();
    const messageResults: BroadcastResult["results"] = [];

    // Process users in parallel
    const userPromises = userIds.map(async (userId) => {
      try {
        // Get user profile to check language preference
        const userProfile = await getUserProfile(userId);
        const userLanguage = userProfile?.language || "en";

        // For now, send the original message (future: localize based on language)
        const localizedMessage = await localizeMessage(message, userLanguage);

        // Create inline keyboard if buttons are provided
        let inlineKeyboard;
        if (options.buttons && options.buttons.length > 0) {
          const { InlineKeyboard } = await import("grammy");
          inlineKeyboard = new InlineKeyboard();

          // Add buttons in rows of 1 (each button gets its own row for better mobile UX)
          for (const button of options.buttons) {
            inlineKeyboard.url(button.text, button.url).row();
          }
        }

        const response = await bot.api.sendMessage(userId, localizedMessage, {
          parse_mode: options.parse_mode || "Markdown",
          disable_notification: options.disable_notification,
          reply_markup: inlineKeyboard,
        });

        logger.debug("Message sent successfully", {
          userId,
          messageId: response.message_id,
          userLanguage,
        });

        return {
          userId,
          success: true,
          messageId: response.message_id,
          error: undefined,
        };
      } catch (error: any) {
        const errorType: TelegramError["type"] =
          error.error_code === 403
            ? "forbidden"
            : error.error_code === 429
              ? "rate_limit"
              : error.description?.includes("chat not found")
                ? "invalid_user"
                : "unknown";

        logger.error("Failed to send message to user", {
          userId,
          error: error.message || String(error),
          errorCode: error.error_code,
          errorType,
        });

        return {
          userId,
          success: false,
          messageId: undefined,
          error: error.message || String(error),
        };
      }
    });

    const sendResults = await Promise.all(userPromises);

    const successCount = sendResults.filter((r) => r.success).length;
    const failureCount = sendResults.filter((r) => !r.success).length;
    const failedUsers = sendResults.filter((r) => !r.success).map((r) => r.userId);

    const broadcastResult: BroadcastResult = {
      totalUsers: userIds.length,
      successCount,
      failureCount,
      failedUsers,
      results: sendResults,
    };

    return ok(broadcastResult);
  } catch (error) {
    logger.error("Message broadcasting failed", {
      error: error instanceof Error ? error.message : String(error),
      userCount: userIds.length,
    });

    return err({
      type: "bot_error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Broadcast message to all users with language localization
 */
export const broadcastMessage = async (
  message: string,
  options: SendMessageOptions & {
    excludeUserIds?: string[];
  } = {},
): Promise<Result<BroadcastResult, TelegramError>> => {
  try {
    logger.info("Starting broadcast to all users");

    const userIds = await getUserIds(options.excludeUserIds);

    if (userIds.length === 0) {
      logger.info("No users found for broadcast");
      return ok({
        totalUsers: 0,
        successCount: 0,
        failureCount: 0,
        failedUsers: [],
        results: [],
      });
    }

    logger.info(`Broadcasting message to ${userIds.length} users`);

    const { excludeUserIds, ...sendOptions } = options;
    return await sendMessage(userIds, message, sendOptions);
  } catch (error) {
    return err({
      type: "bot_error",
      message: error instanceof Error ? error.message : "Failed to fetch users",
    });
  }
};

/**
 * Send message to a single user with language localization
 */
export const sendMessageToUser = async (
  userId: string,
  message: string,
  options: SendMessageToUserOptions = {},
): Promise<Result<{ messageId: number }, TelegramError>> => {
  try {
    const bot = getBotInstance();

    // Get user language if not provided
    let userLanguage = options.userLanguage;
    if (!userLanguage) {
      const userProfile = await getUserProfile(userId);
      userLanguage = userProfile?.language || "en";
    }

    // Localize message based on user language
    const localizedMessage = await localizeMessage(message, userLanguage);

    // Create inline keyboard if buttons are provided
    let inlineKeyboard;
    if (options.buttons && options.buttons.length > 0) {
      const { InlineKeyboard } = await import("grammy");
      inlineKeyboard = new InlineKeyboard();

      for (const button of options.buttons) {
        inlineKeyboard.url(button.text, button.url).row();
      }
    }

    const response = await bot.api.sendMessage(userId, localizedMessage, {
      parse_mode: options.parse_mode || "Markdown",
      disable_notification: options.disable_notification,
      reply_markup: inlineKeyboard,
    });

    logger.info("Message sent to user", {
      userId,
      messageId: response.message_id,
      userLanguage,
    });

    return ok({ messageId: response.message_id });
  } catch (error: any) {
    const errorType: TelegramError["type"] =
      error.error_code === 403
        ? "forbidden"
        : error.error_code === 429
          ? "rate_limit"
          : error.description?.includes("chat not found")
            ? "invalid_user"
            : "unknown";

    logger.error("Failed to send message to user", {
      userId,
      error: error.message || String(error),
      errorCode: error.error_code,
      errorType,
    });

    return err({
      type: errorType,
      message: error.message || String(error),
      userId,
    });
  }
};

/**
 * Localize message content based on user language preference
 * For now, returns the original message. Future enhancement: use LLM for translation
 */
const localizeMessage = async (message: string, userLanguage: string): Promise<string> => {
  // For now, return the original message
  // TODO: Implement LLM-based translation for non-English languages
  if (userLanguage === "en") {
    return message;
  }

  // Add language indicator for non-English users
  const languageDisplay = getLanguageDisplayName(userLanguage);
  logger.debug("Message language preference noted", {
    userLanguage,
    languageDisplay,
    messagePreview: message.substring(0, 100),
  });

  // Future: translate message using LLM
  return message;
};
