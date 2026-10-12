### Task 4: Seven-Chapter Tutorial Progress and Rail

**Files:**
- Create: `src/features/tutorial/lessonDefinitions.ts`
- Create: `src/features/tutorial/tutorialProgress.ts`
- Create: `src/features/tutorial/tutorialProgress.test.ts`
- Create: `src/features/tutorial/TutorialRail.tsx`
- Create: `src/features/tutorial/TutorialRail.test.tsx`
- Create: `src/features/tutorial/TutorialModeToggle.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `RunPhase` and selected field identifiers from Tasks 2–3.
- Produces: `LessonId`, `TutorialMode`, `LESSONS`, `TutorialEvidence`, `canCompleteLesson`, `advanceLesson`, `<TutorialRail />`, and `<TutorialModeToggle />`.

- [ ] **Step 1: Write failing evidence and rail tests**

```ts
// tutorialProgress.test.ts
import { canCompleteLesson, emptyEvidence } from "./tutorialProgress";

it("requires all five physical hotspots for the anatomy lesson", () => {
  expect(canCompleteLesson("anatomy", emptyEvidence)).toBe(false);
  expect(canCompleteLesson("anatomy", {
    ...emptyEvidence,
    viewedHotspots: ["straightener", "contraction", "test-section", "model-stand", "fan"],
  })).toBe(true);
});

it("does not complete the flow lesson until every view was opened", () => {
  expect(canCompleteLesson("flow", {
    ...emptyEvidence,
    viewedFields: ["speed", "pressure", "vorticity"],
  })).toBe(false);
});

it("requires the four sensor explanations and a selected stable chart window", () => {
  expect(canCompleteLesson("sensors", {
    ...emptyEvidence,
    viewedSensors: ["rpm", "wind", "pressure", "load"],
    inspectedStableWindow: false,
  })).toBe(false);
});
```

```tsx
// TutorialRail.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { TutorialRail } from "./TutorialRail";
import { TutorialModeToggle } from "./TutorialModeToggle";
import { emptyEvidence } from "./tutorialProgress";

it("lists all seven chapters and explains why next is locked", () => {
  render(<TutorialRail activeLesson="anatomy" evidence={emptyEvidence} onAdvance={() => undefined} />);
  expect(screen.getAllByRole("listitem")).toHaveLength(7);
  expect(screen.getByRole("button", { name: "进入下一章" })).toBeDisabled();
  expect(screen.getByText(/查看 5 个风洞模块/)).toBeInTheDocument();
});

it("switches to free mode without mutating tutorial evidence", async () => {
  const user = userEvent.setup();
  const onModeChange = vi.fn();
  render(<TutorialModeToggle mode="guided" onModeChange={onModeChange} />);
  await user.click(screen.getByRole("button", { name: "自由实验" }));
  expect(onModeChange).toHaveBeenCalledWith("free");
});
```

- [ ] **Step 2: Run tests and verify red**

Run: `npm run test:run -- src/features/tutorial`

Expected: FAIL because tutorial modules do not exist.

- [ ] **Step 3: Implement exact lesson and evidence contracts**

```ts
export type LessonId = "anatomy" | "fan" | "sensors" | "flow" | "sweep" | "compare" | "report";

export type TutorialEvidence = {
  viewedHotspots: string[];
  stableSeconds: number;
  viewedSensors: string[];
  inspectedStableWindow: boolean;
  viewedFields: string[];
  flowAnswerCorrect: boolean;
  completedSweepPowers: number[];
  selectedLargestResidual: boolean;
  reportConclusion: string;
};
```

Define `TutorialMode = "guided" | "free"`. Define `LESSONS` in the exact order above with Chinese titles, one-sentence goals, completion hints, and ordinal numbers 1–7. Completion rules are: five required hotspots; 2 stable seconds at 30%; four sensor cards plus `inspectedStableWindow`; four fields plus correct answer; sweep powers exactly containing 30/60/90; residual selection; and, for the report chapter, all three completed sweep powers plus a trimmed conclusion of at least 12 characters.

`TutorialRail` renders a numbered list, progress count, goal, completion hint, and next button. Completed chapters remain selectable; future chapters display locked styling but remain readable. `TutorialModeToggle` is a topbar segmented control named `教学模式` and `自由实验`; switching to free mode lifts lesson control restrictions without clearing active lesson or evidence, and switching back restores the same tutorial position. Integrate it through `AppShell.headerActions` while the rail remains in the left region.

- [ ] **Step 4: Verify tutorial green and shell regression**

Run: `npm run test:run -- src/features/tutorial src/App.test.tsx`

Expected: tutorial tests and the original shell test PASS.

- [ ] **Step 5: Commit if repository integrity permits**

```bash
git add src/features/tutorial/lessonDefinitions.ts src/features/tutorial/tutorialProgress.ts src/features/tutorial/tutorialProgress.test.ts src/features/tutorial/TutorialRail.tsx src/features/tutorial/TutorialRail.test.tsx src/features/tutorial/TutorialModeToggle.tsx src/App.tsx
git commit -m "feat: add guided CFD curriculum"
```

---

