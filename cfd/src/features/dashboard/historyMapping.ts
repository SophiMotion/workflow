import { MAX_HISTORY } from "../experiment/labStore";
import type { TelemetryFrame } from "../experiment/model";

const HISTORY_WINDOW_MS = 60_000;

export type ChartPoint = {
  timeSeconds: number;
  rpm: number;
  windSpeedMps: number;
  pressurePa: number;
  loadN: number;
  quality: TelemetryFrame["quality"];
};

export function mapHistoryToChartData(history: readonly TelemetryFrame[]): ChartPoint[] {
  const latestTime = history.at(-1)?.simulationTimeMs ?? 0;
  const cutoff = Math.max(0, latestTime - HISTORY_WINDOW_MS);
  const inWindow = history.filter((frame) => frame.simulationTimeMs >= cutoff);
  return inWindow.slice(-MAX_HISTORY).map((frame) => ({
    timeSeconds: frame.simulationTimeMs / 1000,
    rpm: frame.rpm,
    windSpeedMps: frame.windSpeedMps,
    pressurePa: frame.underbodyPressurePa,
    loadN: frame.verticalLoadN,
    quality: frame.quality,
  }));
}
