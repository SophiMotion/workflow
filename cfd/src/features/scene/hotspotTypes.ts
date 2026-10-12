export const HOTSPOT_IDS = ["straightener", "contraction", "test-section", "model-stand", "fan"] as const;

export type HotspotId = typeof HOTSPOT_IDS[number];
