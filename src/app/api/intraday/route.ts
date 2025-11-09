import { NextResponse } from "next/server";

const DEFAULT_RANGE = "5d";
const DEFAULT_INTERVAL = "5m";
const ALLOWED_RANGES = new Set(["1d", "5d", "1mo"]);
const ALLOWED_INTERVALS = new Set(["1m", "5m", "15m", "30m", "60m"]);

type YahooChartResponse = {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: number[];
          close: number[];
          high: number[];
          low: number[];
          volume: number[];
        }>;
      };
    }>;
    error?: {
      code: string;
      description: string;
    };
  };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? DEFAULT_RANGE;
  const interval = searchParams.get("interval") ?? DEFAULT_INTERVAL;

  if (!ALLOWED_RANGES.has(range) || !ALLOWED_INTERVALS.has(interval)) {
    return NextResponse.json(
      { error: "Invalid range or interval requested." },
      { status: 400 },
    );
  }

  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?range=${range}&interval=${interval}&includePrePost=false&events=div%7Csplit%7Cearn`;

  try {
    const response = await fetch(yahooUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to load intraday data." },
        { status: response.status },
      );
    }

    const payload = (await response.json()) as YahooChartResponse;
    const series = payload.chart.result?.[0];

    if (!series || !series.timestamp || !series.indicators?.quote?.[0]) {
      return NextResponse.json(
        { error: "Data source returned an unexpected payload." },
        { status: 502 },
      );
    }

    const quote = series.indicators.quote[0];
    const points = series.timestamp
      .map((timestamp, idx) => {
        const close = quote.close[idx];
        const volume = quote.volume[idx];

        if (close === null || volume === null) return null;

        return {
          timestamp,
          open: quote.open[idx],
          high: quote.high[idx],
          low: quote.low[idx],
          close,
          volume,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      points,
      metadata: {
        symbol: "^NSEI",
        exchange: "NSE",
        range,
        interval,
        length: points.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unexpected error while fetching data.", detail: String(error) },
      { status: 500 },
    );
  }
}
