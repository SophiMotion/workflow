import {
  canCompleteLesson,
  emptyEvidence,
  recordComparisonReason,
  recordLargestResidualSelection,
  recordReportConclusion,
  recordSweepCompletion,
} from "./tutorialProgress";

describe("教程完成证据", () => {
  it("requires all five physical hotspots for the anatomy lesson", () => {
    expect(canCompleteLesson("anatomy", emptyEvidence)).toBe(false);
    expect(canCompleteLesson("anatomy", {
      ...emptyEvidence,
      viewedHotspots: ["straightener", "contraction", "test-section", "model-stand", "fan"],
    })).toBe(true);
  });

  it("requires two credited stable seconds for the fan lesson", () => {
    expect(canCompleteLesson("fan", { ...emptyEvidence, stableSeconds: 1.99 })).toBe(false);
    expect(canCompleteLesson("fan", { ...emptyEvidence, stableSeconds: 2 })).toBe(true);
  });

  it("does not complete the sensors lesson without a stable chart window", () => {
    expect(canCompleteLesson("sensors", {
      ...emptyEvidence,
      viewedSensors: ["rpm", "wind", "pressure", "load"],
      inspectedStableWindow: false,
    })).toBe(false);
  });

  it("does not complete the flow lesson until every view was opened", () => {
    expect(canCompleteLesson("flow", {
      ...emptyEvidence,
      viewedFields: ["speed", "pressure", "vorticity"],
      flowAnswerCorrect: true,
    })).toBe(false);
  });

  it("requires every prescribed sweep power before report completion", () => {
    expect(canCompleteLesson("report", {
      ...emptyEvidence,
      completedSweepPowers: [30, 60, 90],
      reportConclusion: "这是足够长度的实验结论。",
    })).toBe(true);
    expect(canCompleteLesson("report", {
      ...emptyEvidence,
      completedSweepPowers: [30, 60],
      reportConclusion: "这是足够长度的实验结论。",
    })).toBe(false);
  });

  it("requires the prescribed sweep order and records comparison/report evidence", () => {
    expect(canCompleteLesson("sweep", { ...emptyEvidence, completedSweepPowers: [90, 60, 30] })).toBe(false);
    const swept = recordSweepCompletion(emptyEvidence, [30, 60, 90]);
    const compared = recordLargestResidualSelection(swept, 90, 90);
    expect(canCompleteLesson("compare", compared)).toBe(false);
    const explained = recordComparisonReason(compared, "二维截面忽略了真实三维泄漏与支架干扰");
    const reported = recordReportConclusion(explained, "这是足够长度的实验结论。");

    expect(canCompleteLesson("sweep", reported)).toBe(true);
    expect(canCompleteLesson("compare", reported)).toBe(true);
    expect(canCompleteLesson("report", reported)).toBe(true);
    expect(reported.selectedLargestResidualPower).toBe(90);
    expect(reported.comparisonReason).toContain("三维泄漏");
    expect(recordLargestResidualSelection(swept, 60, 90).selectedLargestResidualPower).toBeNull();
  });
});
