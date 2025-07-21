import type { Bot, Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { NewUser } from "../../db";
import { CATEGORY_NAMES, LanguageCategory, POPULAR_LANGUAGES, REGIONAL_LANGUAGES, SetupStep } from "../../types";
import { clearChatHistory, getUserProfile, updateUserProfile, upsertUserProfile } from "../../utils/db";
import { getLanguageDisplayName } from "../../utils/language";
import { logger } from "../../utils/logger";
import { welcomeMessage } from "./msg-template";

export const setupCommands = (bot: Bot) => {
  bot.command("start", async (ctx) => {
    const keyboard = new InlineKeyboard().text("✅ Agree and start", "start_agree");

    await ctx.reply(welcomeMessage, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  });

  // Callback query handler for agreement button
  bot.callbackQuery("start_agree", async (ctx) => {
    await ctx.answerCallbackQuery({
      text: "Thank you! Starting Daiko AI...",
    });

    if (!ctx.from) {
      await ctx.reply("Could not retrieve user information. Please try again.", {
        parse_mode: "Markdown",
      });
      return;
    }

    // Get existing profile or create a new one
    const userId = ctx.from.id.toString();
    let userProfile = await getUserProfile(userId);

    if (!userProfile) {
      // Create new user profile
      const newProfile: NewUser = {
        userId,
        walletAddress: "",
      };

      await upsertUserProfile(newProfile);
      userProfile = await getUserProfile(userId);
    }

    // Send confirmation message
    await ctx.reply("Thank you for agreeing to use Daiko AI! Let's set up your profile.", {
      parse_mode: "Markdown",
    });

    // Proceed to the first setup step
    await proceedToNextStep(ctx, userId, null);
  });

  // Register setup command handler
  bot.command("setup", async (ctx) => {
    if (!ctx.from) {
      await ctx.reply("Could not retrieve user information. Please try again.", {
        parse_mode: "Markdown",
      });
      return;
    }

    const userId = ctx.from.id.toString();

    // Get existing profile or create a new one
    let userProfile = await getUserProfile(userId);

    if (!userProfile) {
      // Create new user profile
      const newProfile: NewUser = {
        userId,
        walletAddress: "",
      };

      await upsertUserProfile(newProfile);
      userProfile = await getUserProfile(userId);
    }

    await ctx.reply("Starting profile setup.", {
      parse_mode: "Markdown",
    });

    // Proceed to the first setup step
    await proceedToNextStep(ctx, userId, null);
  });

  // Enhanced language selection command with categories
  bot.command("lang", async (ctx) => {
    if (!ctx.from) {
      await ctx.reply("Could not retrieve user information. Please try again.", {
        parse_mode: "Markdown",
      });
      return;
    }

    const userId = ctx.from.id.toString();
    let userProfile = await getUserProfile(userId);

    // Create profile if it doesn't exist
    if (!userProfile) {
      const newProfile: NewUser = {
        userId,
        walletAddress: "",
      };
      await upsertUserProfile(newProfile);
      userProfile = await getUserProfile(userId);
    }

    // Show language category selection
    await showLanguageCategorySelection(ctx, userProfile?.language || "en");
  });

  // Category selection handlers
  Object.values(LanguageCategory).forEach((category) => {
    bot.callbackQuery(`lang_cat_${category}`, async (ctx) => {
      if (!ctx.from) return;

      await ctx.answerCallbackQuery();

      if (category === LanguageCategory.CUSTOM) {
        await handleCustomLanguageInput(ctx);
      } else {
        await showLanguageSelection(ctx, category);
      }
    });
  });

  // Language selection handlers for each category
  Object.entries(REGIONAL_LANGUAGES).forEach(([regionKey, region]) => {
    Object.keys(region.languages).forEach((langCode) => {
      bot.callbackQuery(`lang_${regionKey}_${langCode}`, async (ctx) => {
        if (!ctx.from) return;

        const userId = ctx.from.id.toString();

        // Validate language code before setting
        if (!isValidLanguageCode(langCode)) {
          logger.warn("Invalid language code attempted", { langCode, regionKey, userId });
          await ctx.answerCallbackQuery({
            text: "Invalid language selection. Please try again.",
          });
          return;
        }

        await setUserLanguage(ctx, userId, langCode, region.languages[langCode as keyof typeof region.languages]);
      });
    });
  });

  // Popular language selection handlers
  Object.keys(POPULAR_LANGUAGES).forEach((langCode) => {
    bot.callbackQuery(`lang_popular_${langCode}`, async (ctx) => {
      if (!ctx.from) return;

      const userId = ctx.from.id.toString();

      // Validate language code before setting
      if (!isValidLanguageCode(langCode)) {
        logger.warn("Invalid popular language code attempted", { langCode, userId });
        await ctx.answerCallbackQuery({
          text: "Invalid language selection. Please try again.",
        });
        return;
      }

      await setUserLanguage(ctx, userId, langCode, POPULAR_LANGUAGES[langCode as keyof typeof POPULAR_LANGUAGES]);
    });
  });

  // Back to categories handler
  bot.callbackQuery("lang_back_to_categories", async (ctx) => {
    if (!ctx.from) return;

    await ctx.answerCallbackQuery();

    const userId = ctx.from.id.toString();
    const userProfile = await getUserProfile(userId);
    await showLanguageCategorySelection(ctx, userProfile?.language || "en", true);
  });

  // Auto-detect language handler
  bot.callbackQuery("lang_auto_detect", async (ctx) => {
    if (!ctx.from) return;

    await ctx.answerCallbackQuery({
      text: "Auto-detection enabled! Send me a message in your preferred language.",
    });

    const userId = ctx.from.id.toString();
    await updateUserProfile(userId, { waitingForInput: "language_auto_detect" });

    await ctx.editMessageText(
      '🤖 **Auto Language Detection**\n\nPlease send me a message in your preferred language, and I\'ll automatically detect and set it for you!\n\nFor example:\n• "Hello, how are you?"\n• "Hola, ¿cómo estás?"\n• "こんにちは、元気ですか？"',
      {
        parse_mode: "Markdown",
        reply_markup: new InlineKeyboard().text("🔙 Back to Categories", "lang_back_to_categories"),
      },
    );
  });

  // Risk tolerance selection handler (1-10)
  for (let i = 1; i <= 10; i++) {
    bot.callbackQuery(`risk_${i}`, async (ctx) => {
      if (!ctx.from) return;

      const userId = ctx.from.id.toString();
      const profile = await getUserProfile(userId);

      if (!profile || profile.currentSetupStep !== SetupStep.RISK_TOLERANCE) return;

      await ctx.answerCallbackQuery({
        text: `Risk tolerance set to ${i}!`,
      });

      await updateUserProfile(userId, { cryptoRiskTolerance: i });

      // Proceed to the next step
      await proceedToNextStep(ctx, userId, SetupStep.RISK_TOLERANCE);
    });
  }

  bot.command("help", async (ctx) => {
    const helpMessage = `🤖 **Daiko AI Commands**

/start - Start using Daiko AI
/setup - Set up your profile
/language - Change your language preference (supports 100+ languages!)
/clear - Clear chat history
/feedback - Send feedback
/help - Show this help message

If you need help, please contact @DaikoAI.`;

    await ctx.reply(helpMessage, {
      parse_mode: "Markdown",
    });
  });

  bot.command("feedback", async (ctx) => {
    await ctx.reply(
      "If you have feedback or issues, please open an issue here: https://github.com/Daiko-AI/daiko-ai-mvp-tgbot/issues",
      {
        parse_mode: "Markdown",
      },
    );
  });

  bot.command("clear", async (ctx) => {
    const userId = ctx.from?.id.toString();

    if (!userId) {
      await ctx.reply("Could not retrieve user information. Please try again.", {
        parse_mode: "Markdown",
      });
      return;
    }

    try {
      await clearChatHistory(userId);
      await ctx.reply("🗑️ Chat history has been cleared!", {
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.error("clear command", "Error clearing chat history:", error);
      await ctx.reply("❌ Error clearing chat history. Please try again.", {
        parse_mode: "Markdown",
      });
    }
  });
};

// Helper function to show language category selection
const showLanguageCategorySelection = async (ctx: Context, currentLang: string, isEdit = false) => {
  const keyboard = new InlineKeyboard();

  // Add category buttons in a 2-column layout
  const categories = Object.values(LanguageCategory);
  for (let i = 0; i < categories.length; i += 2) {
    const row = categories.slice(i, i + 2);
    row.forEach((category) => {
      keyboard.text(CATEGORY_NAMES[category], `lang_cat_${category}`);
    });
    if (i + 2 < categories.length) {
      keyboard.row();
    }
  }

  // Add special options
  keyboard.row().text("🤖 Auto-Detect Language", "lang_auto_detect");

  const currentLangDisplay = getLanguageDisplayName(currentLang);
  const message = `🌐 **Language Settings**\n\nCurrent: ${currentLangDisplay}\n\nChoose a category or let me auto-detect your language:`;

  if (isEdit) {
    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  } else {
    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }
};

// Helper function to show languages in a specific category
const showLanguageSelection = async (ctx: Context, category: LanguageCategory) => {
  const keyboard = new InlineKeyboard();

  if (category === LanguageCategory.POPULAR) {
    // Show popular languages
    const languages = Object.entries(POPULAR_LANGUAGES);
    for (let i = 0; i < languages.length; i += 2) {
      const row = languages.slice(i, i + 2);
      row.forEach(([langCode, langName]) => {
        keyboard.text(langName, `lang_popular_${langCode}`);
      });
      if (i + 2 < languages.length) {
        keyboard.row();
      }
    }
  } else {
    // Show regional languages
    const regionKey = category as keyof typeof REGIONAL_LANGUAGES;
    const region = REGIONAL_LANGUAGES[regionKey];
    if (region) {
      const languages = Object.entries(region.languages);
      for (let i = 0; i < languages.length; i += 2) {
        const row = languages.slice(i, i + 2);
        row.forEach(([langCode, langName]) => {
          keyboard.text(langName, `lang_${regionKey}_${langCode}`);
        });
        if (i + 2 < languages.length) {
          keyboard.row();
        }
      }
    }
  }

  // Add back button
  keyboard.row().text("🔙 Back to Categories", "lang_back_to_categories");

  const categoryName = CATEGORY_NAMES[category];
  await ctx.editMessageText(`${categoryName}\n\nSelect your language:`, {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
};

// Helper function to handle custom language input
const handleCustomLanguageInput = async (ctx: Context) => {
  const userId = ctx.from?.id.toString();
  if (!userId) return;

  await updateUserProfile(userId, { waitingForInput: "custom_language" });

  await ctx.editMessageText(
    '✏️ **Custom Language**\n\nPlease type the name of your language or language code.\n\nExamples:\n• "Vietnamese" or "vi"\n• "Swahili" or "sw"\n• "Esperanto" or "eo"\n• "Klingon" or "tlh"',
    {
      parse_mode: "Markdown",
      reply_markup: new InlineKeyboard().text("🔙 Back to Categories", "lang_back_to_categories"),
    },
  );
};

// Helper function to set user language
const setUserLanguage = async (ctx: Context, userId: string, langCode: string, langName: string) => {
  try {
    await updateUserProfile(userId, { language: langCode });

    await ctx.answerCallbackQuery({
      text: `Language set to ${langName}!`,
    });

    await ctx.editMessageText(
      `✅ **Language Updated**\n\nYour language has been set to ${langName}.\n\nI'll respond in this language from now on!`,
      {
        parse_mode: "Markdown",
      },
    );
  } catch (error) {
    logger.error("setUserLanguage", "Error updating language:", error);

    await ctx.answerCallbackQuery({
      text: "Error updating language. Please try again.",
    });
  }
};

// Helper function to validate language code
const isValidLanguageCode = (langCode: string): boolean => {
  // Check if langCode exists in popular languages
  if (langCode in POPULAR_LANGUAGES) {
    return true;
  }

  // Check if langCode exists in any regional language category
  for (const region of Object.values(REGIONAL_LANGUAGES)) {
    if (langCode in region.languages) {
      return true;
    }
  }

  return false;
};

// Helper function to get language display name for validation
const getLanguageDisplayNameForCode = (langCode: string): string | null => {
  // Check popular languages first
  if (langCode in POPULAR_LANGUAGES) {
    return POPULAR_LANGUAGES[langCode as keyof typeof POPULAR_LANGUAGES];
  }

  // Check regional languages
  for (const region of Object.values(REGIONAL_LANGUAGES)) {
    if (langCode in region.languages) {
      return region.languages[langCode as keyof typeof region.languages];
    }
  }

  return null;
};

// Function to proceed to the next setup step
export const proceedToNextStep = async (ctx: Context, userId: string, currentStep: SetupStep | null) => {
  let nextStep: SetupStep;

  // Determine the next step based on the current step
  if (!currentStep) {
    nextStep = SetupStep.WALLET_ADDRESS;
  } else {
    switch (currentStep) {
      case SetupStep.WALLET_ADDRESS:
        // nextStep = SetupStep.AGE;
        nextStep = SetupStep.COMPLETE;
        break;
      // case SetupStep.AGE:
      //     nextStep = SetupStep.RISK_TOLERANCE;
      //     break;
      // case SetupStep.RISK_TOLERANCE:
      //     nextStep = SetupStep.TOTAL_ASSETS;
      //     break;
      // case SetupStep.TOTAL_ASSETS:
      //     nextStep = SetupStep.CRYPTO_ASSETS;
      //     break;
      // case SetupStep.CRYPTO_ASSETS:
      //     nextStep = SetupStep.COMPLETE;
      //     break;
      default:
        nextStep = SetupStep.COMPLETE;
    }
  }

  // Display prompts based on the next step
  switch (nextStep) {
    case SetupStep.WALLET_ADDRESS: {
      await ctx.reply("First, please tell me your wallet address:", {
        parse_mode: "Markdown",
      });
      await updateUserProfile(userId, {
        waitingForInput: SetupStep.WALLET_ADDRESS,
        currentSetupStep: SetupStep.WALLET_ADDRESS,
      });
      break;
    }

    case SetupStep.COMPLETE: {
      const profile = await getUserProfile(userId);

      const profileSummary =
        "**Setup is complete!** \n I'll keep an eye on your tokens and alert you with the reason when danger's near.";

      await ctx.reply(profileSummary, {
        parse_mode: "Markdown",
      });

      // Mark setup as complete
      await updateUserProfile(userId, {
        waitingForInput: null,
        currentSetupStep: null,
        setupCompleted: true,
      });
      break;
    }
  }
};
