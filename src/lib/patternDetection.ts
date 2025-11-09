import { format } from "date-fns";
import {
  AnalysisSummary,
  InsightConfidence,
  IntradayPoint,
  PatternInsight,
  SignalMarker,
} from "./types";

const BIG_MOVE_LOOKBACK = 3;
const BIG_MOVE_THRESHOLD = 0.6;

function calculateEMA(points: IntradayPoint[], length: number): number[] {
  if (points.length === 0) return [];

  const k = 2 / (length + 1);
  const ema: number[] = new Array(points.length).fill(0);
  ema[0] = points[0].close;

  for (let i = 1; i < points.length; i += 1) {
    ema[i] = points[i].close * k + ema[i - 1] * (1 - k);
  }

  return ema;
}

function toConfidence(change: number): InsightConfidence {
  const absChange = Math.abs(change);

  if (absChange >= 1.5) return "high";
  if (absChange >= 1.0) return "medium";
  return "low";
}

function detectBigMoves(points: IntradayPoint[]): {
  insights: PatternInsight[];
  signals: SignalMarker[];
} {
  const moves: Array<{
    index: number;
    changePct: number;
    direction: "bullish" | "bearish";
    spanStart: number;
  }> = [];

  for (let i = BIG_MOVE_LOOKBACK; i < points.length; i += 1) {
    const baseClose = points[i - BIG_MOVE_LOOKBACK].close;
    const latestClose = points[i].close;
    const changePct = ((latestClose - baseClose) / baseClose) * 100;

    if (Math.abs(changePct) >= BIG_MOVE_THRESHOLD) {
      moves.push({
        index: i,
        changePct,
        direction: changePct >= 0 ? "bullish" : "bearish",
        spanStart: i - BIG_MOVE_LOOKBACK,
      });
    }
  }

  moves.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

  const topMoves = moves.slice(0, 4);

  const insights: PatternInsight[] = topMoves.map((move, idx) => {
    const point = points[move.index];
    const startPoint = points[move.spanStart];
    const directionLabel = move.direction === "bullish" ? "Bullish" : "Bearish";
    const label = `${directionLabel} impulse #${idx + 1}`;

    return {
      id: `big-move-${move.index}`,
      title: label,
      description: `${directionLabel} burst of ${move.changePct.toFixed(
        2,
      )}% between ${format(
        startPoint.timestamp * 1000,
        "HH:mm",
      )} and ${format(point.timestamp * 1000, "HH:mm")} indicates aggressive ${
        move.direction === "bullish" ? "buying" : "selling"
      } pressure.`,
      confidence: toConfidence(move.changePct),
      startIndex: move.spanStart,
      endIndex: move.index,
      changePct: move.changePct,
      direction: move.direction,
    };
  });

  const signals: SignalMarker[] = topMoves.map((move) => ({
    timestamp: points[move.index].timestamp,
    price: points[move.index].close,
    label:
      move.direction === "bullish" ? "Momentum Upswing" : "Momentum Flush",
    confidence: toConfidence(move.changePct),
    direction: move.direction,
  }));

  return { insights, signals };
}

function detectTrendShifts(
  points: IntradayPoint[],
  ema9: number[],
  ema21: number[],
): PatternInsight[] {
  const insights: PatternInsight[] = [];

  for (let i = 1; i < points.length; i += 1) {
    const prevDiff = ema9[i - 1] - ema21[i - 1];
    const currDiff = ema9[i] - ema21[i];

    if (prevDiff <= 0 && currDiff > 0) {
      insights.push({
        id: `bullish-cross-${i}`,
        title: "Short-term bullish transition",
        description: `Fast EMA crossed above the intermediate trend near ${format(
          points[i].timestamp * 1000,
          "HH:mm",
        )}, suggesting renewed upside momentum.`,
        confidence: "medium",
        startIndex: i - 1,
        endIndex: i,
        direction: "bullish",
      });
    } else if (prevDiff >= 0 && currDiff < 0) {
      insights.push({
        id: `bearish-cross-${i}`,
        title: "Short-term bearish transition",
        description: `Fast EMA slipped beneath the intermediate trend near ${format(
          points[i].timestamp * 1000,
          "HH:mm",
        )}, flagging a potential fade.`,
        confidence: "medium",
        startIndex: i - 1,
        endIndex: i,
        direction: "bearish",
      });
    }
  }

  return insights.slice(-3);
}

function detectCompressionBreakout(points: IntradayPoint[]): PatternInsight[] {
  if (points.length < 20) return [];

  let minRange = Infinity;
  let minIndex = 0;

  for (let i = 10; i < points.length; i += 1) {
    const windowPoints = points.slice(i - 10, i);
    const highs = windowPoints.map((p) => p.high);
    const lows = windowPoints.map((p) => p.low);

    const range = (Math.max(...highs) - Math.min(...lows)) / points[i].close;

    if (range < minRange) {
      minRange = range;
      minIndex = i;
    }
  }

  const breakoutIndex = Math.min(points.length - 1, minIndex + 3);
  const changePct =
    ((points[breakoutIndex].close - points[minIndex].close) /
      points[minIndex].close) *
    100;

  if (Math.abs(changePct) < 0.8) return [];

  return [
    {
      id: `compression-${breakoutIndex}`,
      title: "Tight-range expansion",
      description: `Price coiled within a tight ${(
        minRange * 100
      ).toFixed(
        2,
      )}% band before releasing ${changePct.toFixed(
        2,
      )}%, often a precursor to sustained follow-through.`,
      confidence: toConfidence(changePct),
      startIndex: minIndex,
      endIndex: breakoutIndex,
      changePct,
      direction: changePct >= 0 ? "bullish" : "bearish",
    },
  ];
}

function buildNarrative(points: IntradayPoint[]): AnalysisSummary["narrative"] {
  if (points.length < 2) return "Insufficient data to build a narrative.";

  const first = points[0].close;
  const last = points[points.length - 1].close;
  const changePct = ((last - first) / first) * 100;
  const sessionHigh = Math.max(...points.map((p) => p.high));
  const sessionLow = Math.min(...points.map((p) => p.low));
  const rangePct = ((sessionHigh - sessionLow) / sessionLow) * 100;

  const bias =
    changePct > 0.6
      ? "bullish"
      : changePct < -0.6
        ? "bearish"
        : "balanced";

  const biasText =
    bias === "bullish"
      ? "Flow shows a constructive bias with buyers pressing the tape."
      : bias === "bearish"
        ? "Supply dominated the session with persistent offer absorption."
        : "Auction remained rotational with neither side in clear control.";

  return `${biasText} Spot rallied ${changePct.toFixed(
    2,
  )}% across the session while rotating through a ${rangePct.toFixed(
    2,
  )}% range. Monitor how price behaves near ${sessionHigh.toFixed(
    2,
  )} (swing high) and ${sessionLow.toFixed(
    2,
  )} (swing low) for confirmation of continuation or rejection.`;
}

export function analyzeIntradayData(points: IntradayPoint[]): AnalysisSummary {
  if (points.length === 0) {
    return {
      narrative: "No intraday prints were returned from the data source.",
      stats: {
        rangePct: 0,
        avgVolume: 0,
        sessionChangePct: 0,
        sessionHigh: 0,
        sessionLow: 0,
      },
      insights: [],
      signals: [],
      ema9: [],
      ema21: [],
    };
  }

  const ema9 = calculateEMA(points, 9);
  const ema21 = calculateEMA(points, 21);

  const { insights: bigMoveInsights, signals } = detectBigMoves(points);
  const trendInsights = detectTrendShifts(points, ema9, ema21);
  const compressionInsights = detectCompressionBreakout(points);

  const volumeSum = points.reduce((sum, point) => sum + point.volume, 0);
  const sessionHigh = Math.max(...points.map((p) => p.high));
  const sessionLow = Math.min(...points.map((p) => p.low));
  const avgVolume = volumeSum / points.length;
  const sessionChangePct =
    ((points[points.length - 1].close - points[0].close) / points[0].close) *
    100;
  const rangePct = ((sessionHigh - sessionLow) / sessionLow) * 100;

  return {
    narrative: buildNarrative(points),
    stats: {
      rangePct,
      avgVolume,
      sessionChangePct,
      sessionHigh,
      sessionLow,
    },
    insights: [
      ...bigMoveInsights,
      ...trendInsights,
      ...compressionInsights,
    ].slice(0, 6),
    signals,
    ema9,
    ema21,
  };
}
