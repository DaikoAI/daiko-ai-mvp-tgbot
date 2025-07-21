import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { Context } from "grammy";
import { initTelegramGraph } from "../../agents/telegram/graph";
import type { NewToken } from "../../db";
import { getAssetsByOwner } from "../../lib/helius";
import { SetupStep } from "../../types";
import { createTimeoutPromise, dumpTokenUsage, isGeneralistMessage } from "../../utils";
import {
  createTokens,
  getChatHistory,
  getUserProfile,
  saveChatMessage,
  updateUserProfile,
  updateUserTokenHoldings,
} from "../../utils/db";
import { logger } from "../../utils/logger";
import { isValidSolanaAddress } from "../../utils/solana";
import { proceedToNextStep } from "../telegram/command";

/**
 * Handle setup process input
 */
const handleSetupInput = async (
  ctx: Context,
  userId: string,
  waitingFor: string,
  text: string,
  username?: string,
  firstName?: string,
  lastName?: string,
) => {
  switch (waitingFor) {
    case SetupStep.WALLET_ADDRESS: {
      if (!isValidSolanaAddress(text)) {
        await ctx.reply("Please enter a valid wallet address.");
        return;
      }

      await updateUserProfile(userId, {
        walletAddress: text,
        username,
        firstName,
        lastName,
        waitingForInput: null,
      });

      await ctx.reply(`Wallet address set to ${text}!`);

      try {
        const assets = await getAssetsByOwner(text);
        const userTokens: NewToken[] = assets.map((asset) => ({
          symbol: asset.content?.metadata?.symbol || asset.token_info?.symbol || "",
          name: asset.content?.metadata?.name || "",
          decimals: asset.token_info?.decimals || 9,
          address: asset.id,
          iconUrl: asset.content?.files?.[0]?.uri || "",
        }));

        // Insert tokens into database, ignoring duplicates
        await createTokens(userTokens);
        await updateUserTokenHoldings(userId, text, userTokens);
      } catch (error) {
        logger.error("Failed to fetch and process user tokens", {
          userId,
          walletAddress: text,
          error: error instanceof Error ? error.message : String(error),
        });
        await ctx.reply(
          "⚠️ Wallet address was set successfully, but there was an issue fetching your token holdings. This may be temporary - please try the setup again later.",
        );
      }

      // Proceed to the next step
      await proceedToNextStep(ctx, userId, SetupStep.WALLET_ADDRESS);
      break;
    }

    // Additional setup steps would go here...
    default:
      logger.warn("Unknown setup step", { waitingFor });
  }
};

/**
 * Process agent response stream
 */
const processAgentStream = async (tgAgent: any, config: any, userChatHistory: any, profile: any) => {
  const stream = await tgAgent.stream(
    {
      messages: userChatHistory,
      userProfile: profile,
    },
    config,
  );

  let latestAgentMessage: string | null = null;

  for await (const chunk of (await Promise.race([stream, createTimeoutPromise()])) as AsyncIterable<any>) {
    if (isGeneralistMessage(chunk)) {
      const lastIndex = chunk.generalist.messages.length - 1;
      if (chunk.generalist.messages[lastIndex]?.content) {
        latestAgentMessage = String(chunk.generalist.messages[lastIndex].content);
        logger.debug("message handler", "Got generalist message", latestAgentMessage);
      }
    }
    dumpTokenUsage(chunk);
  }

  return latestAgentMessage;
};

/**
 * Handle thinking message cleanup
 */
const cleanupThinkingMessage = async (ctx: Context, messageId: number) => {
  if (!ctx.chat?.id) return;

  try {
    await ctx.api.deleteMessage(ctx.chat.id, messageId);
  } catch (deleteError) {
    logger.warn("message handler", "Failed to delete thinking message:", deleteError);
  }
};

export const setupHandler = async (ctx: Context) => {
  const userId = ctx.from?.id.toString();
  const username = ctx.from?.username;
  const firstName = ctx.from?.first_name;
  const lastName = ctx.from?.last_name;

  if (!userId || !ctx.message?.text) {
    logger.warn("message handler", "User ID or message text is null");
    return;
  }

  try {
    const profile = await getUserProfile(userId);

    // Check if user is in setup process
    if (profile?.waitingForInput) {
      await handleSetupInput(ctx, userId, profile.waitingForInput, ctx.message.text, username, firstName, lastName);
      return;
    }

    // Normal conversation handling
    const thinkingMessage = await ctx.reply("🧠 Thinking...");

    // Add current user message to history and save to database
    const currentUserMessage = new HumanMessage(ctx.message.text);
    await saveChatMessage(userId, currentUserMessage);

    // Initialize graph
    const { graph: tgAgent, config } = await initTelegramGraph(userId);
    logger.debug("message handler", "Initialized Graph");

    // Load chat history from database
    const userChatHistory = await getChatHistory(userId);

    try {
      const latestAgentMessage = await processAgentStream(tgAgent, config, userChatHistory, profile);

      // Cleanup thinking message
      await cleanupThinkingMessage(ctx, thinkingMessage.message_id);

      if (latestAgentMessage) {
        await ctx.reply(latestAgentMessage, {
          parse_mode: "Markdown",
        });

        // Save AI message to database
        const aiMessage = new AIMessage(latestAgentMessage);
        await saveChatMessage(userId, aiMessage);
      } else {
        await ctx.reply("I'm sorry, I couldn't process your request at the moment. Please try again.");

        // Save error response to database
        const errorMessage = new AIMessage(
          "I'm sorry, I couldn't process your request at the moment. Please try again.",
        );
        await saveChatMessage(userId, errorMessage);
      }
    } catch (error: unknown) {
      await cleanupThinkingMessage(ctx, thinkingMessage.message_id);

      if (error instanceof Error && error.message === "Timeout") {
        await ctx.reply("I'm sorry, the operation took too long and timed out. Please try again.");

        // Save timeout error message to database
        const timeoutMessage = new AIMessage("I'm sorry, the operation took too long and timed out. Please try again.");
        await saveChatMessage(userId, timeoutMessage);
      } else {
        logger.error("message handler", "Error processing stream:", error);
        await ctx.reply("I'm sorry, an error occurred while processing your request.");

        // Save error message to database
        const errorMessage = new AIMessage("I'm sorry, an error occurred while processing your request.");
        await saveChatMessage(userId, errorMessage);
      }
    }
  } catch (error) {
    logger.error("message handler", "Error initializing agent:", error);
    await ctx.reply("I'm sorry, an error occurred while initializing the agent.");
  }
};
