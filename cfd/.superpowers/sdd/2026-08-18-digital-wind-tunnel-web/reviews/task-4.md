# Task 4 审查：七章教程进度与左侧课程轨

审查范围仅限 controller 提供的 Task 4 当前变更快照；未以实现报告或测试声称代替代码证据，未重跑测试。

## Spec Compliance

- `LessonId` 的七个值及 `LESSONS` 的顺序为 `anatomy → fan → sensors → flow → sweep → compare → report`，序号为 1–7；所有标题、目标和完成提示均为中文，满足定义层面的章节规格。[lessonDefinitions.ts:1](../../../../../../src/features/tutorial/lessonDefinitions.ts#L1) [lessonDefinitions.ts:13](../../../../../../src/features/tutorial/lessonDefinitions.ts#L13)
- `TutorialEvidence` 包含规格要求的九个字段；热点、传感器、场变量、精确扫描功率、残差选择和报告结论的主要判定已实现。[tutorialProgress.ts:5](../../../../../../src/features/tutorial/tutorialProgress.ts#L5) [tutorialProgress.ts:33](../../../../../../src/features/tutorial/tutorialProgress.ts#L33) [tutorialProgress.ts:44](../../../../../../src/features/tutorial/tutorialProgress.ts#L44)
- 报告章使用三种扫描功率的包含校验及 `trim().length >= 12`，符合“保留三工况 + 去除首尾空白后至少 12 字符”的规则。[tutorialProgress.ts:55](../../../../../../src/features/tutorial/tutorialProgress.ts#L55)
- 课程轨输出七项有序列表、进度数、当前章目标和提示；锁定项保留为可读按钮，并通过 `aria-disabled` 标注；下一章按钮在教学模式且当前章未完成时禁用。[TutorialRail.tsx:18](../../../../../../src/features/tutorial/TutorialRail.tsx#L18) [TutorialRail.tsx:22](../../../../../../src/features/tutorial/TutorialRail.tsx#L22) [TutorialRail.tsx:39](../../../../../../src/features/tutorial/TutorialRail.tsx#L39) [TutorialRail.tsx:45](../../../../../../src/features/tutorial/TutorialRail.tsx#L45)
- 模式切换器使用有名称的 group 和 `aria-pressed` 的两个按钮；App 将其放在 `AppShell.headerActions`，并将课程轨放在 `left` 区域。[TutorialModeToggle.tsx:9](../../../../../../src/features/tutorial/TutorialModeToggle.tsx#L9) [App.tsx:13](../../../../../../src/App.tsx#L13) [App.tsx:14](../../../../../../src/App.tsx#L14)

## Strengths

- `advanceLesson` 对未完成当前章和最后一章均返回当前章节，正常教学模式的推进锁逻辑本身清晰。[tutorialProgress.ts:63](../../../../../../src/features/tutorial/tutorialProgress.ts#L63)
- 扫描章要求集合大小、数组长度以及 30/60/90 三值都匹配，避免重复值或额外值绕过“精确包含”规则。[tutorialProgress.ts:33](../../../../../../src/features/tutorial/tutorialProgress.ts#L33)
- 课程轨给当前项标记 `aria-current="step"`，并将锁定项的点击处理也做了运行时保护，而非只依赖视觉样式。[TutorialRail.tsx:27](../../../../../../src/features/tutorial/TutorialRail.tsx#L27) [TutorialRail.tsx:32](../../../../../../src/features/tutorial/TutorialRail.tsx#L32)

## Issues

### Critical

- **教程在实际 App 中不可完成。** `evidence` 只以 `emptyEvidence` 初始化，App 没有 `setEvidence`，也没有把任何来自风扇、传感器、CFD 场或扫描的事件写回证据；课程轨只接收这份永远不变的值。因此每个基于证据的完成规则在运行时都无法成为 true，`advanceLesson` 也始终返回当前章。这不满足“各章节证据完成规则”及与 Tasks 2–3 消费 `RunPhase`/选中场标识的接入要求。[App.tsx:5](../../../../../../src/App.tsx#L5) [App.tsx:10](../../../../../../src/App.tsx#L10) [App.tsx:14](../../../../../../src/App.tsx#L14) [tutorialProgress.ts:44](../../../../../../src/features/tutorial/tutorialProgress.ts#L44) [tutorialProgress.ts:63](../../../../../../src/features/tutorial/tutorialProgress.ts#L63)

- **自由模式显示可点击的“进入下一章”，但该按钮仍不能推进未完成章节。** Rail 在自由模式会移除按钮的 `disabled`，但 App 的回调无条件调用受证据保护的 `advanceLesson`；该函数在证据不足时返回原章节。故自由模式表面上解除限制，实际下一章控制仍被锁住，违反“切换到自由模式 lifts lesson control restrictions”。[TutorialRail.tsx:45](../../../../../../src/features/tutorial/TutorialRail.tsx#L45) [App.tsx:14](../../../../../../src/App.tsx#L14) [tutorialProgress.ts:65](../../../../../../src/features/tutorial/tutorialProgress.ts#L65)

### Important

- **风扇章节无法验证“在 30% 功率下”这一完成前提。** 证据类型只保存无来源的 `stableSeconds`，判定也仅检查 `>= 2`；任意功率、甚至非风扇控制器写入的两秒都能通过。文件中的注释称由 controller 保证，但当前快照没有 `RunPhase`、功率或 controller 接入来建立这一不变量，因此这不是代码层面的完成规则。[tutorialProgress.ts:7](../../../../../../src/features/tutorial/tutorialProgress.ts#L7) [tutorialProgress.ts:40](../../../../../../src/features/tutorial/tutorialProgress.ts#L40) [tutorialProgress.ts:42](../../../../../../src/features/tutorial/tutorialProgress.ts#L42)

- **从自由模式跳到后续章再切回教学模式时，状态语义会错误。** 锁定只针对 `index > activeIndex`；所有位于当前章之前但尚未完成的章节会落到 `lesson-current` CSS 类，尽管它们既非当前也非已完成。这不满足课程轨对当前、完成、锁定三类状态的可靠呈现，且会误导视觉状态和辅助技术用户。[TutorialRail.tsx:25](../../../../../../src/features/tutorial/TutorialRail.tsx#L25) [TutorialRail.tsx:28](../../../../../../src/features/tutorial/TutorialRail.tsx#L28) [TutorialRail.tsx:32](../../../../../../src/features/tutorial/TutorialRail.tsx#L32)

### Minor

- 无。

## Assessment

定义、基础判定和静态课程轨结构大体符合规格，但两项 Critical 问题使引导路径无法在 App 内完成、自由模式的下一章操作失效；另有风扇 30% 条件未被证据模型强制。结论：**不通过，需先修复 Critical 问题后再验收。**

---

# Fix round 1 范围复审

本轮仅复核 controller 指定的两项 finding；跨任务 evidence 写回和 30% producer 已裁定后置，不作为本轮 finding。

## 1. 自由模式“进入下一章”未解除 evidence 锁 — ADDRESSED

App 的推进回调现在按模式分支：教学模式保留 `advanceLesson` 的证据锁；自由模式从 `LESSONS` 计算下一个索引而不读取 evidence。课程轨在自由模式仍会解除按钮禁用，因此点击能实际推进。回归测试覆盖无 evidence 的自由模式从第一章推进到第二章，并确认切回教学模式后仍停在选定章节。[App.tsx:20](../../../../../../src/App.tsx#L20) [App.tsx:21](../../../../../../src/App.tsx#L21) [App.tsx:22](../../../../../../src/App.tsx#L22) [TutorialRail.tsx:45](../../../../../../src/features/tutorial/TutorialRail.tsx#L45) [App.test.tsx:21](../../../../../../src/App.test.tsx#L21)

## 2. 自由模式跳后切 guided 时，前序未完成章节被标成 current — ADDRESSED

章节 CSS 状态现以 `isCurrent` 为首要条件；非当前、非完成、非锁定项统一为 `lesson-available`。因此 `activeLesson="flow"` 时，第一章为 `lesson-available`，仅第四章为 `lesson-current`，后续未完成章节在教学模式保持 `aria-disabled`。测试直接覆盖该状态组合。[TutorialRail.tsx:25](../../../../../../src/features/tutorial/TutorialRail.tsx#L25) [TutorialRail.tsx:31](../../../../../../src/features/tutorial/TutorialRail.tsx#L31) [TutorialRail.tsx:32](../../../../../../src/features/tutorial/TutorialRail.tsx#L32) [TutorialRail.test.tsx:21](../../../../../../src/features/tutorial/TutorialRail.test.tsx#L21)

## New Breakage

- 未发现。本轮变更保留教学模式的 evidence 锁；自由模式仅改变推进策略，且最后一章索引被限制在课程数组边界内。[App.tsx:20](../../../../../../src/App.tsx#L20) [App.tsx:23](../../../../../../src/App.tsx#L23)

## Out-of-Scope

- App 内 evidence 的生产者/写回与风扇 30% 稳定时间的来源验证，按 controller 裁定后置至 Tasks 7–9/11，本轮不评价。

## Verdict

**PASS（限本轮两个 finding）。** 两项指定问题均已由当前修复快照的代码和针对性测试覆盖解决。
