"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { analyzeIntradayData } from "@/lib/patternDetection";
import type { AnalysisSummary, IntradayPoint } from "@/lib/types";

const IntradayChart = dynamic(
  () => import("@/components/IntradayChart").then((mod) => mod.IntradayChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-sm text-slate-400">
        Calibrating order-flow map…
      </div>
    ),
  },
);

const ranges = [
  { label: "1D", value: "1d" },
  { label: "5D", value: "5d" },
  { label: "1M", value: "1mo" },
];

const intervals = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "30m", value: "30m" },
  { label: "60m", value: "60m" },
];

function confidenceBadgeStyles(confidence: AnalysisSummary["insights"][number]["confidence"]) {
  switch (confidence) {
    case "high":
      return "bg-emerald-500/20 text-emerald-200";
    case "medium":
      return "bg-amber-500/20 text-amber-200";
    default:
      return "bg-slate-500/20 text-slate-200";
  }
}

function formatNumber(value: number, digits = 2) {
  if (Number.isNaN(value)) return "0.00";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatVolume(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1_00_00_000) return `${formatNumber(value / 1_00_00_000, 2)} Cr`;
  if (value >= 1_00_000) return `${formatNumber(value / 1_00_000, 2)} L`;
  return formatNumber(value, 0);
}

export default function Home() {
  const [range, setRange] = useState(ranges[1]?.value ?? "5d");
  const [interval, setInterval] = useState(intervals[1]?.value ?? "5m");
  const [points, setPoints] = useState<IntradayPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchIntraday() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/intraday?range=${range}&interval=${interval}`,
          {
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const detail = await response.json().catch(() => ({}));
          throw new Error(detail.error ?? "Unable to load intraday feed.");
        }

        const payload = (await response.json()) as {
          points: IntradayPoint[];
        };

        if (!controller.signal.aborted) {
          setPoints(payload.points ?? []);
          setLastUpdated(new Date());
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Unknown error.");
        setPoints([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchIntraday();

    return () => controller.abort();
  }, [interval, range, reloadTick]);

  const analysis = useMemo<AnalysisSummary>(
    () => analyzeIntradayData(points),
    [points],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
              Nifty 50 · Live Tape Intelligence
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight text-white sm:text-4xl">
              AI Trading Agent for Intraday Pattern Discovery
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Blends quantitative pattern detection with adaptive context to
              surface high-conviction zones before they expand. Tuned for
              scalpers and momentum traders tracking the Nifty 50.
            </p>
          </div>
          <div className="text-xs text-slate-400">
            {lastUpdated
              ? `Last sync ▸ ${lastUpdated.toLocaleString("en-IN", {
                  hour12: false,
                  timeZone: "Asia/Kolkata",
                })}`
              : "Awaiting first sync…"}
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-blue-500/5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Tape Map</h2>
                  <p className="text-xs text-slate-300">
                    Range: {range.toUpperCase()} · Interval:{" "}
                    {interval.toUpperCase()} · NSE Spot (^NSEI)
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="flex gap-1 rounded-full border border-white/10 bg-slate-900/70 p-1">
                    {ranges.map(({ label, value }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRange(value)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          range === value
                            ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                            : "text-slate-300 hover:bg-white/10"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1 rounded-full border border-white/10 bg-slate-900/70 p-1">
                    {intervals.map(({ label, value }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setInterval(value)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          interval === value
                            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                            : "text-slate-300 hover:bg-white/10"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 h-[420px]">
                {error ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 rounded-3xl border border-rose-400/30 bg-rose-500/10 text-sm text-rose-200">
                    <p>⚠️ {error}</p>
                    <button
                      type="button"
                      onClick={() => setReloadTick((tick) => tick + 1)}
                      className="rounded-full bg-rose-500/40 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-500/60"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <div className="relative h-full">
                    {loading && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-slate-950/70 backdrop-blur">
                        <div className="animate-pulse text-sm text-slate-300">
                          Streaming quotes…
                        </div>
                      </div>
                    )}
                    <IntradayChart
                      points={points}
                      ema9={analysis.ema9}
                      ema21={analysis.ema21}
                      signals={analysis.signals}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold text-white">
                Agent Narrative
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                {analysis.narrative}
              </p>

              <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
                <div className="rounded-2xl border border-white/5 bg-slate-900/70 p-4">
                  <p className="text-xs uppercase tracking-[0.32em] text-slate-400">
                    Session Δ
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {formatNumber(analysis.stats.sessionChangePct)}%
                  </p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-slate-900/70 p-4">
                  <p className="text-xs uppercase tracking-[0.32em] text-slate-400">
                    Day&apos;s Range
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {formatNumber(analysis.stats.rangePct)}%
                  </p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-slate-900/70 p-4">
                  <p className="text-xs uppercase tracking-[0.32em] text-slate-400">
                    Avg Volume
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {formatVolume(analysis.stats.avgVolume)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-slate-900/70 p-4">
                  <p className="text-xs uppercase tracking-[0.32em] text-slate-400">
                    High ↔ Low
                  </p>
                  <p className="mt-2 text-base font-semibold text-white">
                    {formatNumber(analysis.stats.sessionHigh)} →{" "}
                    {formatNumber(analysis.stats.sessionLow)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Pattern Radar
                </h3>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                  {analysis.signals.length} signals mapped
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {analysis.insights.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/70 p-5 text-sm text-slate-400">
                    No high-conviction patterns surfaced. As volatility expands,
                    new setups will populate automatically.
                  </div>
                ) : (
                  analysis.insights.map((insight) => (
                    <article
                      key={insight.id}
                      className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-base font-semibold text-white">
                            {insight.title}
                          </p>
                          {insight.changePct !== undefined && (
                            <p className="text-xs text-slate-400">
                              Impulse: {formatNumber(insight.changePct)}%
                            </p>
                          )}
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${confidenceBadgeStyles(insight.confidence)}`}
                        >
                          {insight.confidence.toUpperCase()}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-slate-300">
                        {insight.description}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
