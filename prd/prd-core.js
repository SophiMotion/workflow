(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PrdCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA_VERSION = 1;
  const STAGE_NAMES = ['立项', '需求冻结', '设计评审', '采购制造', '系统集成', '测试验证', 'FAT/SAT 验收'];
  const DOMAINS = ['结构', '嵌入式硬件', '嵌入式软件', '算法'];
  const COLLECTIONS = ['requirements', 'tasks', 'team', 'bom', 'acceptance', 'risks', 'changes'];
  let sequence = 0;

  function uid(prefix, now) {
    sequence += 1;
    const stamp = new Date(now || Date.now()).getTime().toString(36);
    return `${prefix}-${stamp}-${sequence.toString(36)}`;
  }

  function item(title, domain, extra) {
    return Object.assign({
      id: '', title, domain, description: '待确认', target: '待确认', unit: '',
      priority: 'P1', owner: '待确认', maturity: '规划', status: '待确认',
      progress: 0, acceptanceMethod: '待确认', acceptanceId: '', evidence: 'P', notes: '',
    }, extra || {});
  }

  const TEMPLATES = Object.freeze({
    chassis: Object.freeze({
      label: '线控底盘',
      requirements: [
        item('车架与结构包络', '结构', { description: '定义轴距、轮距、离地间隙、载荷与接口包络。' }),
        item('悬架与轮系', '结构', { description: '确认悬架形式、轮胎规格、转弯半径和通过性要求。' }),
        item('电池与电源系统', '嵌入式硬件', { description: '定义电池容量、供电接口、保护和续航目标。' }),
        item('线控执行器与控制器', '嵌入式硬件', { description: '定义转向、驱动、制动执行器及控制器接口。' }),
        item('CAN 与时间同步', '嵌入式软件', { description: '定义 CAN/CAN FD、消息周期、时间戳和日志规范。' }),
        item('安全状态机', '嵌入式软件', { description: '覆盖急停、限速、失联、过流、过温和低电量降级。', maturity: '在研' }),
        item('车辆运动控制', '算法', { description: '定义纵向、横向控制目标和响应指标。' }),
        item('状态估计与故障检测', '算法', { description: '定义状态观测、故障码和异常恢复策略。' }),
      ],
      acceptance: [
        { title: '结构与载荷检查', metric: '满足载荷、尺寸和接口包络要求', method: '尺寸测量与静载测试' },
        { title: '线控响应测试', metric: '转向、驱动、制动响应满足冻结指标', method: '台架与场地测试' },
        { title: '紧急停止与降级策略', metric: '急停、失联、低电量进入安全状态', method: '故障注入测试' },
        { title: '通信与数据记录', metric: '协议、时间戳、日志和恢复满足要求', method: '日志审查与丢包测试' },
        { title: 'FAT/SAT 总体验收', metric: '完成约定场景和交付物检查', method: '验收脚本与客户签署' },
      ],
    }),
    simulator: Object.freeze({
      label: '驾驶模拟器',
      requirements: [
        item('座舱与操纵系统', '结构', { description: '定义座舱框架、座椅、方向盘、踏板和人机尺寸。' }),
        item('运动平台与安全结构', '结构', { description: '定义自由度、行程、载荷、限位和急停结构。' }),
        item('采集与执行硬件', '嵌入式硬件', { description: '定义操纵采集、执行器、控制柜与供电接口。' }),
        item('视景与计算平台', '嵌入式硬件', { description: '定义显示、主机、渲染和外设配置。' }),
        item('设备通信与同步', '嵌入式软件', { description: '定义操纵、视景、运动和数据系统的通信与同步。' }),
        item('实验数据记录', '嵌入式软件', { description: '定义变量字典、采样率、时间戳和导出格式。' }),
        item('车辆动力学模型', '算法', { description: '定义车辆模型、路面环境和参数标定范围。' }),
        item('运动提示算法', '算法', { description: '定义运动洗出、限制策略和主观评价方法。' }),
      ],
      acceptance: [
        { title: '座舱与操纵检查', metric: '结构、安全和操纵接口满足冻结要求', method: '尺寸、功能和安全检查' },
        { title: '视景与操纵闭环测试', metric: '操纵输入、车辆模型和视景输出闭环正常', method: '标准场景脚本' },
        { title: '运动平台安全测试', metric: '限位、急停和故障降级有效', method: '故障注入测试' },
        { title: '实验数据完整性', metric: '变量、采样率、同步和导出满足要求', method: '数据审查' },
        { title: 'FAT/SAT 总体验收', metric: '完成约定实验场景和交付物检查', method: '验收脚本与客户签署' },
      ],
    }),
  });

  function isoDate(value, fallback) {
    const text = String(value || '');
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createProject(type, input, now) {
    const template = TEMPLATES[type];
    if (!template) throw new Error(`不支持的项目类型：${type}`);
    const values = input || {};
    const instant = new Date(now || Date.now());
    const createdAt = instant.toISOString();
    const startDate = isoDate(values.startDate, createdAt.slice(0, 10));
    const endDate = isoDate(values.endDate, startDate);
    const projectId = uid('project', instant);
    const requirements = clone(template.requirements).map((record) => Object.assign(record, {
      id: uid('req', instant),
    }));
    const acceptance = clone(template.acceptance).map((record, index) => ({
      id: uid('accept', instant),
      title: record.title,
      milestone: index === template.acceptance.length - 1 ? 'FAT/SAT 验收' : '测试验证',
      deliverable: '待确认',
      metric: record.metric,
      method: record.method,
      owner: '待确认',
      plannedDate: endDate,
      actualDate: '',
      evidence: '待确认',
      evidencePath: '',
      status: '待开始',
      customerConfirmed: false,
    }));
    const stages = STAGE_NAMES.map((name, index) => ({
      id: uid('stage', instant), name, status: index === 0 ? '进行中' : '待开始',
      plannedDate: index === 0 ? startDate : '', actualDate: '',
    }));

    return {
      id: projectId,
      name: String(values.name || `${template.label}项目`),
      customer: String(values.customer || '待确认'),
      type,
      typeLabel: template.label,
      owner: String(values.owner || '待确认'),
      priority: String(values.priority || 'P1'),
      status: '进行中',
      currentStage: '立项',
      startDate,
      endDate,
      actualStartDate: '',
      actualEndDate: '',
      description: String(values.description || '待确认'),
      budget: Number(values.budget) || 0,
      ipResponsibility: '待确认',
      dataResponsibility: '待确认',
      safetyResponsibility: '待确认',
      createdAt,
      updatedAt: createdAt,
      stages,
      requirements,
      tasks: [],
      team: [],
      bom: [],
      acceptance,
      risks: [],
      changes: [],
    };
  }

  function number(value) {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
  }

  function percent(value) {
    return Math.max(0, Math.min(100, Math.round(number(value))));
  }

  function average(records, key) {
    if (!records.length) return 0;
    return Math.round(records.reduce((sum, record) => sum + percent(record[key]), 0) / records.length);
  }

  function utcDay(value) {
    const text = String(value || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    const [year, month, day] = text.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  }

  function calculateMetrics(project, today) {
    const source = project || {};
    const tasks = Array.isArray(source.tasks) ? source.tasks : [];
    const bom = Array.isArray(source.bom) ? source.bom : [];
    const acceptance = Array.isArray(source.acceptance) ? source.acceptance : [];
    const risks = Array.isArray(source.risks) ? source.risks : [];
    const requirements = Array.isArray(source.requirements) ? source.requirements : [];
    const actualCost = bom.reduce((sum, record) => sum + number(record.actualCost), 0);
    const bomBudget = bom.reduce((sum, record) => sum + number(record.budgetCost), 0);
    const budget = number(source.budget);
    const currentDay = utcDay(today) || utcDay(new Date().toISOString().slice(0, 10));
    const endDay = utcDay(source.endDate);
    const domainProgress = {};
    DOMAINS.forEach((domain) => {
      domainProgress[domain] = average(requirements.filter((item) => item.domain === domain), 'progress');
    });

    return {
      overallProgress: average(tasks, 'progress'),
      bomBudget,
      actualCost,
      budgetUsage: budget > 0 ? percent((actualCost / budget) * 100) : 0,
      forecastBalance: budget - actualCost,
      remainingDays: endDay == null || currentDay == null ? 0 : Math.max(0, Math.ceil((endDay - currentDay) / 86400000)),
      acceptanceProgress: acceptance.length
        ? Math.round((acceptance.filter((item) => item.status === '已通过').length / acceptance.length) * 100)
        : 0,
      openRisks: risks.filter((item) => !['已关闭', '关闭'].includes(item.status)).length,
      delayedTasks: tasks.filter((task) => {
        const plannedEnd = utcDay(task.plannedEnd);
        return plannedEnd != null && currentDay != null && plannedEnd < currentDay && percent(task.progress) < 100;
      }).length,
      domainProgress,
    };
  }

  function validateProject(project, today) {
    const source = project || {};
    const alerts = [];
    const add = (code, tone, title, detail) => alerts.push({ code, tone, title, detail });
    if (!source.owner || source.owner === '待确认') add('dri', 'danger', '负责人待确认', '项目必须指定唯一 DRI。');
    if (number(source.budget) <= 0) add('budget', 'danger', '预算待确认', '进入执行前需要明确项目预算。');
    const acceptance = Array.isArray(source.acceptance) ? source.acceptance : [];
    if (!acceptance.length || acceptance.some((item) => !item.method || item.method === '待确认')) {
      add('acceptance', 'warning', '验收标准不完整', '至少一个验收项尚未定义方法。');
    }
    if (!source.ipResponsibility || source.ipResponsibility === '待确认') add('ip', 'warning', '知识产权责任待确认', '补充成果和背景知识产权边界。');
    if (!source.safetyResponsibility || source.safetyResponsibility === '待确认') add('safety', 'danger', '安全责任待确认', '补充安全负责人和异常处置责任。');
    const metrics = calculateMetrics(source, today);
    if (metrics.budgetUsage > 100) add('overspend', 'danger', '预算已超支', `当前预算使用率 ${metrics.budgetUsage}%。`);
    if (metrics.delayedTasks > 0) add('delay', 'warning', '存在延期任务', `${metrics.delayedTasks} 项任务已超过计划日期。`);
    return alerts;
  }

  function createEmptyStore() {
    return { schemaVersion: SCHEMA_VERSION, activeProjectId: '', projects: [] };
  }

  function normalizeStore(value) {
    if (!value || typeof value !== 'object') return createEmptyStore();
    if (value.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(`不支持的数据版本：${value.schemaVersion}`);
    }
    const projects = Array.isArray(value.projects)
      ? clone(value.projects).filter((project) => project && typeof project.id === 'string')
      : [];
    const requested = String(value.activeProjectId || '');
    const activeProjectId = projects.some((project) => project.id === requested)
      ? requested
      : (projects[0] ? projects[0].id : '');
    return { schemaVersion: SCHEMA_VERSION, activeProjectId, projects };
  }

  function assertCollection(collection) {
    if (!COLLECTIONS.includes(collection)) throw new Error(`不支持的数据集合：${collection}`);
  }

  function timestamp(now) {
    return new Date(now || Date.now()).toISOString();
  }

  function addRecord(project, collection, record, now) {
    assertCollection(collection);
    const result = clone(project);
    if (!Array.isArray(result[collection])) result[collection] = [];
    result[collection].push(Object.assign({ id: uid('record', now) }, clone(record || {})));
    result.updatedAt = timestamp(now);
    return result;
  }

  function updateRecord(project, collection, recordId, patch, now) {
    assertCollection(collection);
    const result = clone(project);
    const index = Array.isArray(result[collection])
      ? result[collection].findIndex((record) => record.id === recordId)
      : -1;
    if (index < 0) throw new Error(`未找到记录：${recordId}`);
    result[collection][index] = Object.assign({}, result[collection][index], clone(patch || {}), { id: recordId });
    result.updatedAt = timestamp(now);
    return result;
  }

  function removeRecord(project, collection, recordId, now) {
    assertCollection(collection);
    const result = clone(project);
    const index = Array.isArray(result[collection])
      ? result[collection].findIndex((record) => record.id === recordId)
      : -1;
    if (index < 0) throw new Error(`未找到记录：${recordId}`);
    result[collection].splice(index, 1);
    result.updatedAt = timestamp(now);
    return result;
  }

  function selectProject(value, projectId) {
    const result = normalizeStore(value);
    if (!result.projects.some((project) => project.id === projectId)) throw new Error(`未找到项目：${projectId}`);
    result.activeProjectId = projectId;
    return result;
  }

  function mergeImportedStore(currentValue, importedValue, now) {
    const current = normalizeStore(currentValue);
    const imported = normalizeStore(importedValue);
    const result = clone(current);
    const ids = new Set(result.projects.map((project) => project.id));
    let activeProjectId = result.activeProjectId;

    imported.projects.forEach((source) => {
      const project = clone(source);
      const originalId = project.id;
      if (ids.has(project.id)) project.id = uid('project', now);
      while (ids.has(project.id)) project.id = uid('project', now);
      ids.add(project.id);
      project.updatedAt = timestamp(now);
      result.projects.push(project);
      if (originalId === imported.activeProjectId) activeProjectId = project.id;
    });
    result.activeProjectId = activeProjectId;
    return result;
  }

  function createProjectExport(project, exportedAt) {
    if (!project || typeof project.id !== 'string') throw new Error('无法导出无效项目');
    return {
      schemaVersion: SCHEMA_VERSION,
      activeProjectId: project.id,
      projects: [clone(project)],
      exportedAt: timestamp(exportedAt),
    };
  }

  return Object.freeze({
    SCHEMA_VERSION,
    STAGES: Object.freeze(STAGE_NAMES.slice()),
    DOMAINS: Object.freeze(DOMAINS.slice()),
    TEMPLATES,
    createProject,
    calculateMetrics,
    validateProject,
    createEmptyStore,
    normalizeStore,
    addRecord,
    updateRecord,
    removeRecord,
    selectProject,
    mergeImportedStore,
    createProjectExport,
  });
}));
