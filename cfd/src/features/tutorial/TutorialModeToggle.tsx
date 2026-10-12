import type { TutorialMode } from "./lessonDefinitions";

type TutorialModeToggleProps = {
  mode: TutorialMode;
  onModeChange(mode: TutorialMode): void;
};

export function TutorialModeToggle({ mode, onModeChange }: TutorialModeToggleProps) {
  return (
    <div className="tutorial-mode-toggle" role="group" aria-label="教学模式">
      <button type="button" aria-pressed={mode === "guided"} onClick={() => onModeChange("guided")}>教学模式</button>
      <button type="button" aria-pressed={mode === "free"} onClick={() => onModeChange("free")}>自由实验</button>
    </div>
  );
}
