import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import type { Tool } from "@langchain/core/tools";
import { createReactAgentWithMCP } from "../../../lib/langchain/mcp-client";
import { gpt4o } from "../../model";
import { memory, type graphState } from "../graph-state";
import { generalPrompt } from "../prompts/general";

// Initialize tools array
const tools: Tool[] = [];

// Only add Tavily search if API key is available
if (process.env.TAVILY_API_KEY) {
  tools.push(new TavilySearchResults());
}

export const generalistNode = async (state: typeof graphState.State): Promise<Partial<typeof graphState.State>> => {
  const { messages } = state;

  const agent = await createReactAgentWithMCP({
    llm: gpt4o,
    tools,
    prompt: generalPrompt,
    checkpointSaver: memory,
    includeMCP: true,
  });
  const result = await agent.invoke({ messages });

  return { messages: [...result.messages] };
};
