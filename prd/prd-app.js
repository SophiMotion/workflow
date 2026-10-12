(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PrdApp = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', api.init);
    else api.init();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const STORAGE_KEY = 'sophistudio.prd-cockpit.v1';
  const VIEW_TITLES = {
    overview: '项目总览', requirements: '需求参数', gantt: '甘特计划', team: '团队资源',
    bom: 'BOM 与预算', acceptance: '交付验收', risks: '风险与变更',
  };
  const RECORD_SCHEMAS = {
    requirements: [
      field('title', '需求名称', 'text', true, true), field('domain', '专业域', 'select', false, false, ['结构', '嵌入式硬件', '嵌入式软件', '算法']),
      field('description', '要求描述', 'textarea', false, true), field('target', '目标值', 'text'), field('unit', '单位', 'text'),
      field('priority', '优先级', 'select', false, false, ['P0', 'P1', 'P2', 'P3']), field('owner', '负责人', 'text'),
      field('maturity', '技术成熟度', 'select', false, false, ['已实现', '在研', '规划']), field('status', '状态', 'select', false, false, ['待确认', '已确认', '进行中', '已完成', '已阻塞']),
      field('progress', '完成度（%）', 'number'), field('acceptanceMethod', '验收方法', 'textarea', false, true),
      field('evidence', '证据等级', 'select', false, false, ['F1', 'F2', 'P', 'H', 'D', 'C']), field('notes', '备注', 'textarea', false, true),
    ],
    tasks: [
      field('title', '任务名称', 'text', true, true), field('stage', '所属阶段', 'select', false, false, ['立项', '需求冻结', '设计评审', '采购制造', '系统集成', '测试验证', 'FAT/SAT 验收']),
      field('owner', '负责人', 'text'), field('domain', '专业域', 'select', false, false, ['结构', '嵌入式硬件', '嵌入式软件', '算法', '系统']),
      field('plannedStart', '计划开始', 'date'), field('plannedEnd', '计划结束', 'date'), field('progress', '完成度（%）', 'number'),
      field('status', '状态', 'select', false, false, ['待开始', '进行中', '已完成', '已阻塞']), field('dependency', '前置任务', 'text'),
      field('notes', '任务说明', 'textarea', false, true),
    ],
    team: [
      field('name', '成员姓名', 'text', true), field('role', '标准角色', 'text'), field('domain', '专业域', 'select', false, false, ['系统', '结构', '嵌入式硬件', '嵌入式软件', '算法', '采购制造', '测试交付']),
      field('responsibility', '职责', 'textarea', false, true), field('plannedHours', '预计工时', 'number'), field('actualHours', '实际工时', 'number'),
      field('status', '状态', 'select', false, false, ['待加入', '参与中', '已完成', '暂停']),
    ],
    bom: [
      field('code', '物料编码', 'text', true), field('name', '物料名称', 'text', true), field('specification', '规格', 'text', false, true),
      field('category', '成本分类', 'select', false, false, ['结构', '嵌入式硬件', '嵌入式软件', '算法', '加工', '服务', '其他']),
      field('quantity', '数量', 'number'), field('unit', '单位', 'text'), field('unitPrice', '单价（¥）', 'number'),
      field('budgetCost', '预算成本（¥）', 'number'), field('actualCost', '实际成本（¥）', 'number'), field('supplier', '供应商', 'text'),
      field('procurementStatus', '采购状态', 'select', false, false, ['待确认', '待下单', '采购中', '加工中', '已到货', '已验收']), field('notes', '备注', 'textarea', false, true),
    ],
    acceptance: [
      field('title', '验收项', 'text', true), field('milestone', '里程碑', 'text'), field('deliverable', '交付物', 'text', false, true),
      field('metric', '验收指标', 'textarea', false, true), field('method', '验收方法', 'textarea', false, true), field('owner', '责任人', 'text'),
      field('plannedDate', '计划日期', 'date'), field('actualDate', '实际日期', 'date'), field('evidence', '证据说明', 'text'),
      field('evidencePath', '证据路径', 'text', false, true), field('status', '状态', 'select', false, false, ['待开始', '进行中', '待客户确认', '已通过', '未通过']),
      field('customerConfirmed', '客户已确认', 'checkbox'),
    ],
    risks: [
      field('title', '风险描述', 'text', true, true), field('category', '类别', 'select', false, false, ['技术', '安全', '进度', '成本', '供应', '资源', '客户']),
      field('probability', '概率', 'select', false, false, ['低', '中', '高']), field('impact', '影响', 'select', false, false, ['低', '中', '高']),
      field('level', '风险等级', 'select', false, false, ['低', '中', '高']), field('owner', '负责人', 'text'),
      field('mitigation', '应对措施', 'textarea', false, true), field('dueDate', '截止日期', 'date'), field('status', '状态', 'select', false, false, ['开放', '跟踪中', '已关闭']),
    ],
    changes: [
      field('title', '变更标题', 'text', true, true), field('reason', '变更原因', 'textarea', false, true), field('scopeImpact', '范围影响', 'textarea', false, true),
      field('timeImpact', '工期影响', 'text'), field('budgetImpact', '预算影响（¥）', 'number'), field('applicant', '申请人', 'text'),
      field('approvalStatus', '审批状态', 'select', false, false, ['待提交', '评估中', '已批准', '已拒绝']), field('decision', '决策记录', 'textarea', false, true),
    ],
  };
  let store = null;
  let activeView = 'overview';
  let initialized = false;

  function field(name, label, type, required, wide, options) { return { name, label, type, required: !!required, wide: !!wide, options: options || [] }; }
  function esc(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(value) { return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(Number(value) || 0); }
  function shortDate(value) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.slice(5) : '待确认'; }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function icon(name) { return `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`; }
  function statusClass(value) {
    if (['已完成', '已通过', '已到货', '已验收', '已实现', '已关闭'].includes(value)) return 'complete';
    if (['进行中', '采购中', '加工中', '参与中', '在研', '已确认'].includes(value)) return 'active';
    if (['已阻塞', '未通过', '高'].includes(value)) return 'danger';
    return 'warning';
  }
  function status(value) { return `<span class="status ${statusClass(value)}">${esc(value || '待确认')}</span>`; }
  function actions(collection, id) {
    return `<button class="row-action" type="button" data-action="edit-record" data-collection="${collection}" data-id="${esc(id)}" aria-label="编辑">${icon('edit')}</button><button class="row-action" type="button" data-action="delete-record" data-collection="${collection}" data-id="${esc(id)}" aria-label="删除">${icon('trash')}</button>`;
  }
  function pageHeader(project, title, description, action) {
    return `<header class="page-head"><div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${action || `<span class="status-label"><i class="status-dot"></i>${esc(project.status || '进行中')}</span>`}</header>`;
  }
  function editButton(label, collection) { return `<button class="button button-primary" type="button" data-action="add-record" data-collection="${collection}">${icon('plus')}${label}</button>`; }

  function renderOverview(project, date) {
    const Core = root.PrdCore || (typeof require === 'function' ? require('./prd-core.js') : null);
    const metrics = Core.calculateMetrics(project, date);
    const alerts = Core.validateProject(project, date);
    const milestones = (project.tasks || []).filter((task) => task.progress < 100).sort((a, b) => String(a.plannedEnd).localeCompare(String(b.plannedEnd))).slice(0, 4);
    const costGroups = groupCosts(project.bom || []);
    return `<div class="content-frame">
      ${pageHeader(project, project.name, project.description, `<div class="page-toolbar"><span class="status-label"><i class="status-dot"></i>${esc(project.status)}</span><button class="button button-quiet" type="button" data-action="edit-project">${icon('edit')}编辑项目</button></div>`)}
      <div class="head-meta"><span>客户：${esc(project.customer)}</span><span>负责人：${esc(project.owner)}</span><span>阶段：${esc(project.currentStage)}</span><span>${esc(project.typeLabel)}</span></div>
      <section class="surface" style="margin-top:20px">
        <div class="kpi-strip">
          ${kpi('总体进度', `${metrics.overallProgress}%`, '任务平均完成度', metrics.overallProgress)}
          ${kpi('预算使用', `${metrics.budgetUsage}%`, `${money(metrics.actualCost)} / ${money(project.budget)}`, metrics.budgetUsage)}
          ${kpi('剩余工期', `${metrics.remainingDays}天`, metrics.delayedTasks ? `较计划延期 ${metrics.delayedTasks} 项` : '计划内推进', 0)}
          ${kpi('开放风险', metrics.openRisks, `高风险 ${(project.risks || []).filter((risk) => risk.level === '高' && risk.status !== '已关闭').length} 项`, 0, metrics.openRisks ? 'danger' : '')}
          ${kpi('验收完成', `${metrics.acceptanceProgress}%`, `${(project.acceptance || []).filter((item) => item.status === '已通过').length} / ${(project.acceptance || []).length} 项通过`, metrics.acceptanceProgress)}
        </div>
        <div class="stage-rail">${project.stages.map((stage, index) => `<div class="stage ${stage.status === '已完成' ? 'is-complete' : stage.name === project.currentStage ? 'is-current' : ''}"><span class="stage-number">${stage.status === '已完成' ? '✓' : index + 1}</span><strong>${esc(stage.name)}</strong><small>${stage.name === project.currentStage ? '当前阶段' : shortDate(stage.plannedDate)}</small></div>`).join('')}</div>
      </section>
      <div class="dashboard-grid">
        <section class="surface"><div class="surface-head"><h2>项目进度概览</h2><p>${metrics.delayedTasks ? `${metrics.delayedTasks} 项任务延期` : '基于任务完成度'}</p></div>
          <div class="progress-layout"><div class="chart-area"><div class="chart-legend"><span class="legend-line actual">实际进度</span><span class="legend-line">计划进度</span></div><div class="progress-chart"><span class="today-line" style="--today:62%"><span>今天</span></span>${progressSvg(metrics.overallProgress)}</div></div>
          <div class="milestone-list"><h3>即将到来的里程碑</h3>${milestones.length ? milestones.map((task) => `<div class="milestone-row ${task.plannedEnd < date ? 'is-late' : ''}"><span>${esc(task.title)}</span><time>${shortDate(task.plannedEnd)}</time></div>`).join('') : '<p class="empty-state">暂无待办任务</p>'}</div></div>
        </section>
        <div class="dashboard-stack">
          <section class="surface"><div class="surface-head"><h2>成本分布（实际）</h2></div><div class="surface-body cost-layout"><div class="donut"><div class="donut-label"><span>已发生</span><strong>${money(metrics.actualCost)}</strong></div></div><div class="cost-legend">${costGroups.slice(0, 5).map((group, index) => `<div class="cost-row"><i style="--swatch:${['#1a73e8','#34a853','#fbbc04','#ea4335','#bdc1c6'][index]}"></i><span>${esc(group.name)}</span><b>${money(group.value)}</b></div>`).join('')}</div></div></section>
          <section class="surface"><div class="surface-head"><h2>专业域完成度</h2></div><div class="surface-body domain-bars">${Object.entries(metrics.domainProgress).map(([domain, value], index) => `<div class="domain-row"><span>${domain}</span><span class="bar"><i style="--progress:${value}%;--bar-color:${['#34a853','#34a853','#1a73e8','#fbbc04'][index]}"></i></span><b>${value}%</b></div>`).join('')}</div></section>
          ${alerts.length ? `<section class="surface"><div class="surface-head"><h2>项目闸门提醒</h2></div><div class="surface-body alert-list">${alerts.slice(0, 3).map((alert) => `<div class="alert-row ${alert.tone === 'danger' ? 'danger' : ''}">${icon('alert')}<div><strong>${esc(alert.title)}</strong><span>${esc(alert.detail)}</span></div></div>`).join('')}</div></section>` : ''}
        </div>
      </div>
    </div>`;
  }

  function kpi(label, value, note, progress, tone) { return `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value ${tone === 'danger' ? 'is-danger' : ''}">${value}</div><div class="kpi-note">${note}</div>${progress ? `<div class="mini-progress"><i style="--progress:${Math.min(100, progress)}%"></i></div>` : ''}</div>`; }
  function progressSvg(progress) { const actualY = 190 - Math.min(100, progress) * 1.55; return `<svg viewBox="0 0 600 210" preserveAspectRatio="none"><polyline points="0,205 100,180 200,148 300,115 400,80 500,45 600,12" stroke="#1a73e8" fill="none"/><polyline points="0,205 100,168 200,125 300,${actualY + 25} 370,${actualY}" stroke="#34a853" fill="none"/><circle cx="370" cy="${actualY}" r="4" fill="#34a853" stroke="#fff"/></svg>`; }
  function groupCosts(records) { const map = new Map(); records.forEach((item) => map.set(item.category || '其他', (map.get(item.category || '其他') || 0) + (Number(item.actualCost) || 0))); return [...map].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value); }

  function renderRequirements(project) {
    return tablePage(project, '需求参数', '把结构、嵌入式硬件、嵌入式软件与算法要求关联到负责人和验收方法。', '新增需求', 'requirements',
      ['编号', '专业域', '需求与目标', '负责人', '成熟度', '进度', '证据', '状态', '操作'],
      (item, index) => `<tr><td>REQ-${String(index + 1).padStart(3, '0')}</td><td>${esc(item.domain)}</td><td><b>${esc(item.title)}</b><br><small>${esc(item.target)}${item.unit ? ` ${esc(item.unit)}` : ''}</small></td><td>${esc(item.owner)}</td><td><span class="maturity ${statusClass(item.maturity)}">${esc(item.maturity)}</span></td><td>${esc(item.progress || 0)}%</td><td><span class="evidence">${esc(item.evidence)}</span></td><td>${status(item.status)}</td><td class="actions">${actions('requirements', item.id)}</td></tr>`);
  }

  function renderTeam(project) {
    const planned = (project.team || []).reduce((sum, item) => sum + (Number(item.plannedHours) || 0), 0);
    const actual = (project.team || []).reduce((sum, item) => sum + (Number(item.actualHours) || 0), 0);
    return `<div class="content-frame">${pageHeader(project, '团队资源', '明确标准角色、实际成员、职责与工时负荷。', editButton('新增成员', 'team'))}<div class="summary-cards"><div class="surface summary-card"><span>项目成员</span><strong>${project.team.length}</strong><small>人</small></div><div class="surface summary-card"><span>计划工时</span><strong>${planned}</strong><small>小时</small></div><div class="surface summary-card"><span>实际工时</span><strong>${actual}</strong><small>小时</small></div><div class="surface summary-card"><span>投入比例</span><strong>${planned ? Math.round(actual / planned * 100) : 0}%</strong><small>计划对比</small></div></div>${dataSurface('团队与职责', ['成员', '角色', '专业域', '职责', '计划工时', '实际工时', '状态', '操作'], project.team.map((item) => `<tr><td><b>${esc(item.name)}</b></td><td>${esc(item.role)}</td><td>${esc(item.domain)}</td><td>${esc(item.responsibility)}</td><td>${esc(item.plannedHours)}</td><td>${esc(item.actualHours)}</td><td>${status(item.status)}</td><td class="actions">${actions('team', item.id)}</td></tr>`).join(''))}</div>`;
  }

  function renderBom(project) {
    const Core = root.PrdCore || (typeof require === 'function' ? require('./prd-core.js') : null);
    const metrics = Core.calculateMetrics(project, todayISO());
    return `<div class="content-frame">${pageHeader(project, 'BOM 与预算', '统一记录物料、研发、加工和服务成本，实时观察预算偏差。', editButton('新增物料', 'bom'))}<div class="summary-cards"><div class="surface summary-card"><span>项目预算</span><strong>${money(project.budget)}</strong></div><div class="surface summary-card"><span>BOM 预算</span><strong>${money(metrics.bomBudget)}</strong></div><div class="surface summary-card"><span>实际成本</span><strong>${money(metrics.actualCost)}</strong></div><div class="surface summary-card"><span>预测结余</span><strong style="color:${metrics.forecastBalance < 0 ? '#ea4335' : '#34a853'}">${money(metrics.forecastBalance)}</strong></div></div>${dataSurface('BOM 成本明细', ['编码', '物料与规格', '分类', '数量', '单价', '预算', '实际', '供应商', '采购状态', '操作'], project.bom.map((item) => `<tr><td>${esc(item.code)}</td><td><b>${esc(item.name)}</b><br><small>${esc(item.specification)}</small></td><td>${esc(item.category)}</td><td>${esc(item.quantity)} ${esc(item.unit)}</td><td class="num">${money(item.unitPrice)}</td><td class="num">${money(item.budgetCost)}</td><td class="num">${money(item.actualCost)}</td><td>${esc(item.supplier)}</td><td>${status(item.procurementStatus)}</td><td class="actions">${actions('bom', item.id)}</td></tr>`).join(''))}</div>`;
  }

  function renderAcceptance(project) {
    return tablePage(project, '交付验收', '将里程碑、交付物、指标、方法、证据和客户确认放在同一条验收链上。', '新增验收项', 'acceptance',
      ['验收项', '里程碑', '交付物 / 指标', '责任人', '计划日期', '证据', '客户确认', '状态', '操作'],
      (item) => `<tr><td><b>${esc(item.title)}</b></td><td>${esc(item.milestone)}</td><td>${esc(item.deliverable)}<br><small>${esc(item.metric)}</small></td><td>${esc(item.owner)}</td><td>${esc(item.plannedDate || '待确认')}</td><td>${esc(item.evidence)}</td><td>${item.customerConfirmed ? '已确认' : '待确认'}</td><td>${status(item.status)}</td><td class="actions">${actions('acceptance', item.id)}</td></tr>`);
  }

  function renderRisks(project) {
    const riskRows = project.risks.map((item) => `<tr><td><b>${esc(item.title)}</b></td><td>${esc(item.category)}</td><td>${esc(item.probability)}</td><td>${esc(item.impact)}</td><td>${status(item.level)}</td><td>${esc(item.owner)}</td><td>${esc(item.mitigation)}</td><td>${esc(item.dueDate)}</td><td>${status(item.status)}</td><td class="actions">${actions('risks', item.id)}</td></tr>`).join('');
    const changeRows = project.changes.map((item) => `<tr><td><b>${esc(item.title)}</b><br><small>${esc(item.reason)}</small></td><td>${esc(item.scopeImpact)}</td><td>${esc(item.timeImpact)}</td><td class="num">${money(item.budgetImpact)}</td><td>${esc(item.applicant)}</td><td>${status(item.approvalStatus)}</td><td>${esc(item.decision)}</td><td class="actions">${actions('changes', item.id)}</td></tr>`).join('');
    return `<div class="content-frame">${pageHeader(project, '风险与变更', '追踪风险处置和范围、工期、预算变更，保留可回溯的项目决策。', `<div class="page-toolbar">${editButton('新增风险', 'risks')}${editButton('新增变更', 'changes')}</div>`)}${dataSurface('风险台账', ['风险', '类别', '概率', '影响', '等级', '负责人', '应对措施', '截止日期', '状态', '操作'], riskRows)}${dataSurface('变更记录', ['变更', '范围影响', '工期影响', '预算影响', '申请人', '审批状态', '决策', '操作'], changeRows)}</div>`;
  }

  function tablePage(project, title, description, addLabel, collection, headers, row) {
    const records = project[collection] || [];
    return `<div class="content-frame">${pageHeader(project, title, description, editButton(addLabel, collection))}${dataSurface(title, headers, records.map(row).join(''))}</div>`;
  }
  function dataSurface(title, headers, rows) { return `<section class="surface"><div class="surface-head"><h2>${esc(title)}</h2></div><div class="table-wrap"><table class="data-table"><thead><tr>${headers.map((item) => `<th>${esc(item)}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}"><div class="empty-state">暂无记录</div></td></tr>`}</tbody></table></div></section>`; }

  function renderGantt(project, date) {
    const groups = [];
    (root.PrdCore ? root.PrdCore.STAGES : ['立项', '需求冻结', '设计评审', '采购制造', '系统集成', '测试验证', 'FAT/SAT 验收']).forEach((stage) => {
      const tasks = project.tasks.filter((task) => task.stage === stage);
      if (tasks.length) { groups.push({ type: 'phase', title: stage }); tasks.forEach((task) => groups.push({ type: 'task', task })); }
    });
    const weeks = 11;
    const rangeStart = day(project.startDate) || day(date);
    const rangeEnd = day(project.endDate) || rangeStart + 70 * 86400000;
    const range = Math.max(86400000, rangeEnd - rangeStart);
    const labels = Array.from({ length: weeks }, (_, index) => new Date(rangeStart + (range * index / (weeks - 1))).toISOString().slice(5, 10));
    const selected = project.tasks.find((task) => task.status === '进行中') || project.tasks[0];
    return `<div class="content-frame">${pageHeader(project, '甘特计划', `计划周期 ${project.startDate} — ${project.endDate}`, editButton('新增任务', 'tasks'))}<div class="page-toolbar" style="margin-bottom:12px"><select aria-label="阶段筛选"><option>全部阶段</option>${project.stages.map((stage) => `<option>${esc(stage.name)}</option>`).join('')}</select><select aria-label="负责人筛选"><option>全部负责人</option>${[...new Set(project.tasks.map((task) => task.owner))].map((owner) => `<option>${esc(owner)}</option>`).join('')}</select><button class="button button-quiet" type="button" data-action="today">今天</button></div><section class="surface gantt-shell"><div class="gantt-scroll"><div class="gantt-grid" style="--weeks:${weeks};--rows:${groups.length}"><div class="gantt-table"><div class="gantt-head"><span>任务</span><span>负责人</span><span>计划时间</span><span>进度</span></div>${groups.map((row) => row.type === 'phase' ? `<div class="gantt-row phase"><span>${esc(row.title)}</span><span></span><span></span><span></span></div>` : `<div class="gantt-row ${selected && selected.id === row.task.id ? 'is-selected' : ''}" data-action="edit-record" data-collection="tasks" data-id="${esc(row.task.id)}"><span>${esc(row.task.title)}</span><span>${esc(row.task.owner)}</span><span>${shortDate(row.task.plannedStart)} 至 ${shortDate(row.task.plannedEnd)}</span><span>${esc(row.task.progress)}%</span></div>`).join('')}</div><div class="gantt-timeline"><div class="timeline-head">${labels.map((label) => `<span>${label}</span>`).join('')}</div><div class="timeline-body">${groups.map((row, index) => row.type === 'task' ? ganttBar(row.task, index, rangeStart, range) : '').join('')}<span class="gantt-today" style="--left:${clamp(((day(date) - rangeStart) / range) * 100, 0, 100)}%"><span>今天</span></span></div></div></div></div>${selected ? `<div class="task-inspector"><h3>当前任务</h3><div class="head-meta"><span><b>${esc(selected.title)}</b></span><span>负责人：${esc(selected.owner)}</span><span>计划：${selected.plannedStart} 至 ${selected.plannedEnd}</span><span>完成度：${esc(selected.progress)}%</span><span>前置任务：${esc(selected.dependency || '无')}</span></div><div class="page-toolbar" style="margin-top:14px"><button class="button button-primary button-small" type="button" data-action="edit-record" data-collection="tasks" data-id="${esc(selected.id)}">${icon('edit')}编辑任务</button></div></div>` : ''}</section></div>`;
  }
  function day(value) { const result = Date.parse(`${value}T00:00:00Z`); return Number.isFinite(result) ? result : 0; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function ganttBar(task, row, start, range) { const left = clamp(((day(task.plannedStart) - start) / range) * 100, 0, 100); const right = clamp(((day(task.plannedEnd) - start) / range) * 100, left + 1, 100); const cls = task.status === '已完成' ? 'complete' : task.status === '进行中' ? 'active' : task.status === '已阻塞' ? 'danger' : ''; return `<span class="task-bar ${cls}" style="--row:${row};--left:${left}%;--width:${Math.max(1.5, right - left)}%;--fill:${clamp(task.progress, 0, 100)}%" title="${esc(task.title)}"></span>`; }

  function renderView(view, project, date) {
    if (!project) return '<div class="empty-state">请在左上角新建项目。</div>';
    const key = VIEW_TITLES[view] ? view : 'overview';
    if (key === 'requirements') return renderRequirements(project);
    if (key === 'gantt') return renderGantt(project, date || todayISO());
    if (key === 'team') return renderTeam(project);
    if (key === 'bom') return renderBom(project);
    if (key === 'acceptance') return renderAcceptance(project);
    if (key === 'risks') return renderRisks(project);
    return renderOverview(project, date || todayISO());
  }

  function loadStore() {
    try {
      const saved = root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      return saved ? root.PrdCore.normalizeStore(JSON.parse(saved)) : root.PrdSeed.createDemoStore();
    } catch (error) {
      return root.PrdSeed.createDemoStore();
    }
  }
  function activeProject() { return store && (store.projects.find((project) => project.id === store.activeProjectId) || store.projects[0]); }
  function replaceActive(project) { store.projects = store.projects.map((item) => item.id === project.id ? project : item); }
  function saveStore(message) {
    try { root.localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); document.getElementById('last-saved').textContent = `已保存 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`; if (message) toast(message, 'success'); }
    catch (error) { toast('本地保存失败，请导出 JSON 备份', 'error'); }
  }
  function syncProjectSelect() { const select = document.getElementById('project-select'); select.innerHTML = store.projects.map((project) => `<option value="${esc(project.id)}">${esc(project.name)}</option>`).join(''); select.value = store.activeProjectId; }
  function render() {
    syncProjectSelect();
    document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('is-active', button.dataset.view === activeView));
    document.getElementById('main-content').innerHTML = renderView(activeView, activeProject(), todayISO());
    document.title = `${VIEW_TITLES[activeView]} · 项目驾驶舱 · SophiStudio`;
  }

  function bindEvents() {
    document.getElementById('project-select').addEventListener('change', (event) => { store = root.PrdCore.selectProject(store, event.target.value); render(); saveStore(); });
    document.getElementById('app-nav').addEventListener('click', (event) => { const button = event.target.closest('[data-view]'); if (!button) return; activeView = button.dataset.view; render(); closeMobileNav(); });
    document.getElementById('main-content').addEventListener('click', handleContentClick);
    document.getElementById('new-project').addEventListener('click', openProjectDialog);
    document.getElementById('project-form').addEventListener('submit', createProject);
    document.getElementById('record-form').addEventListener('submit', saveRecord);
    document.getElementById('import-project').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', importJson);
    document.getElementById('export-project').addEventListener('click', exportJson);
    document.getElementById('print-project').addEventListener('click', () => root.print());
    document.getElementById('delete-project').addEventListener('click', deleteProject);
    document.getElementById('mobile-menu').addEventListener('click', toggleMobileNav);
    document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
  }
  function handleContentClick(event) {
    const target = event.target.closest('[data-action]'); if (!target) return;
    if (target.dataset.action === 'add-record') openRecordDialog(target.dataset.collection);
    if (target.dataset.action === 'edit-record') openRecordDialog(target.dataset.collection, target.dataset.id);
    if (target.dataset.action === 'delete-record') deleteRecord(target.dataset.collection, target.dataset.id);
    if (target.dataset.action === 'edit-project') openRecordDialog('__project__', activeProject().id);
  }

  function openProjectDialog() {
    const form = document.getElementById('project-form'); form.reset();
    const start = todayISO(); const end = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    form.elements.startDate.value = start; form.elements.endDate.value = end;
    document.getElementById('project-dialog').showModal(); form.elements.name.focus();
  }
  function createProject(event) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    try { const project = root.PrdCore.createProject(values.type, values); store.projects.push(project); store.activeProjectId = project.id; activeView = 'overview'; saveStore('项目已创建'); document.getElementById('project-dialog').close(); render(); }
    catch (error) { toast(error.message, 'error'); }
  }

  function projectSchema() { return [field('name', '项目名称', 'text', true, true), field('customer', '客户', 'text'), field('owner', '项目负责人', 'text'), field('currentStage', '当前阶段', 'select', false, false, root.PrdCore.STAGES), field('status', '项目状态', 'select', false, false, ['规划中', '进行中', '暂停', '已完成']), field('startDate', '计划开始', 'date'), field('endDate', '计划结束', 'date'), field('budget', '项目预算（¥）', 'number'), field('description', '项目说明', 'textarea', false, true), field('ipResponsibility', '知识产权责任', 'textarea', false, true), field('dataResponsibility', '数据责任', 'textarea', false, true), field('safetyResponsibility', '安全责任', 'textarea', false, true)]; }
  function openRecordDialog(collection, id) {
    const isProject = collection === '__project__'; const project = activeProject();
    const schema = isProject ? projectSchema() : RECORD_SCHEMAS[collection];
    if (!schema) return;
    const record = isProject ? project : (id ? (project[collection] || []).find((item) => item.id === id) : {});
    const form = document.getElementById('record-form'); form.elements.collection.value = collection; form.elements.recordId.value = id || '';
    document.getElementById('record-dialog-title').textContent = `${id ? '编辑' : '新增'}${isProject ? '项目' : collectionLabel(collection)}`;
    document.getElementById('record-fields').innerHTML = schema.map((definition) => renderField(definition, record || {})).join('');
    document.getElementById('record-dialog').showModal(); const first = document.querySelector('#record-fields input, #record-fields select, #record-fields textarea'); if (first) first.focus();
  }
  function collectionLabel(collection) { return { requirements: '需求', tasks: '任务', team: '成员', bom: '物料', acceptance: '验收项', risks: '风险', changes: '变更' }[collection] || '记录'; }
  function renderField(definition, record) {
    const value = record[definition.name]; const attrs = `${definition.required ? ' required' : ''} name="${definition.name}"`;
    let control;
    if (definition.type === 'select') control = `<select${attrs}>${definition.options.map((option) => `<option value="${esc(option)}" ${value === option ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select>`;
    else if (definition.type === 'textarea') control = `<textarea${attrs} rows="3">${esc(value || '')}</textarea>`;
    else if (definition.type === 'checkbox') control = `<input${attrs} type="checkbox" ${value ? 'checked' : ''}>`;
    else control = `<input${attrs} type="${definition.type}" value="${esc(value == null ? '' : value)}" ${definition.type === 'number' ? 'min="0" step="1"' : ''}>`;
    return `<label class="field ${definition.wide ? 'field-wide' : ''}"><span>${esc(definition.label)}${definition.required ? ' *' : ''}</span>${control}</label>`;
  }
  function saveRecord(event) {
    event.preventDefault(); const form = event.currentTarget; const collection = form.elements.collection.value; const id = form.elements.recordId.value; const definitions = collection === '__project__' ? projectSchema() : RECORD_SCHEMAS[collection]; const values = {};
    definitions.forEach((definition) => { const element = form.elements[definition.name]; values[definition.name] = definition.type === 'checkbox' ? element.checked : definition.type === 'number' ? (Number(element.value) || 0) : element.value; });
    try { if (collection === '__project__') replaceActive(Object.assign({}, activeProject(), values, { updatedAt: new Date().toISOString() })); else replaceActive(id ? root.PrdCore.updateRecord(activeProject(), collection, id, values) : root.PrdCore.addRecord(activeProject(), collection, values)); saveStore('修改已保存'); document.getElementById('record-dialog').close(); render(); }
    catch (error) { toast(error.message, 'error'); }
  }
  function deleteRecord(collection, id) { if (!root.confirm(`确定删除这条${collectionLabel(collection)}记录吗？`)) return; try { replaceActive(root.PrdCore.removeRecord(activeProject(), collection, id)); saveStore('记录已删除'); render(); } catch (error) { toast(error.message, 'error'); } }
  function deleteProject() { const project = activeProject(); if (!project || !root.confirm(`确定删除项目“${project.name}”吗？此操作无法撤销。`)) return; store.projects = store.projects.filter((item) => item.id !== project.id); store.activeProjectId = store.projects[0] ? store.projects[0].id : ''; saveStore('项目已删除'); render(); }

  function exportJson() {
    const project = activeProject(); if (!project) return;
    const payload = root.PrdCore.createProjectExport(project);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${safeFileName(project.name)}-${todayISO()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('项目 JSON 已导出', 'success');
  }
  function safeFileName(value) { return String(value || 'project').replace(/[\\/:*?"<>|]/g, '-').slice(0, 60); }
  async function importJson(event) {
    const file = event.target.files[0]; event.target.value = ''; if (!file) return;
    try { const incoming = JSON.parse(await file.text()); store = root.PrdCore.mergeImportedStore(store, incoming); saveStore('项目已导入'); render(); }
    catch (error) { toast(`导入失败：${error.message}`, 'error'); }
  }
  function toast(message, tone) { const node = document.createElement('div'); node.className = `toast ${tone || ''}`; node.textContent = message; document.getElementById('toast-root').appendChild(node); setTimeout(() => node.remove(), 2800); }
  function toggleMobileNav() { const nav = document.getElementById('app-nav'); const open = nav.classList.toggle('is-open'); document.getElementById('mobile-menu').setAttribute('aria-expanded', String(open)); }
  function closeMobileNav() { document.getElementById('app-nav').classList.remove('is-open'); document.getElementById('mobile-menu').setAttribute('aria-expanded', 'false'); }

  function init() {
    if (initialized) return; initialized = true; store = loadStore(); bindEvents(); render(); saveStore();
  }

  return Object.freeze({ init, renderView });
}));
