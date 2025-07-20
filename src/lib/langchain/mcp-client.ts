import { BaseCheckpointSaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatOpenAI } from "@langchain/openai";
import { logger } from "../../utils/logger";
import { sequentialThinking } from "./tools/mcp-server";

/**
 * MCP Client Configuration
 *
 * Provides standardized MCP server connections for various tools
 * Can be extended with additional servers as needed
 */
let mcpClient: MultiServerMCPClient | null = null;
let mcpTools: any[] = [];

/**
 * Initialize MCP client with predefined server configurations
 */
export const initMCPClient = async (): Promise<void> => {
  if (mcpClient) {
    logger.info("MCP client already initialized");
    return;
  }

  try {
    mcpClient = new MultiServerMCPClient({
      throwOnLoadError: false, // Don't throw on load errors to maintain stability
      prefixToolNameWithServerName: false,
      additionalToolNamePrefix: "",
      useStandardContentBlocks: true,
      mcpServers: {
        sequentialThinking,
      },
    });

    mcpTools = await mcpClient.getTools();
    logger.info("MCP client initialized successfully", {
      toolCount: mcpTools.length,
      toolNames: mcpTools.map((tool) => tool.name),
    });
  } catch (error) {
    logger.error("Failed to initialize MCP client", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Set empty tools array as fallback
    mcpTools = [];
  }
};

/**
 * Get available MCP tools
 * Initialize client if not already done
 */
export const getMCPTools = async (): Promise<any[]> => {
  if (!mcpClient) {
    await initMCPClient();
  }
  return mcpTools;
};

/**
 * Close MCP client connections
 * Should be called during shutdown
 */
export const closeMCPClient = async (): Promise<void> => {
  if (mcpClient) {
    await mcpClient.close();
    mcpClient = null;
    mcpTools = [];
    logger.info("MCP client closed");
  }
};

/**
 * Check if MCP client is available and ready
 */
export const isMCPAvailable = (): boolean => {
  return mcpClient !== null && mcpTools.length > 0;
};

/**
 * Create React Agent with optional MCP tools support
 *
 * @param llm - Language model to use
 * @param tools - Regular tools to include
 * @param prompt - Prompt template
 * @param checkpointSaver - Memory checkpoint saver
 * @param includeMCP - Whether to include MCP tools (default: true)
 */
export const createReactAgentWithMCP = async ({
  llm,
  tools = [],
  prompt,
  checkpointSaver,
  includeMCP = true,
}: {
  llm: ChatOpenAI;
  tools?: any[];
  prompt: any;
  checkpointSaver?: BaseCheckpointSaver;
  includeMCP?: boolean;
}) => {
  let allTools = [...tools];

  if (includeMCP) {
    try {
      const mcpTools = await getMCPTools();
      allTools = [...allTools, ...mcpTools];
      logger.info("MCP tools added to agent", {
        mcpToolCount: mcpTools.length,
        totalToolCount: allTools.length,
      });
    } catch (error) {
      logger.warn("Failed to load MCP tools, proceeding without them", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return createReactAgent({
    llm,
    tools: allTools,
    prompt,
    checkpointSaver,
  });
};
