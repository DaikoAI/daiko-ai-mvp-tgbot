import { describe, expect, it } from "vitest";
import { getLanguageDisplayName } from "../../../src/utils/language";

describe("Language Utilities", () => {
  describe("getLanguageDisplayName", () => {
    it("should return English display name for 'en' code", () => {
      const result = getLanguageDisplayName("en");
      expect(result).toBe("🇺🇸 English");
    });

    it("should return Japanese display name for 'ja' code", () => {
      const result = getLanguageDisplayName("ja");
      expect(result).toBe("🇯🇵 日本語");
    });

    it("should return default format for unknown language code", () => {
      const result = getLanguageDisplayName("unknown");
      expect(result).toBe("🌐 UNKNOWN");
    });

    it("should handle uppercase language codes", () => {
      const result = getLanguageDisplayName("EN");
      expect(result).toBe("🇺🇸 English");
    });
  });
});
