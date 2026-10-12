export type LessonId = "anatomy" | "fan" | "sensors" | "flow" | "sweep" | "compare" | "report";

export type TutorialMode = "guided" | "free";

export type LessonDefinition = {
  id: LessonId;
  ordinal: number;
  title: string;
  goal: string;
  completionHint: string;
};

export const LESSONS: readonly LessonDefinition[] = [
  { id: "anatomy", ordinal: 1, title: "认识风洞", goal: "识别风洞中的五个主要模块。", completionHint: "查看 5 个风洞模块：整流段、收缩段、测试段、模型台和风扇段。" },
  { id: "fan", ordinal: 2, title: "启动虚拟风扇", goal: "观察目标功率与实际 RPM 的动态差异。", completionHint: "在 30% 功率下，让 RPM 连续稳定 2 秒。" },
  { id: "sensors", ordinal: 3, title: "读取传感器", goal: "区分 RPM、风速、压力和载荷。", completionHint: "阅读 4 张传感器说明卡，并在曲线上查看稳定段。" },
  { id: "flow", ordinal: 4, title: "观察 CFD 场", goal: "理解速度、压力、涡量与流线。", completionHint: "查看全部 4 种场变量，并答对判断题。" },
  { id: "sweep", ordinal: 5, title: "风速扫描", goal: "建立速度与动压及载荷的关系。", completionHint: "完成 30%、60% 与 90% 的稳定扫描。" },
  { id: "compare", ordinal: 6, title: "比较与解释", goal: "将 CFD 格点压差与 Pa 传感器压力分别除以同单位动压，得到无量纲 Cp 后比较；lu 与 Pa 不能直接相减。", completionHint: "选出 |ΔCp| 最大的工况，并记录二维截面、侧向泄漏或支架干扰等偏差原因。" },
  { id: "report", ordinal: 7, title: "形成报告", goal: "完成可复现的实验记录。", completionHint: "保留 3 个工况，并填写至少 12 个字符的结论。" },
];
