import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Core = require('../prd/prd-core.js');

const base = {
  name: '高校科研平台',
  customer: '某高校智能车辆实验室',
  owner: '王博',
  startDate: '2026-09-01',
  endDate: '2026-12-18',
  budget: 2000000,
};

test('chassis template creates a fresh project with the approved engineering structure', () => {
  const project = Core.createProject('chassis', base, '2026-09-02T08:00:00.000Z');

  assert.equal(project.type, 'chassis');
  assert.equal(project.name, '高校科研平台');
  assert.deepEqual(project.stages.map((stage) => stage.name), [
    '立项', '需求冻结', '设计评审', '采购制造', '系统集成', '测试验证', 'FAT/SAT 验收',
  ]);
  assert.deepEqual([...new Set(project.requirements.map((item) => item.domain))].sort(), [
    '嵌入式硬件', '嵌入式软件', '算法', '结构',
  ]);
  assert.ok(project.requirements.some((item) => item.title === '安全状态机'));
  assert.ok(project.acceptance.some((item) => item.title === '紧急停止与降级策略'));
  assert.ok(project.requirements.every((item) => item.target !== ''));
  assert.ok(project.requirements.some((item) => item.target === '待确认'));
});

test('simulator template creates simulator-specific requirements without sharing mutable arrays', () => {
  const first = Core.createProject('simulator', base, '2026-09-02T08:00:00.000Z');
  const second = Core.createProject('simulator', base, '2026-09-02T08:00:01.000Z');

  assert.notEqual(first.id, second.id);
  assert.ok(first.requirements.some((item) => item.title === '座舱与操纵系统'));
  assert.ok(first.acceptance.some((item) => item.title === '视景与操纵闭环测试'));
  first.requirements[0].title = '已修改';
  assert.notEqual(second.requirements[0].title, '已修改');
});

test('unsupported project type is rejected', () => {
  assert.throws(() => Core.createProject('aircraft', base), /不支持的项目类型/);
});

test('dashboard metrics are calculated from actual project records', () => {
  const project = Core.createProject('chassis', base, '2026-09-02T08:00:00.000Z');
  project.endDate = '2026-09-12';
  project.tasks = [
    { id: 't1', progress: 100, plannedEnd: '2026-09-01', status: '已完成', domain: '结构' },
    { id: 't2', progress: 50, plannedEnd: '2026-09-01', status: '进行中', domain: '嵌入式硬件' },
    { id: 't3', progress: 0, plannedEnd: '2026-09-20', status: '待开始', domain: '算法' },
  ];
  project.bom = [
    { quantity: 2, unitPrice: 400, budgetCost: 900, actualCost: 600, category: '结构' },
    { quantity: 1, unitPrice: 600, budgetCost: 600, actualCost: 400, category: '嵌入式硬件' },
  ];
  project.budget = 2000;
  project.acceptance = [
    { status: '已通过' },
    { status: '待开始' },
  ];
  project.risks = [
    { status: '开放' },
    { status: '跟踪中' },
    { status: '已关闭' },
  ];
  project.requirements = [
    { domain: '结构', progress: 100 },
    { domain: '结构', progress: 50 },
    { domain: '嵌入式硬件', progress: 40 },
  ];

  const metrics = Core.calculateMetrics(project, '2026-09-02');

  assert.equal(metrics.overallProgress, 50);
  assert.equal(metrics.bomBudget, 1500);
  assert.equal(metrics.actualCost, 1000);
  assert.equal(metrics.budgetUsage, 50);
  assert.equal(metrics.forecastBalance, 1000);
  assert.equal(metrics.remainingDays, 10);
  assert.equal(metrics.acceptanceProgress, 50);
  assert.equal(metrics.openRisks, 2);
  assert.equal(metrics.delayedTasks, 1);
  assert.deepEqual(metrics.domainProgress, {
    结构: 75,
    嵌入式硬件: 40,
    嵌入式软件: 0,
    算法: 0,
  });
});

test('metric percentages remain finite for empty projects', () => {
  const project = Core.createProject('simulator', { ...base, budget: 0 }, '2026-09-02T08:00:00.000Z');
  project.tasks = [];
  project.requirements = [];
  project.acceptance = [];
  project.bom = [];

  const metrics = Core.calculateMetrics(project, '2026-09-02');

  assert.equal(metrics.overallProgress, 0);
  assert.equal(metrics.budgetUsage, 0);
  assert.equal(metrics.acceptanceProgress, 0);
  assert.deepEqual(metrics.domainProgress, {
    结构: 0,
    嵌入式硬件: 0,
    嵌入式软件: 0,
    算法: 0,
  });
});

test('gate validation identifies missing ownership, money, acceptance, IP, and safety facts', () => {
  const project = Core.createProject('chassis', {
    ...base,
    owner: '待确认',
    budget: 0,
  }, '2026-09-02T08:00:00.000Z');
  project.ipResponsibility = '待确认';
  project.safetyResponsibility = '待确认';
  project.acceptance = [{ title: '总体验收', method: '待确认', status: '待开始' }];

  const alerts = Core.validateProject(project, '2026-09-02');
  const codes = alerts.map((alert) => alert.code).sort();

  assert.deepEqual(codes, ['acceptance', 'budget', 'dri', 'ip', 'safety']);
  assert.ok(alerts.every((alert) => ['warning', 'danger'].includes(alert.tone)));
});

test('stores normalize valid data and reject unsupported schema versions', () => {
  const project = Core.createProject('chassis', base, '2026-09-02T08:00:00.000Z');
  const valid = Core.normalizeStore({
    schemaVersion: Core.SCHEMA_VERSION,
    activeProjectId: project.id,
    projects: [project],
  });

  assert.equal(valid.projects.length, 1);
  assert.equal(valid.activeProjectId, project.id);
  assert.deepEqual(Core.normalizeStore(null), Core.createEmptyStore());
  assert.throws(
    () => Core.normalizeStore({ schemaVersion: 999, activeProjectId: '', projects: [] }),
    /不支持的数据版本/,
  );
});

test('record transitions add, update, and remove records without mutating the source project', () => {
  const project = Core.createProject('chassis', base, '2026-09-02T08:00:00.000Z');
  project.tasks = [];

  const added = Core.addRecord(project, 'tasks', {
    title: '底盘联调', progress: 10, plannedEnd: '2026-09-20',
  }, '2026-09-02T09:00:00.000Z');
  const taskId = added.tasks[0].id;
  const updated = Core.updateRecord(added, 'tasks', taskId, {
    progress: 60, status: '进行中',
  }, '2026-09-02T10:00:00.000Z');
  const removed = Core.removeRecord(updated, 'tasks', taskId, '2026-09-02T11:00:00.000Z');

  assert.equal(project.tasks.length, 0);
  assert.equal(added.tasks.length, 1);
  assert.match(taskId, /^record-/);
  assert.equal(updated.tasks[0].progress, 60);
  assert.equal(updated.tasks[0].status, '进行中');
  assert.equal(removed.tasks.length, 0);
  assert.equal(removed.updatedAt, '2026-09-02T11:00:00.000Z');
  assert.throws(() => Core.removeRecord(updated, 'tasks', 'missing'), /未找到记录/);
  assert.throws(() => Core.addRecord(project, 'contracts', {}), /不支持的数据集合/);
});

test('store transitions select projects and merge duplicate imported IDs safely', () => {
  const first = Core.createProject('chassis', { ...base, name: '项目 A' }, '2026-09-02T08:00:00.000Z');
  const second = Core.createProject('simulator', { ...base, name: '项目 B' }, '2026-09-02T08:00:01.000Z');
  const current = { schemaVersion: Core.SCHEMA_VERSION, activeProjectId: first.id, projects: [first] };
  const selected = Core.selectProject({ ...current, projects: [first, second] }, second.id);
  const duplicate = JSON.parse(JSON.stringify(first));
  duplicate.name = '项目 A 导入副本';
  const merged = Core.mergeImportedStore(current, {
    schemaVersion: Core.SCHEMA_VERSION,
    activeProjectId: duplicate.id,
    projects: [duplicate, second],
  }, '2026-09-02T12:00:00.000Z');

  assert.equal(selected.activeProjectId, second.id);
  assert.equal(current.activeProjectId, first.id);
  assert.throws(() => Core.selectProject(current, 'missing'), /未找到项目/);
  assert.equal(merged.projects.length, 3);
  assert.equal(new Set(merged.projects.map((project) => project.id)).size, 3);
  const importedDuplicate = merged.projects.find((project) => project.name === '项目 A 导入副本');
  assert.equal(importedDuplicate.id === first.id, false);
  assert.equal(merged.activeProjectId, importedDuplicate.id);
});

test('project export creates a versioned single-project backup payload', () => {
  const project = Core.createProject('simulator', { ...base, name: '导出项目' }, '2026-09-02T08:00:00.000Z');
  const payload = Core.createProjectExport(project, '2026-09-02T13:30:00.000Z');

  assert.equal(payload.schemaVersion, Core.SCHEMA_VERSION);
  assert.equal(payload.activeProjectId, project.id);
  assert.equal(payload.exportedAt, '2026-09-02T13:30:00.000Z');
  assert.equal(payload.projects.length, 1);
  assert.equal(payload.projects[0].name, '导出项目');
  project.name = '后来修改';
  assert.equal(payload.projects[0].name, '导出项目');
});
