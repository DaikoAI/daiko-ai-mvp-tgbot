import type { SignalGraphState } from "../agents/signal/graph-state";
import { safeParseNumber } from "../utils/number";

/**
 * Technical indicator analyzer with beginner-friendly explanations
 */
export class TechnicalIndicatorAnalyzer {
  private indicators: Array<{
    name: string;
    value: number;
    condition: string;
    priority: number;
  }> = [];

  constructor(private ta: SignalGraphState["technicalAnalysis"]) {
    if (ta) {
      this.analyzeAllIndicators();
    }
  }

  private analyzeAllIndicators(): void {
    this.analyzeRSI();
    this.analyzeBollingerBands();
    this.analyzeADX();
    this.analyzeVWAPDeviation();
    this.analyzeOBVZScore();
    this.analyzeATRPercent();
  }

  private analyzeRSI(): void {
    const rsi = safeParseNumber(this.ta?.rsi);
    if (rsi === null || rsi < 0 || rsi > 100) {
      // RSIは0-100の範囲である必要がある
      return;
    }

    let condition: string;
    let priority = 0;

    if (rsi >= 80) {
      condition = "extremely overbought conditions favor sellers";
      priority = 3;
    } else if (rsi >= 70) {
      condition = "overbought conditions favor sellers";
      priority = 2;
    } else if (rsi <= 20) {
      condition = "extremely oversold conditions favor buyers";
      priority = 3;
    } else if (rsi <= 30) {
      condition = "oversold conditions favor buyers";
      priority = 2;
    } else if (rsi >= 45 && rsi <= 55) {
      condition = "neutral momentum, no strong bias";
      priority = 0;
    } else {
      condition = rsi > 50 ? "slightly bullish momentum" : "slightly bearish momentum";
      priority = 1;
    }

    this.indicators.push({
      name: `RSI ${rsi.toFixed(0)}`,
      value: rsi,
      condition,
      priority,
    });
  }

  private analyzeBollingerBands(): void {
    const percentB = safeParseNumber(this.ta?.percent_b);
    if (percentB === null) return;

    let condition: string;
    let priority = 0;

    if (percentB >= 1.0) {
      condition = "price breaking above upper band (potential reversal)";
      priority = 2;
    } else if (percentB >= 0.8) {
      condition = "approaching overbought territory";
      priority = 1;
    } else if (percentB <= 0.0) {
      condition = "price touching lower band (potential support)";
      priority = 2;
    } else if (percentB <= 0.2) {
      condition = "approaching oversold territory";
      priority = 1;
    } else {
      condition = `price within normal trading range (${(percentB * 100).toFixed(0)}% of band)`;
      priority = 0;
    }

    this.indicators.push({
      name: `Bollinger %B ${(percentB * 100).toFixed(0)}%`,
      value: percentB,
      condition,
      priority,
    });
  }

  private analyzeADX(): void {
    const adx = safeParseNumber(this.ta?.adx);
    if (adx === null) return;

    let condition: string;
    let priority = 0;

    if (adx >= 50) {
      condition = "extremely strong trend - high conviction trade";
      priority = 3;
    } else if (adx >= 25) {
      condition = "strong trend developing";
      priority = 2;
    } else if (adx >= 15) {
      condition = "moderate trend strength building";
      priority = 1;
    } else {
      condition = "weak trend - range-bound market";
      priority = 0;
    }

    // Add direction if available and meaningful
    const direction = this.ta?.adx_direction;
    if (direction && direction !== "NEUTRAL" && adx >= 20) {
      condition += ` (${direction.toLowerCase()}ward)`;
    }

    this.indicators.push({
      name: `ADX ${adx.toFixed(0)}`,
      value: adx,
      condition,
      priority,
    });
  }

  private analyzeVWAPDeviation(): void {
    const vwapDev = safeParseNumber(this.ta?.vwap_deviation);
    if (vwapDev === null) return;

    const absDeviation = Math.abs(vwapDev);
    let condition: string;
    let priority = 0;

    if (absDeviation >= 10) {
      condition = `extreme ${vwapDev > 0 ? "premium" : "discount"} to volume-weighted average`;
      priority = 3;
    } else if (absDeviation >= 5) {
      condition = `significant ${vwapDev > 0 ? "premium" : "discount"} to VWAP`;
      priority = 2;
    } else if (absDeviation >= 2) {
      condition = `moderate ${vwapDev > 0 ? "premium" : "discount"} to fair value`;
      priority = 1;
    } else {
      condition = "trading near volume-weighted fair value";
      priority = 0;
    }

    this.indicators.push({
      name: `VWAP Dev ${vwapDev > 0 ? "+" : ""}${vwapDev.toFixed(1)}%`,
      value: absDeviation,
      condition,
      priority,
    });
  }

  private analyzeOBVZScore(): void {
    const obvZScore = safeParseNumber(this.ta?.obv_zscore);
    if (obvZScore === null) return;

    const absZScore = Math.abs(obvZScore);
    let condition: string;
    let priority = 0;

    if (absZScore >= 2.5) {
      condition = `extreme volume ${obvZScore > 0 ? "accumulation" : "distribution"} detected`;
      priority = 3;
    } else if (absZScore >= 1.5) {
      condition = `strong volume ${obvZScore > 0 ? "buying" : "selling"} pressure`;
      priority = 2;
    } else if (absZScore >= 0.5) {
      condition = `moderate volume ${obvZScore > 0 ? "inflow" : "outflow"}`;
      priority = 1;
    } else {
      condition = "balanced volume activity";
      priority = 0;
    }

    this.indicators.push({
      name: `Volume Flow ${obvZScore > 0 ? "+" : ""}${obvZScore.toFixed(1)}σ`,
      value: absZScore,
      condition,
      priority,
    });
  }

  private analyzeATRPercent(): void {
    const atrPercent = safeParseNumber(this.ta?.atr_percent);
    if (atrPercent === null) return;

    let condition: string;
    let priority = 0;

    if (atrPercent > 10) {
      condition = "extremely high volatility - large price swings expected";
      priority = 2;
    } else if (atrPercent > 5) {
      condition = "high volatility - increased risk and opportunity";
      priority = 1;
    } else if (atrPercent >= 2) {
      condition = "moderate volatility - normal price movement";
      priority = 0;
    } else {
      // ATR < 2%
      condition = "low volatility - range-bound price action";
      priority = 0;
    }

    this.indicators.push({
      name: `Volatility ${atrPercent.toFixed(1)}%`,
      value: atrPercent,
      condition,
      priority,
    });
  }

  /**
   * Returns the top 3 most relevant indicators formatted as simple bullets
   */
  getBulletPoints(): string[] {
    return this.indicators
      .sort((a, b) => b.priority - a.priority || b.value - a.value)
      .slice(0, 3)
      .map((indicator) => `${indicator.name} - ${indicator.condition}`);
  }
}
