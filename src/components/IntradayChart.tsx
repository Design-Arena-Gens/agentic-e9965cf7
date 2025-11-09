"use client";

import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  TimeScale,
  Tooltip,
} from "chart.js";
import "chartjs-adapter-date-fns";
import { Line } from "react-chartjs-2";
import type { IntradayPoint, SignalMarker } from "@/lib/types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Tooltip,
  Legend,
  Filler,
);

interface IntradayChartProps {
  points: IntradayPoint[];
  ema9: number[];
  ema21: number[];
  signals: SignalMarker[];
}

const priceGradient = (ctx?: CanvasRenderingContext2D | null) => {
  if (!ctx) return "rgba(56, 189, 248, 0.18)";

  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, "rgba(56, 189, 248, 0.35)");
  gradient.addColorStop(1, "rgba(59, 130, 246, 0)");
  return gradient;
};

export function IntradayChart({
  points,
  ema9,
  ema21,
  signals,
}: IntradayChartProps) {
  if (points.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm text-slate-400">
        Awaiting intraday prints…
      </div>
    );
  }

  const closeSeries = points.map((point) => ({
    x: point.timestamp * 1000,
    y: point.close,
  }));

  const ema9Series = ema9.map((value, idx) => ({
    x: points[idx]?.timestamp ? points[idx].timestamp * 1000 : idx,
    y: value,
  }));

  const ema21Series = ema21.map((value, idx) => ({
    x: points[idx]?.timestamp ? points[idx].timestamp * 1000 : idx,
    y: value,
  }));

  const signalMap = new Map<number, SignalMarker>();
  signals.forEach((signal) => signalMap.set(signal.timestamp, signal));

  const signalSeries = points.map((point) => {
    const marker = signalMap.get(point.timestamp);
    if (!marker) {
      return {
        x: point.timestamp * 1000,
        y: Number.NaN,
      };
    }

    return {
      x: point.timestamp * 1000,
      y: marker.price,
      marker,
    };
  });

  return (
    <Line
      datasetIdKey="intraday"
      options={{
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "nearest",
          intersect: false,
        },
        plugins: {
          legend: {
            labels: {
              color: "#E2E8F0",
              usePointStyle: true,
            },
          },
          tooltip: {
            displayColors: false,
            callbacks: {
              label(context) {
                if (context.dataset.label === "Signals") {
                  const marker = (context.raw as { marker?: SignalMarker })
                    ?.marker;
                  if (!marker) return "";
                  return `${marker.label} · ${marker.price.toFixed(2)} · ${
                    marker.confidence
                  } conviction`;
                }
                return `${context.dataset.label}: ${(
                  context.parsed.y as number
                ).toFixed(2)}`;
              },
              title(items) {
                if (items.length === 0) return "";
                const ts = items[0].parsed.x as number;
                return new Date(ts).toLocaleString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                  timeZone: "Asia/Kolkata",
                });
              },
            },
          },
        },
        scales: {
          x: {
            type: "time",
            time: {
              unit: "hour",
              displayFormats: {
                hour: "HH:mm",
              },
              tooltipFormat: "dd MMM · HH:mm",
            },
            grid: {
              color: "rgba(255,255,255,0.08)",
            },
            ticks: {
              color: "#94A3B8",
              autoSkip: true,
              maxTicksLimit: 10,
            },
          },
          y: {
            grid: {
              color: "rgba(255,255,255,0.08)",
            },
            ticks: {
              color: "#CBD5F5",
            },
          },
        },
        elements: {
          point: {
            radius: 0,
          },
        },
      }}
      data={{
        datasets: [
          {
            type: "line",
            label: "Close",
            data: closeSeries,
            parsing: false,
            tension: 0.25,
            borderColor: "#38bdf8",
            borderWidth: 2,
            pointRadius: 0,
            fill: "origin",
            backgroundColor: (context) => priceGradient(context.chart.ctx),
          },
          {
            type: "line",
            label: "EMA 9",
            data: ema9Series,
            parsing: false,
            borderColor: "#34d399",
            borderWidth: 1.5,
            borderDash: [4, 4],
            pointRadius: 0,
          },
          {
            type: "line",
            label: "EMA 21",
            data: ema21Series,
            parsing: false,
            borderColor: "#facc15",
            borderWidth: 1.5,
            borderDash: [6, 4],
            pointRadius: 0,
          },
          {
            type: "line",
            label: "Signals",
            data: signalSeries,
            parsing: false,
            showLine: false,
            pointRadius: 4,
            pointBackgroundColor: signalSeries.map((entry) =>
              entry.marker?.direction === "bullish"
                ? "rgba(16, 185, 129, 0.9)"
                : entry.marker?.direction === "bearish"
                  ? "rgba(248, 113, 113, 0.9)"
                  : "rgba(148, 163, 184, 0.6)",
            ),
            pointBorderColor: "#0b111b",
            pointHoverRadius: 6,
          },
        ],
      }}
    />
  );
}
