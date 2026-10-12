import { LESSONS, type LessonId, type TutorialMode } from "./lessonDefinitions";
import { canCompleteLesson, completedLessonCount, type TutorialEvidence } from "./tutorialProgress";

type TutorialRailProps = {
  activeLesson: LessonId;
  evidence: TutorialEvidence;
  onAdvance(): void;
  mode?: TutorialMode;
  onLessonChange?(lesson: LessonId): void;
  onFlowAnswer?(correct: boolean): void;
};

export function TutorialRail({ activeLesson, evidence, onAdvance, mode = "guided", onLessonChange, onFlowAnswer }: TutorialRailProps) {
  const activeIndex = LESSONS.findIndex((lesson) => lesson.id === activeLesson);
  const activeDefinition = LESSONS[activeIndex] ?? LESSONS[0]!;
  const complete = canCompleteLesson(activeLesson, evidence);
  const isFinalLesson = activeIndex === LESSONS.length - 1;

  return (
    <div className="tutorial-rail-content">
      <p className="eyebrow">七章教学路径</p>
      <p>进度 {completedLessonCount(evidence)} / {LESSONS.length}</p>
      <ol>
        {LESSONS.map((lesson, index) => {
          const isComplete = canCompleteLesson(lesson.id, evidence);
          const isLocked = mode === "guided" && !isComplete && index > activeIndex;
          const isCurrent = lesson.id === activeLesson;
          return (
            <li key={lesson.id}>
              <button
                type="button"
                className={isCurrent ? "lesson-current" : isComplete ? "lesson-complete" : isLocked ? "lesson-locked" : "lesson-available"}
                aria-current={isCurrent ? "step" : undefined}
                aria-disabled={isLocked || undefined}
                onClick={() => !isLocked && onLessonChange?.(lesson.id)}
              >
                第 {lesson.ordinal} 章：{lesson.title}{isComplete ? "（已完成）" : isLocked ? "（未解锁）" : ""}
              </button>
            </li>
          );
        })}
      </ol>
      <section aria-labelledby="lesson-goal">
        <h2 id="lesson-goal">第 {activeDefinition.ordinal} 章：{activeDefinition.title}</h2>
        <p>{activeDefinition.goal}</p>
        <p>{activeDefinition.completionHint}</p>
        {activeLesson === "flow" && (
          <fieldset className="flow-question" aria-label="流场判断题">
            <legend>哪项描述符合当前教学求解器？</legend>
            <label>
              <input
                type="radio"
                name="flow-answer"
                checked={evidence.flowAnswerCorrect}
                onChange={() => onFlowAnswer?.(true)}
              />
              二维中心截面用于观察定性趋势，不代表完整三维工程 CFD
            </label>
            <label>
              <input
                type="radio"
                name="flow-answer"
                checked={false}
                onChange={() => onFlowAnswer?.(false)}
              />
              当前场可直接作为量产车辆的三维气动结论
            </label>
            {evidence.flowAnswerCorrect && <p>回答正确，二维教学场用于观察趋势。</p>}
          </fieldset>
        )}
        {!complete && <p>完成当前目标后可进入下一章。</p>}
        {!isFinalLesson && <button type="button" disabled={!complete && mode === "guided"} onClick={onAdvance}>进入下一章</button>}
        {isFinalLesson && <p>{complete ? "七章教程已完成。" : "完成本章目标即可完成教程。"}</p>}
        {mode === "free" && <p>自由实验已开启，章节限制已解除。</p>}
      </section>
    </div>
  );
}
