import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Core = require('../prd/prd-core.js');
const App = require('../prd/prd-app.js');

function fixture() {
  const project = Core.createProject('chassis', {
    name: '测试线控底盘', customer: '测试高校', owner: '测试负责人',
    startDate: '2026-09-01', endDate: '2026-11-08', budget: 100000,
  }, '2026-09-01T00:00:00.000Z');
  project.currentStage = '系统集成';
  project.ipResponsibility = '已明确';
  project.safetyResponsibility = '已明确';
  project.tasks = [
    { id: 't1', title: '驱动控制联调', stage: '系统集成', owner: '陈敏', plannedStart: '2026-09-01', plannedEnd: '2026-09-10', progress: 60, status: '进行中', domain: '嵌入式软件', dependency: '' },
  ];
  project.team = [{ id: 'm1', name: '陈敏', role: '软件工程师', domain: '嵌入式软件', responsibility: '通信与安全状态机', plannedHours: 80, actualHours: 42, status: '参与中' }];
  project.bom = [{ id: 'b1', code: 'CT-01', name: '线控控制器', specification: 'CAN FD', category: '嵌入式硬件', quantity: 1, unit: '套', unitPrice: 30000, budgetCost: 32000, actualCost: 30000, supplier: '待确认', procurementStatus: '采购中' }];
  project.risks = [{ id: 'r1', title: '联调延期', category: '进度', probability: '中', impact: '高', level: '高', owner: '陈敏', mitigation: '增加联调窗口', dueDate: '2026-09-12', status: '开放' }];
  project.changes = [{ id: 'c1', title: '增加远程接管', reason: '新增场景', scopeImpact: '接口增加', timeImpact: '3 天', budgetImpact: 5000, applicant: '测试负责人', approvalStatus: '评估中', decision: '待确认' }];
  return project;
}

test('overview renders operational KPIs, stage rail, alerts, and edit action', () => {
  const html = App.renderView('overview', fixture(), '2026-09-02');
  assert.match(html, /测试线控底盘/);
  assert.match(html, /class="kpi-strip"/);
  assert.match(html, /总体进度/);
  assert.match(html, /class="stage-rail"/);
  assert.match(html, /FAT\/SAT 验收/);
  assert.match(html, /data-action="edit-project"/);
});

test('every management view exposes its real table and creation workflow', () => {
  const project = fixture();
  const expectations = [
    ['requirements', '需求参数', 'requirements'],
    ['team', '团队资源', 'team'],
    ['bom', 'BOM 与预算', 'bom'],
    ['acceptance', '交付验收', 'acceptance'],
  ];
  for (const [view, heading, collection] of expectations) {
    const html = App.renderView(view, project, '2026-09-02');
    assert.match(html, new RegExp(heading));
    assert.match(html, /class="data-table"/);
    assert.ok(html.includes(`data-action="add-record" data-collection="${collection}"`));
  }
});

test('gantt renders task rows, time axis, status bar, and task editor action', () => {
  const html = App.renderView('gantt', fixture(), '2026-09-02');
  assert.match(html, /甘特计划/);
  assert.match(html, /class="gantt-grid"/);
  assert.match(html, /驱动控制联调/);
  assert.match(html, /class="task-bar active"/);
  assert.match(html, /data-action="edit-record" data-collection="tasks"/);
  assert.match(html, /data-action="add-record" data-collection="tasks"/);
});

test('risk view keeps risk and change registers in one project surface', () => {
  const html = App.renderView('risks', fixture(), '2026-09-02');
  assert.match(html, /风险与变更/);
  assert.match(html, /风险台账/);
  assert.match(html, /变更记录/);
  assert.match(html, /联调延期/);
  assert.match(html, /增加远程接管/);
  assert.match(html, /data-collection="risks"/);
  assert.match(html, /data-collection="changes"/);
});

test('unknown views fall back to overview', () => {
  const html = App.renderView('not-a-view', fixture(), '2026-09-02');
  assert.match(html, /总体进度/);
});
