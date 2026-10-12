import { describe, expect, it } from "vitest";
import { experimentReducer, initialExperimentState } from "./experimentMachine";

describe("experimentMachine", () => {
  it("pauses and resumes the exact prior phase", () => {
    const running = { ...initialExperimentState, phase: "sampling" as const };
    const paused = experimentReducer(running, { type: "pause" });
    expect(paused).toMatchObject({ phase: "paused", resumePhase: "sampling" });
    expect(experimentReducer(paused, { type: "resume" }).phase).toBe("sampling");
  });

  it("reset always returns to idle", () => {
    expect(experimentReducer({ phase: "completed", resumePhase: null }, { type: "reset" }))
      .toEqual(initialExperimentState);
  });
});
