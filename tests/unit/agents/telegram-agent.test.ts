import { describe, expect, it } from "vitest";
import { initTelegramGraph } from "../../../src/agents/telegram/graph";

describe("Telegram Agent", () => {
  it("should initialize graph successfully", async () => {
    const userId = "test-user-123";
    const { graph, config } = await initTelegramGraph(userId);

    // エージェントが正常に初期化されることを確認
    expect(graph).toBeDefined();
    expect(config).toBeDefined();
    expect(config.configurable.thread_id).toBe(userId);
  });

  it("should create unique thread ID for different users", async () => {
    const userIds = ["user1", "user2", "user3"];

    for (const userId of userIds) {
      const { config } = await initTelegramGraph(userId);
      expect(config.configurable.thread_id).toBe(userId);
    }
  });

  it("should handle graph compilation with all nodes", async () => {
    const { graph } = await initTelegramGraph("test-user");

    // グラフが適切にコンパイルされ、必要なメソッドが存在することを確認
    expect(typeof graph.invoke).toBe("function");
    expect(typeof graph.stream).toBe("function");
    expect(graph).toBeDefined();
  });

  it("should handle long user IDs", async () => {
    const longUserId = "very-long-user-id-with-many-characters-1234567890";
    const { config } = await initTelegramGraph(longUserId);

    expect(config.configurable.thread_id).toBe(longUserId);
  });
});
