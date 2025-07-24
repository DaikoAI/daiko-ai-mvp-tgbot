#!/usr/bin/env bun

import { spawn } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../src/utils/logger";

async function ensureDocsDirectory() {
  const docsDir = join(process.cwd(), "docs");
  if (!existsSync(docsDir)) {
    await mkdir(docsDir, { recursive: true });
  }
}

function createSignalAgentMermaid(): string {
  return `graph TD
    START([START]) --> static_filter[Static Filter<br/>Apply Static Filter]

    static_filter --> |shouldProceed: false| END_EARLY[END - No Signal]
    static_filter --> |shouldProceed: true| data_fetch[Data Fetch<br/>Fetch Token Data]

    data_fetch --> |success| llm_analysis[LLM Analysis<br/>Analyze LLM Signal]
    data_fetch --> |error| END_ERROR[END - Data Error]

    llm_analysis --> |shouldGenerateSignal: true| format_signal[Format Signal<br/>Format Signal]
    llm_analysis --> |shouldGenerateSignal: false| END_NO_SIGNAL[END - No Signal Generated]

    format_signal --> |success| END_SUCCESS[END - Signal Generated]
    format_signal --> |error| END_FORMAT_ERROR[END - Format Error]

    classDef startEnd fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef process fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef decision fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef error fill:#ffebee,stroke:#c62828,stroke-width:2px

    class START,END_EARLY,END_ERROR,END_NO_SIGNAL,END_SUCCESS,END_FORMAT_ERROR startEnd
    class static_filter,data_fetch,llm_analysis,format_signal process`;
}

function createTelegramAgentMermaid(): string {
  return `graph TD
    START([START]) --> dataFetch[Data Fetch<br/>Fetch User Data & Assets]

    dataFetch --> |success| generalist[Generalist<br/>Handle General Queries<br/>& Provide Responses]
    dataFetch --> |error| END_ERROR[END - Data Fetch Error]

    generalist --> |response generated| END_SUCCESS[END - Response Sent]
    generalist --> |error| END_GENERAL_ERROR[END - Response Error]

    classDef startEnd fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px
    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    classDef error fill:#ffebee,stroke:#c62828,stroke-width:2px

    class START,END_SUCCESS startEnd
    class dataFetch,generalist process
    class END_ERROR,END_GENERAL_ERROR error`;
}

async function generateSignalGraphImage() {
  try {
    logger.info("Generating Signal Agent graph...");

    const mermaidCode = createSignalAgentMermaid();

    // Save Mermaid file temporarily
    const tempMermaidFile = join(process.cwd(), "temp-signal-graph.mmd");
    await writeFile(tempMermaidFile, mermaidCode);

    // Generate PNG image using Mermaid CLI
    const outputPath = join(process.cwd(), "docs", "signal-agent-graph.png");

    return new Promise<void>((resolve, reject) => {
      const mmdc = spawn("npx", ["mmdc", "-i", tempMermaidFile, "-o", outputPath, "-t", "neutral", "-b", "white"], {
        stdio: ["inherit", "inherit", "inherit"],
      });

      mmdc.on("close", (code: number) => {
        // Clean up temp file
        try {
          unlinkSync(tempMermaidFile);
        } catch (error) {
          logger.warn("Failed to cleanup temp file", {
            file: tempMermaidFile,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        if (code === 0) {
          logger.info(`Signal Agent graph saved to: ${outputPath}`);
          resolve();
        } else {
          reject(new Error(`mmdc process exited with code ${code}`));
        }
      });

      mmdc.on("error", (error: Error) => {
        reject(error);
      });
    });
  } catch (error) {
    logger.error("Failed to generate Signal Agent graph", error);
    throw error;
  }
}

async function generateTelegramGraphImage() {
  try {
    logger.info("Generating Telegram Agent graph...");

    const mermaidCode = createTelegramAgentMermaid();

    // Save Mermaid file temporarily
    const tempMermaidFile = join(process.cwd(), "temp-telegram-graph.mmd");
    await writeFile(tempMermaidFile, mermaidCode);

    // Generate PNG image using Mermaid CLI
    const outputPath = join(process.cwd(), "docs", "telegram-agent-graph.png");

    return new Promise<void>((resolve, reject) => {
      const mmdc = spawn("npx", ["mmdc", "-i", tempMermaidFile, "-o", outputPath, "-t", "neutral", "-b", "white"], {
        stdio: ["inherit", "inherit", "inherit"],
      });

      mmdc.on("close", (code: number) => {
        // Clean up temp file
        try {
          unlinkSync(tempMermaidFile);
        } catch (error) {
          logger.warn("Failed to cleanup temp file", {
            file: tempMermaidFile,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        if (code === 0) {
          logger.info(`Telegram Agent graph saved to: ${outputPath}`);
          resolve();
        } else {
          reject(new Error(`mmdc process exited with code ${code}`));
        }
      });

      mmdc.on("error", (error: Error) => {
        reject(error);
      });
    });
  } catch (error) {
    logger.error("Failed to generate Telegram Agent graph", error);
    throw error;
  }
}

async function main() {
  console.log("🎨 Generating agent graph images...");
  logger.info("🎨 Starting agent graph image generation");

  const startTime = Date.now();

  try {
    await ensureDocsDirectory();

    // Generate both graphs in parallel
    await Promise.all([generateSignalGraphImage(), generateTelegramGraphImage()]);

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    const message = `✅ Agent graph images generated successfully in ${executionTime}ms (${(executionTime / 1000).toFixed(2)}s)`;
    console.log(message);
    logger.info(message);

    console.log("\nGenerated files:");
    console.log("📊 docs/signal-agent-graph.png");
    console.log("📊 docs/telegram-agent-graph.png");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Graph image generation failed:", errorMessage);
    logger.error("❌ Graph image generation failed:", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Script execution failed:", error);
  logger.error("❌ Script execution failed:", error);
  process.exit(1);
});
