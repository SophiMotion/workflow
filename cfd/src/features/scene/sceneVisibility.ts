import type { HotspotId } from "./hotspotTypes";

export function vehicleModuleOpacities(selected: HotspotId | null) {
  if (!selected) return { stand: 1, car: 1 };
  return {
    stand: selected === "model-stand" ? 1 : 0.2,
    car: selected === "test-section" ? 1 : 0.2,
  };
}
