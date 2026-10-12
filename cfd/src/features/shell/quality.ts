export type QualityProfile = {
  name: "reduced" | "low" | "medium" | "high";
  grid: readonly [number, number];
  particleCount: number;
  chartRefreshHz: number;
};

export type QualitySelectionInput = {
  viewportWidth: number;
  hardwareConcurrency: number;
  reducedMotion: boolean;
};

const PROFILES = {
  reduced: { name: "reduced", grid: [160, 64], particleCount: 0, chartRefreshHz: 5 },
  low: { name: "low", grid: [160, 64], particleCount: 300, chartRefreshHz: 5 },
  medium: { name: "medium", grid: [240, 96], particleCount: 900, chartRefreshHz: 10 },
  high: { name: "high", grid: [320, 128], particleCount: 1_400, chartRefreshHz: 10 },
} as const satisfies Record<QualityProfile["name"], QualityProfile>;

const SLOW_FRAME_MS = 41.7;
const SLOW_WINDOW_MS = 3_000;

export function selectQualityProfile({
  viewportWidth,
  hardwareConcurrency,
  reducedMotion,
}: QualitySelectionInput): QualityProfile {
  if (reducedMotion) return PROFILES.reduced;
  if (viewportWidth < 600 || hardwareConcurrency <= 4) return PROFILES.low;
  if (viewportWidth >= 1_200 && hardwareConcurrency >= 8) return PROFILES.high;
  return PROFILES.medium;
}

export function qualityProfile(name: QualityProfile["name"]): QualityProfile {
  return PROFILES[name];
}

export class AdaptiveQualityController {
  private profileName: QualityProfile["name"];
  private frameDurations: number[] = [];
  private elapsedMs = 0;

  constructor(
    initialProfile: QualityProfile["name"],
    private onChange: (profile: QualityProfile) => void,
  ) {
    this.profileName = initialProfile;
  }

  setOnChange(onChange: (profile: QualityProfile) => void): void {
    this.onChange = onChange;
  }

  setProfile(profileName: QualityProfile["name"]): void {
    this.profileName = profileName;
    this.clearWindow();
  }

  recordFrame(durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs <= 0 || this.profileName === "low" || this.profileName === "reduced") {
      return;
    }

    this.frameDurations.push(durationMs);
    this.elapsedMs += durationMs;
    if (this.elapsedMs < SLOW_WINDOW_MS) return;

    const averageMs = this.elapsedMs / this.frameDurations.length;
    if (averageMs > SLOW_FRAME_MS) {
      this.profileName = this.profileName === "high" ? "medium" : "low";
      const nextProfile = PROFILES[this.profileName];
      this.clearWindow();
      this.onChange(nextProfile);
      return;
    }

    while (this.elapsedMs >= SLOW_WINDOW_MS && this.frameDurations.length > 1) {
      this.elapsedMs -= this.frameDurations.shift()!;
    }
  }

  private clearWindow(): void {
    this.frameDurations = [];
    this.elapsedMs = 0;
  }
}
