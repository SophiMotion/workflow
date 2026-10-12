import { LESSONS, type LessonId } from "./lessonDefinitions";
import type { SweepPower } from "../sweep/sweepRunner";

export type { LessonId, TutorialMode } from "./lessonDefinitions";

export type TutorialEvidence = {
  viewedHotspots: string[];
  stableSeconds: number;
  stableRunRevision: number | null;
  viewedSensors: string[];
  inspectedStableWindow: boolean;
  viewedFields: string[];
  flowAnswerCorrect: boolean;
  completedSweepPowers: number[];
  selectedLargestResidualPower: SweepPower | null;
  comparisonReason: string;
  reportConclusion: string;
};

export const emptyEvidence: TutorialEvidence = {
  viewedHotspots: [],
  stableSeconds: 0,
  stableRunRevision: null,
  viewedSensors: [],
  inspectedStableWindow: false,
  viewedFields: [],
  flowAnswerCorrect: false,
  completedSweepPowers: [],
  selectedLargestResidualPower: null,
  comparisonReason: "",
  reportConclusion: "",
};

const requiredHotspots = ["straightener", "contraction", "test-section", "model-stand", "fan"];
const requiredSensors = ["rpm", "wind", "pressure", "load"];
const requiredFields = ["speed", "pressure", "vorticity", "streamlines"];
const requiredSweepPowers = [30, 60, 90];

function includesAll<T>(values: readonly T[], required: readonly T[]) {
  return required.every((value) => values.includes(value));
}

function hasExactSweepPowers(powers: readonly number[]) {
  return powers.length === requiredSweepPowers.length
    && requiredSweepPowers.every((power, index) => powers[index] === power);
}

export function recordSweepCompletion(
  evidence: TutorialEvidence,
  completedSweepPowers: readonly number[],
): TutorialEvidence {
  return { ...evidence, completedSweepPowers: [...completedSweepPowers] };
}

export function recordLargestResidualSelection(
  evidence: TutorialEvidence,
  selectedPower: SweepPower,
  largestResidualPower: SweepPower,
): TutorialEvidence {
  return {
    ...evidence,
    selectedLargestResidualPower: selectedPower === largestResidualPower ? selectedPower : null,
  };
}

export function recordComparisonReason(evidence: TutorialEvidence, comparisonReason: string): TutorialEvidence {
  return { ...evidence, comparisonReason };
}

export function recordReportConclusion(evidence: TutorialEvidence, reportConclusion: string): TutorialEvidence {
  return { ...evidence, reportConclusion };
}

export function recordFlowAnswer(evidence: TutorialEvidence, correct: boolean): TutorialEvidence {
  return { ...evidence, flowAnswerCorrect: correct };
}

export function canCompleteLesson(lessonId: LessonId, evidence: TutorialEvidence): boolean {
  switch (lessonId) {
    case "anatomy":
      return includesAll(evidence.viewedHotspots, requiredHotspots);
    case "fan":
      // The controller only accrues stableSeconds while the command is 30%.
      return evidence.stableSeconds >= 2;
    case "sensors":
      return includesAll(evidence.viewedSensors, requiredSensors) && evidence.inspectedStableWindow;
    case "flow":
      return includesAll(evidence.viewedFields, requiredFields) && evidence.flowAnswerCorrect;
    case "sweep":
      return hasExactSweepPowers(evidence.completedSweepPowers);
    case "compare":
      return evidence.selectedLargestResidualPower !== null && evidence.comparisonReason.trim().length > 0;
    case "report":
      return includesAll(evidence.completedSweepPowers, requiredSweepPowers)
        && evidence.reportConclusion.trim().length >= 12;
  }
}

export function advanceLesson(activeLesson: LessonId, evidence: TutorialEvidence): LessonId {
  const activeIndex = LESSONS.findIndex((lesson) => lesson.id === activeLesson);
  if (!canCompleteLesson(activeLesson, evidence) || activeIndex < 0 || activeIndex === LESSONS.length - 1) {
    return activeLesson;
  }
  return LESSONS[activeIndex + 1]!.id;
}

export function completedLessonCount(evidence: TutorialEvidence): number {
  return LESSONS.filter((lesson) => canCompleteLesson(lesson.id, evidence)).length;
}
