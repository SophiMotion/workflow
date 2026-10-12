# Task 4 报告：七章教程进度与左侧课程轨

## 实现

- 新增七章定义（顺序固定为 anatomy、fan、sensors、flow、sweep、compare、report），提供章节序号、中文标题、单句目标与完成提示。
- 新增教程证据契约、完成判定、已完成章节计数及受完成条件保护的 `advanceLesson`。
- 左侧课程轨展示编号章节、完成进度、当前目标、完成提示与下一章按钮；完成章节可访问，后续章节保留可读的锁定状态。
- 新增可访问的顶部 `教学模式` / `自由实验` 分段控制；App 在模式切换时保留当前章节和证据，并通过 `AppShell.headerActions` 接入。

## TDD 记录

### RED

先创建教程进度与课程轨测试，再运行：

```text
npm run test:run -- src/features/tutorial
```

结果：2 个 suite 因 `./tutorialProgress` 与 `./TutorialRail` 不存在而失败，确认测试针对缺失功能。

### GREEN

实现最小的教程定义、证据判定、课程轨和模式切换组件后，教程与 AppShell 回归测试通过。

## 验证

| 命令 | 结果 |
| --- | --- |
| `npm run test:run -- src/features/tutorial src/App.test.tsx` | 3 files / 10 tests passed |
| `npm run test:run` | 8 files / 25 tests passed |
| `npm run build` | passed (`tsc --noEmit` + Vite production build) |
| `npm run lint` | passed |

`git diff --check` 与 `git status --short` 未能运行：仓库现存对象 `44ebbf0e1dece2bafdf27b1bf4808cafe75cf365` 无法读取，符合 preflight 已记录的 Git 完整性问题；未执行暂存、提交或分支操作。

## 文件

- `src/App.tsx`
- `src/features/tutorial/lessonDefinitions.ts`
- `src/features/tutorial/tutorialProgress.ts`
- `src/features/tutorial/tutorialProgress.test.ts`
- `src/features/tutorial/TutorialRail.tsx`
- `src/features/tutorial/TutorialRail.test.tsx`
- `src/features/tutorial/TutorialModeToggle.tsx`

## 自审

- [x] 七章顺序与设计规范一致，标题、目标、提示均为中文。
- [x] 所有指定证据字段、完成条件和结论最小长度均已覆盖。
- [x] 课程轨具有列表、状态文字、`aria-current`、`aria-disabled` 和原生禁用的下一章按钮。
- [x] 自由模式仅改变限制，不清空教程位置或证据。
- [x] 没有修改任务外的产品文件；报告为任务要求的交付物。

## Fix round 1/5：自由模式推进与章节状态

### RED

新增两项行为测试后执行：

```text
npm run test:run -- src/features/tutorial/TutorialRail.test.tsx src/App.test.tsx
```

结果：2 项失败。自由模式中的下一章按钮仍调用受 evidence 保护的 `advanceLesson`，所以停在第 1 章；当 active lesson 位于第 4 章时，前面未完成章节错误使用 `lesson-current` 而非可访问的 `lesson-available`。

### GREEN

- `App` 在自由模式中按定义顺序推进，不读取完成证据；教学模式继续调用受证据保护的 `advanceLesson`。两种模式切换均不改变 evidence 或 active lesson。
- 课程轨状态优先级改为 current、complete、locked、available：仅活动项获得 `lesson-current` / `aria-current`，已完成项为 complete，教学模式的未来章节为 locked（`aria-disabled`），其他可选章节为 available。

### 验证

| 命令 | 结果 |
| --- | --- |
| `npm run test:run -- src/features/tutorial/TutorialRail.test.tsx src/App.test.tsx` | 2 files / 7 tests passed |
| `npm run test:run` | 8 files / 27 tests passed |
| `npm run build` | passed |
| `npm run lint` | passed |

### 本轮文件

- `src/App.tsx`
- `src/App.test.tsx`
- `src/features/tutorial/TutorialRail.tsx`
- `src/features/tutorial/TutorialRail.test.tsx`
- 本报告
