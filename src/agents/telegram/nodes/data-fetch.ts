import { eq } from "drizzle-orm";
import { getDB, users } from "../../../db";
import { userTokenHoldings } from "../../../db/schema/user-token-holdings";
import { logger } from "../../../utils/logger";
import type { graphState } from "../graph-state";

// This node is just for connecting other data fetching nodes so that they can be called in parallel
export const dataFetchNode = async (state: typeof graphState.State): Promise<Partial<typeof graphState.State>> => {
  if (!state.userProfile?.walletAddress) {
    logger.error("User wallet address not found");
    throw new Error("User wallet address not found");
  }

  try {
    const db = getDB();
    const [user] = await db.select().from(users).where(eq(users.userId, state.userProfile.userId));

    if (!user) {
      logger.error(`User not found in database: ${state.userProfile.userId}`);
      throw new Error(`User not found: ${state.userProfile.userId}`);
    }

    const assets = await db.select().from(userTokenHoldings).where(eq(userTokenHoldings.userId, user.userId));

    return {
      ...state,
      userAssets: assets,
    };
  } catch (error) {
    logger.error("Database operation failed in data-fetch node", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
