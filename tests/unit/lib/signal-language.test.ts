import { describe, expect, it } from "vitest";
import { detectLanguageFromMessage, getLanguageDisplayName, translateTextWithLLM } from "../../../src/utils/language";

describe("Language Utilities", () => {
  describe("translateTextWithLLM", () => {
    it("should return original text for English target language", async () => {
      const text = "This is a test message";
      const result = await translateTextWithLLM(text, "en");
      expect(result).toBe(text);
    });

    it("should return original text when target language is not provided", async () => {
      const text = "This is a test message";
      const result = await translateTextWithLLM(text, "");
      expect(result).toBe(text);
    });

    it("should translate text to Spanish", async () => {
      const text = "🚀 **BUY $SOL** | Price: $150.00 | Confidence: 85%";
      const result = await translateTextWithLLM(text, "es");

      // Check that formatting is preserved
      expect(result).toContain("🚀");
      expect(result).toContain("$SOL");
      expect(result).toContain("$150.00");
      expect(result).toContain("85%");
      expect(result).not.toBe(text); // Should be different from original
    }, 30000); // 30 second timeout for LLM call

    it("should handle translation errors gracefully", async () => {
      // Mock a scenario where the LLM might fail
      const text = "Test message";
      const result = await translateTextWithLLM(text, "invalid-lang-code");

      // Should return original text on error
      expect(result).toBe(text);
    });

    it("should preserve Markdown formatting during translation", async () => {
      const text = "**Bold text** and *italic text* with `code` and [link](url)";
      const result = await translateTextWithLLM(text, "ja");

      // Check that markdown symbols are preserved
      expect(result).toContain("**");
      expect(result).toContain("*");
      expect(result).toContain("`");
      expect(result).toContain("[");
      expect(result).toContain("](");
    }, 30000);
  });

  describe("detectLanguageFromMessage", () => {
    it("should detect English messages", async () => {
      const result = await detectLanguageFromMessage("Hello, how are you doing today?");
      expect(result).toBeTruthy();
      expect(result?.code).toBe("en");
      expect(result?.confidence).toBeGreaterThan(0.7);
    }, 15000);

    it("should detect Japanese messages", async () => {
      const result = await detectLanguageFromMessage("こんにちは、元気ですか？");
      expect(result).toBeTruthy();
      expect(result?.code).toBe("ja");
      expect(result?.confidence).toBeGreaterThan(0.7);
    }, 15000);

    it("should detect Spanish messages", async () => {
      const result = await detectLanguageFromMessage("Hola, ¿cómo estás?");
      expect(result).toBeTruthy();
      expect(result?.code).toBe("es");
      expect(result?.confidence).toBeGreaterThan(0.7);
    }, 15000);

    it("should return null for very short messages", async () => {
      const result = await detectLanguageFromMessage("Hi");
      expect(result).toBeNull();
    });

    it("should return null for empty messages", async () => {
      const result = await detectLanguageFromMessage("");
      expect(result).toBeNull();
    });
  });

  describe("getLanguageDisplayName", () => {
    it("should return display name for English", () => {
      const result = getLanguageDisplayName("en");
      expect(result).toBe("🇺🇸 English");
    });

    it("should return display name for Japanese", () => {
      const result = getLanguageDisplayName("ja");
      expect(result).toBe("🇯🇵 日本語");
    });

    it("should return fallback for unknown language codes", () => {
      const result = getLanguageDisplayName("unknown");
      expect(result).toBe("🌐 UNKNOWN");
    });

    it("should handle case insensitivity", () => {
      const result = getLanguageDisplayName("EN");
      expect(result).toBe("🇺🇸 English");
    });
  });
});
