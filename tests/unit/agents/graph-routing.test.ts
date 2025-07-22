import { describe, expect, it } from "bun:test";
import { END } from "@langchain/langgraph";
import { managerRouter } from "../../../src/agents/telegram/graph-route";
import type { graphState } from "../../../src/agents/telegram/graph-state";

describe("Graph Routing", () => {
  it("should route to dataFetch when data fetch flag is true", () => {
    const state: typeof graphState.State = {
      messages: [],
      userAssets: [],
      userProfile: null,
      isDataFetchNodeQuery: true,
      isGeneralQuery: false,
    };

    const result = managerRouter(state);
    expect(result).toBe("dataFetch");
  });

  it("should route to generalist when general query flag is true", () => {
    const state: typeof graphState.State = {
      messages: [],
      userAssets: [],
      userProfile: null,
      isDataFetchNodeQuery: false,
      isGeneralQuery: true,
    };

    const result = managerRouter(state);
    expect(result).toBe("generalist");
  });

  it("should route to END when no flags are set", () => {
    const state: typeof graphState.State = {
      messages: [],
      userAssets: [],
      userProfile: null,
      isDataFetchNodeQuery: false,
      isGeneralQuery: false,
    };

    const result = managerRouter(state);
    expect(result).toBe(END);
  });

  it("should prioritize dataFetch over generalist", () => {
    const state: typeof graphState.State = {
      messages: [],
      userAssets: [],
      userProfile: null,
      isDataFetchNodeQuery: true,
      isGeneralQuery: true,
    };

    const result = managerRouter(state);
    expect(result).toBe("dataFetch");
  });
});
