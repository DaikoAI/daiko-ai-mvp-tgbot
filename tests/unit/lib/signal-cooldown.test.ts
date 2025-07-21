import { describe, expect, it } from "vitest";
import { COOLDOWN_CONFIG, isExcludedToken } from "../../../src/constants/signal-cooldown";
import {
    calculateSmartCooldown,
    classifyMarketCondition,
    getRemainingCooldownTime,
    getSignalStrengthLevel,
    isWithinCooldown,
} from "../../../src/lib/signal-cooldown";
import type { TechnicalAnalysisResult } from "../../../src/lib/ta";

describe("Signal Cooldown System", () => {
  describe("Token Exclusion", () => {
    it("should exclude USDC stablecoin", () => {
      const usdcAddress = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const result = isExcludedToken(usdcAddress);

      expect(result.excluded).toBe(true);
      expect(result.reason).toBe("STABLECOIN");
    });

    it("should exclude USDT stablecoin", () => {
      const usdtAddress = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
      const result = isExcludedToken(usdtAddress);

      expect(result.excluded).toBe(true);
      expect(result.reason).toBe("STABLECOIN");
    });

    it("should not exclude WBTC (now allowed)", () => {
      const wbtcAddress = "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E";
      const result = isExcludedToken(wbtcAddress);

      expect(result.excluded).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it("should not exclude jupSOL (now allowed)", () => {
      const jupSolAddress = "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v";
      const result = isExcludedToken(jupSolAddress);

      expect(result.excluded).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it("should not exclude regular tokens", () => {
      const wifAddress = "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"; // WIF
      const result = isExcludedToken(wifAddress);

      expect(result.excluded).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it("should not exclude SOL", () => {
      const solAddress = "So11111111111111111111111111111111111111112";
      const result = isExcludedToken(solAddress);

      expect(result.excluded).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it("should not exclude unknown token addresses", () => {
      const unknownAddress = "1234567890abcdef1234567890abcdef12345678";
      const result = isExcludedToken(unknownAddress);

      expect(result.excluded).toBe(false);
      expect(result.reason).toBeUndefined();
    });
  });

  describe("calculateSmartCooldown", () => {
    it("should calculate shorter cooldown for high volatility memecoin", () => {
      const analysis: TechnicalAnalysisResult = {
        atrPercent: 8.0, // Memecoin level
        adx: 35, // Strong trend
        rsi: 75, // Overbought (extremity)
      };

      const cooldown = calculateSmartCooldown(analysis, 0.9); // High confidence

      // Expected: 30 * (3/8) * 0.7 * 0.8 * 0.6 = 4.73 → 15 (min limit)
      expect(cooldown).toBe(15);
    });

    it("should calculate longer cooldown for stable low volatility asset", () => {
      const analysis: TechnicalAnalysisResult = {
        atrPercent: 1.5, // Low volatility
        adx: 18, // Weak trend
        rsi: 55, // Normal range
      };

      const cooldown = calculateSmartCooldown(analysis, 0.4); // Low confidence

      // Expected: 30 * 2.0 * 1.3 * 1.0 * 1.0 = 78
      expect(cooldown).toBe(78);
    });

    it("should respect minimum cooldown limit", () => {
      const analysis: TechnicalAnalysisResult = {
        atrPercent: 15.0, // Extremely high volatility
        adx: 45, // Very strong trend
        rsi: 80, // Extreme overbought
      };

      const cooldown = calculateSmartCooldown(analysis, 1.0); // Max confidence

      expect(cooldown).toBeGreaterThanOrEqual(COOLDOWN_CONFIG.MIN_COOLDOWN);
    });

    it("should respect maximum cooldown limit", () => {
      const analysis: TechnicalAnalysisResult = {
        atrPercent: 0.5, // Very low volatility
        adx: 10, // Very weak trend
        rsi: 50, // Normal
      };

      const cooldown = calculateSmartCooldown(analysis, 0.1); // Very low confidence

      expect(cooldown).toBeLessThanOrEqual(COOLDOWN_CONFIG.MAX_COOLDOWN);
    });

    it("should handle missing analysis data gracefully", () => {
      const analysis: TechnicalAnalysisResult = {}; // Empty analysis

      const cooldown = calculateSmartCooldown(analysis);

      expect(cooldown).toBeGreaterThan(0);
      expect(cooldown).toBeLessThanOrEqual(COOLDOWN_CONFIG.MAX_COOLDOWN);
    });
  });

  describe("classifyMarketCondition", () => {
    it("should classify memecoin correctly", () => {
      expect(classifyMarketCondition(10.0)).toBe("MEME_COIN");
      expect(classifyMarketCondition(8.0)).toBe("MEME_COIN");
    });

    it("should classify high volatility correctly", () => {
      expect(classifyMarketCondition(6.0)).toBe("HIGH_VOLATILITY");
      expect(classifyMarketCondition(5.0)).toBe("HIGH_VOLATILITY");
    });

    it("should classify normal volatility correctly", () => {
      expect(classifyMarketCondition(3.0)).toBe("NORMAL");
      expect(classifyMarketCondition(2.0)).toBe("NORMAL");
    });

    it("should classify stable asset correctly", () => {
      expect(classifyMarketCondition(1.0)).toBe("STABLE");
      expect(classifyMarketCondition(0.5)).toBe("STABLE");
    });
  });

  describe("getSignalStrengthLevel", () => {
    it("should classify signal strength correctly", () => {
      expect(getSignalStrengthLevel(0.9)).toBe("HIGH");
      expect(getSignalStrengthLevel(0.8)).toBe("HIGH");

      expect(getSignalStrengthLevel(0.7)).toBe("MEDIUM");
      expect(getSignalStrengthLevel(0.6)).toBe("MEDIUM");

      expect(getSignalStrengthLevel(0.5)).toBe("LOW");
      expect(getSignalStrengthLevel(0.4)).toBe("LOW");

      expect(getSignalStrengthLevel(0.3)).toBe("WEAK");
      expect(getSignalStrengthLevel(0.1)).toBe("WEAK");
    });
  });

  describe("isWithinCooldown", () => {
    it("should return true when within cooldown period", () => {
      const lastSignalTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      const cooldownMinutes = 30;

      expect(isWithinCooldown(lastSignalTime, cooldownMinutes)).toBe(true);
    });

    it("should return false when cooldown period has passed", () => {
      const lastSignalTime = new Date(Date.now() - 40 * 60 * 1000); // 40 minutes ago
      const cooldownMinutes = 30;

      expect(isWithinCooldown(lastSignalTime, cooldownMinutes)).toBe(false);
    });

    it("should handle edge case exactly at cooldown boundary", () => {
      const lastSignalTime = new Date(Date.now() - 30 * 60 * 1000); // Exactly 30 minutes ago
      const cooldownMinutes = 30;

      expect(isWithinCooldown(lastSignalTime, cooldownMinutes)).toBe(false);
    });
  });

  describe("getRemainingCooldownTime", () => {
    it("should calculate remaining time correctly", () => {
      const lastSignalTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      const cooldownMinutes = 30;

      const remaining = getRemainingCooldownTime(lastSignalTime, cooldownMinutes);

      expect(remaining).toBe(20); // 30 - 10 = 20 minutes remaining
    });

    it("should return 0 when cooldown has passed", () => {
      const lastSignalTime = new Date(Date.now() - 40 * 60 * 1000); // 40 minutes ago
      const cooldownMinutes = 30;

      const remaining = getRemainingCooldownTime(lastSignalTime, cooldownMinutes);

      expect(remaining).toBe(0);
    });

    it("should round up remaining time to nearest minute", () => {
      const lastSignalTime = new Date(Date.now() - 10.5 * 60 * 1000); // 10.5 minutes ago
      const cooldownMinutes = 30;

      const remaining = getRemainingCooldownTime(lastSignalTime, cooldownMinutes);

      expect(remaining).toBe(20); // Should round up
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle typical SOL memecoin scenario", () => {
      const analysis: TechnicalAnalysisResult = {
        atrPercent: 12.0, // High volatility memecoin
        adx: 42, // Strong trend
        rsi: 25, // Oversold
        vwap: 0.05,
        vwapDeviation: -3.2,
        obvZScore: 2.5,
        percentB: 0.05,
      };

      const cooldown = calculateSmartCooldown(analysis, 0.85);

      expect(cooldown).toBeGreaterThanOrEqual(15);
      expect(cooldown).toBeLessThanOrEqual(30);
      expect(classifyMarketCondition(analysis.atrPercent!)).toBe("MEME_COIN");
    });

    it("should handle blue-chip altcoin scenario", () => {
      const analysis: TechnicalAnalysisResult = {
        atrPercent: 3.5, // Moderate volatility
        adx: 28, // Established trend (strong trend > 25)
        rsi: 65, // Slightly overbought
        vwap: 25.0,
        vwapDeviation: 1.8,
        obvZScore: 1.2,
        percentB: 0.75,
      };

      const cooldown = calculateSmartCooldown(analysis, 0.7);

      // ADX=28 triggers strong trend factor (0.7), resulting in shorter cooldown
      // 30 * 0.86 * 0.7 * 1.0 * 0.8 = 14.4 → 15 (min limit)
      expect(cooldown).toBe(15);
      expect(classifyMarketCondition(analysis.atrPercent!)).toBe("NORMAL");
    });

    it("should handle stablecoin-like scenario", () => {
      const analysis: TechnicalAnalysisResult = {
        atrPercent: 0.8, // Very low volatility
        adx: 15, // Range-bound
        rsi: 52, // Neutral
        vwap: 1.0,
        vwapDeviation: 0.1,
        obvZScore: 0.2,
        percentB: 0.48,
      };

      const cooldown = calculateSmartCooldown(analysis, 0.5);

      expect(cooldown).toBeGreaterThanOrEqual(60);
      expect(cooldown).toBeLessThanOrEqual(120);
      expect(classifyMarketCondition(analysis.atrPercent!)).toBe("STABLE");
    });
  });
});