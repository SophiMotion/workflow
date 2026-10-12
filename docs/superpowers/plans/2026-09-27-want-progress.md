# 执行记录 — Want 招聘工作台

Plan: docs/superpowers/plans/2026-09-27-want-recruitment.md
Spec: docs/superpowers/specs/2026-09-27-want-recruitment-design.md

- 用户明确要求“实施开发”，在当前会话原址集成；不另问重复执行许可。
- 保留原址未提交的工作流与招聘数据，新增模块在 want/；原集成文件修改前副本保存在 /private/tmp/want-integration-before。
- 数据层、队列、HTTP/导出安全测试先观察缺模块失败，再实现并通过；HTTP 测试回环监听须沙盒外权限。
- Ruling: 新后台只读取原招聘 JSON，复核和评估写独立 sidecar。因此没有新增原招聘数据写入者，暂不改写原 update-review.py 或同步脚本；将来接管发送前必须统一原始数据写入协议。
- Ruling: 当前电脑工具仅有内置浏览器连接，没有 Edge 后台控制通道。保留明确能力阻碍，当前不伪造 BOSS 执行适配器；开发和验证其余已授权功能。
- Tasks 1–3: 基础行为测试通过；Task 4 页面已编写，待浏览器验证；Task 5 集成进行中；Task 6 待真实联调。

- 真实联调：三条结构岗位资料经本机 ChatGPT 登录的 Codex CLI 完成评估，批次记录保留 threadId 与 usage；未发送招聘信息。
- 实测页面：二次复核已追加；23 条结构岗位已核验发送记录已从页面导出 XLSX，消息正文绿色高亮验证通过。
- 快速筛选旧响应覆盖问题：新增异步响应乱序回归测试，观察 RED 后按请求序号修复并 GREEN。
- 后台最小 PATH 导致 Codex 找不到 Node：新增 launcher 回归测试 RED→GREEN，运行环境显式加入当前 Node 目录。

- Final review: 独立只读 reviewer（gpt-6-astra）完成；发现 7 项 Important、2 项 Minor，无 Critical。
- Final: fixed 第二个服务干扰原任务：同目录 worker 独占锁，回归测试 RED→GREEN。
- Final: fixed 有回复筛选遗漏已发送者：回复与送达维度独立，RED→GREEN；页面实际显示全部 15 条有回复记录。
- Final: fixed 未核验同名复合键合并统计：只有稳定平台身份可合并，否则按记录 ID 计数并标明口径，RED→GREEN。
- Final: fixed 暂停被旧排队快照重新启动：锁内检查 queued，RED→GREEN。
- Final: fixed 原资料更新未刷新列表和职责：sourceRevision 联动刷新，RED→GREEN。
- Final: fixed 人工复核无法发现资料更新：保存输入指纹、过期标识与筛选；保存时校验读过的资料版本，RED→GREEN。
- Final: fixed 返回工作流落入不完整静态镜像：工作流入口携带来源标记，返回原历史上下文；直接访问则提示切回原标签页，RED→GREEN。
- Final: minor (deferred): Codex 默认模型缓存尚未记录实际解析出的模型及提示词版本；默认模型变化时旧建议仍可能复用。
- Final: minor (deferred): 导出元数据尚未包含原资料与 sidecar 的快照版本；文件本身保存导出时内容，但不能按版本标识精确追溯。
- Final: Ruling: 既有招聘工具继续写原数据，Want 只读并检测变化；BOSS 后台连接和付费 API 不在本次可运行评估版本中接管，页面明确提示。代价：新简历读取与实际邀约仍依赖原流程。
- Final: Ruling: 原址项目已有大量人工未提交改动；本次仅提交新 Want 源码、测试与文档，工作流与启动器的局部集成改动保留在当前工作区，不把既有内容混入提交。代价：单独检出本次提交不含所有原址集成依赖。
- Browser validation: 桌面与 390px 窄屏（无页面横向溢出）、筛选、详情、复核、Codex 3/3 真实执行、XLSX 23 条实际下载、23 条正文绿色单元格、无公式单元格均核验；页面控制台无错误。
- Browser limitation: 内置浏览器安全策略禁止 file://，没有绕过；原始文件工作流的实机往返未验证，入口与返回逻辑由源代码及自动化测试验证。
- Data preservation: 原 recruitment-data.json、recruitment-config.json、人员沟通.xlsx 的 SHA-256 与开发前完全一致。
- Tasks 1–6: complete for the local assessment workspace; final validation `node --test tests/*.test.mjs` passed 59/59. Integration stays in the existing dirty checkout; new-module source is committed separately from preexisting work.
