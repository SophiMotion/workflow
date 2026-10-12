import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { labStore } from "../experiment/labStore";
import { mapHistoryToChartData, type ChartPoint } from "./historyMapping";

type SeriesKey = "rpm" | "windSpeedMps" | "pressurePa" | "loadN";

const SERIES: readonly { key: SeriesKey; label: string; color: string }[] = [
  { key: "windSpeedMps", label: "风速 m/s", color: "#34a853" },
  { key: "rpm", label: "转速 RPM", color: "#002FA7" },
  { key: "pressurePa", label: "压力 Pa", color: "#fbbc04" },
  { key: "loadN", label: "载荷 N", color: "#ea4335" },
];

type HistoryChartProps = {
  onInspectStableWindow(): void;
  refreshHz?: number;
};

export function HistoryChart({ onInspectStableWindow, refreshHz = 10 }: HistoryChartProps) {
  const [history, setHistory] = useState(() => labStore.getState().history);
  useEffect(() => {
    let latestHistory = labStore.getState().history;
    const unsubscribe = labStore.subscribe((state) => { latestHistory = state.history; });
    const intervalMs = 1_000 / Math.max(1, refreshHz);
    const timer = setInterval(() => {
      setHistory((current) => current === latestHistory ? current : latestHistory);
    }, intervalMs);
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [refreshHz]);
  const data = useMemo(() => mapHistoryToChartData(history), [history]);
  const stableWindow = useMemo(() => findStableWindow(data), [data]);
  const [hiddenSeries, setHiddenSeries] = useState<ReadonlySet<SeriesKey>>(() => new Set());

  const toggleSeries = (key: SeriesKey) => {
    setHiddenSeries((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="history-panel">
      <div className="history-heading">
        <div>
          <p className="section-kicker">60 SECOND HISTORY</p>
          <h2 id="history-title">实验曲线</h2>
        </div>
        <div className="chart-legend" aria-label="曲线显示选项">
          {SERIES.map((series) => (
            <button
              type="button"
              key={series.key}
              aria-pressed={!hiddenSeries.has(series.key)}
              onClick={() => toggleSeries(series.key)}
            >
              <span style={{ backgroundColor: series.color }} aria-hidden="true" />{series.label}
            </button>
          ))}
        </div>
      </div>

      <div className="history-chart-plot" aria-label="最近 60 秒遥测曲线">
        {data.length === 0 && <p className="chart-empty">启动实验后将在此显示最近 60 秒数据。</p>}
        {data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 800, height: 140 }}>
            <LineChart data={data} margin={{ top: 10, right: 4, bottom: 2, left: 4 }}>
              <CartesianGrid stroke="#dadce0" vertical={false} />
              <XAxis dataKey="timeSeconds" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(value) => `${Number(value).toFixed(0)}s`} stroke="#5f6368" />
              <YAxis yAxisId="velocity" orientation="left" stroke="#34a853" width={38} tickCount={3} fontSize={9} tickMargin={2} label={{ value: "m/s", angle: -90, position: "insideLeft", fill: "#34a853", fontSize: 9 }} />
              <YAxis yAxisId="rpm" orientation="left" stroke="#002FA7" width={38} tickCount={3} fontSize={9} tickMargin={2} label={{ value: "RPM", angle: -90, position: "insideLeft", fill: "#002FA7", fontSize: 9 }} />
              <YAxis yAxisId="pressure" orientation="right" stroke="#fbbc04" width={38} tickCount={3} fontSize={9} tickMargin={2} label={{ value: "Pa", angle: 90, position: "insideRight", fill: "#fbbc04", fontSize: 9 }} />
              <YAxis yAxisId="load" orientation="right" stroke="#ea4335" width={38} tickCount={3} fontSize={9} tickMargin={2} label={{ value: "N", angle: 90, position: "insideRight", fill: "#ea4335", fontSize: 9 }} />
              <Tooltip labelFormatter={(value) => `T+${Number(value).toFixed(2)} s`} />
              {stableWindow && (
                <ReferenceArea
                  x1={stableWindow.start}
                  x2={stableWindow.end}
                  yAxisId="velocity"
                  fill="#34a853"
                  fillOpacity={0.08}
                  strokeOpacity={0}
                />
              )}
              <Line yAxisId="velocity" dataKey="windSpeedMps" name="风速 m/s" stroke="#34a853" dot={false} isAnimationActive={false} hide={hiddenSeries.has("windSpeedMps")} />
              <Line yAxisId="rpm" dataKey="rpm" name="转速 RPM" stroke="#002FA7" dot={false} isAnimationActive={false} hide={hiddenSeries.has("rpm")} />
              <Line yAxisId="pressure" dataKey="pressurePa" name="压力 Pa" stroke="#fbbc04" dot={false} isAnimationActive={false} hide={hiddenSeries.has("pressurePa")} />
              <Line yAxisId="load" dataKey="loadN" name="载荷 N" stroke="#ea4335" dot={false} isAnimationActive={false} hide={hiddenSeries.has("loadN")} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      {stableWindow && (
        <button type="button" className="stable-window-marker" aria-label="标记稳定窗口" onClick={onInspectStableWindow}>
          标记稳定窗口
          <span>{stableWindow.start.toFixed(2)}–{stableWindow.end.toFixed(2)} s</span>
        </button>
      )}
    </div>
  );
}

function findStableWindow(data: readonly ChartPoint[]): { start: number; end: number } | null {
  let bestStart = -1;
  let bestEnd = -1;
  let currentStart = -1;

  data.forEach((point, index) => {
    if (point.quality === "stable") {
      if (currentStart < 0) currentStart = index;
      if (bestStart < 0 || index - currentStart > bestEnd - bestStart) {
        bestStart = currentStart;
        bestEnd = index;
      }
    } else {
      currentStart = -1;
    }
  });

  if (bestStart < 0 || bestEnd <= bestStart) return null;
  const start = data[bestStart]!.timeSeconds;
  const end = data[bestEnd]!.timeSeconds;
  return end > start ? { start, end } : null;
}
