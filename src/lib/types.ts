export type InsightConfidence = "high" | "medium" | "low";

export interface IntradayPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PatternInsight {
  id: string;
  title: string;
  description: string;
  confidence: InsightConfidence;
  startIndex?: number;
  endIndex?: number;
  changePct?: number;
  direction?: "bullish" | "bearish";
}

export interface SignalMarker {
  timestamp: number;
  price: number;
  label: string;
  confidence: InsightConfidence;
  direction: "bullish" | "bearish";
}

export interface AnalysisSummary {
  narrative: string;
  stats: {
    rangePct: number;
    avgVolume: number;
    sessionChangePct: number;
    sessionHigh: number;
    sessionLow: number;
  };
  insights: PatternInsight[];
  signals: SignalMarker[];
  ema9: number[];
  ema21: number[];
}
