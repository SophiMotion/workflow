(function (root) {
  'use strict';

  function createDemoStore() {
    const Core = root.PrdCore;
    const project = Core.createProject('chassis', {
      name: 'SM-2408 线控底盘科研平台',
      customer: '某高校智能车辆实验室',
      owner: '王博',
      startDate: '2026-06-18',
      endDate: '2026-11-08',
      budget: 2000000,
      description: '面向智能车辆研究的线控底盘、控制接口、数据记录与安全验证平台。',
    }, '2026-06-18T09:00:00.000Z');

    Object.assign(project, {
      currentStage: '系统集成',
      ipResponsibility: '背景知识产权归各方，项目新增成果按合同约定',
      dataResponsibility: '实验数据由客户管理，交付日志按验收要求脱敏留档',
      safetyResponsibility: '项目负责人牵头，测试负责人执行现场安全检查',
    });
    project.stages.forEach((stage, index) => {
      if (index < 4) stage.status = '已完成';
      if (index === 4) stage.status = '进行中';
      if (index > 4) stage.status = '待开始';
      stage.plannedDate = ['2026-06-18', '2026-07-05', '2026-07-26', '2026-08-15', '2026-09-20', '2026-10-20', '2026-11-08'][index];
    });
    const domainProgress = { '结构': 78, '嵌入式硬件': 70, '嵌入式软件': 56, '算法': 48 };
    project.requirements.forEach((record, index) => {
      record.progress = domainProgress[record.domain];
      record.owner = ['周宇', '李强', '王磊', '陈敏'][index % 4];
      record.status = record.progress >= 70 ? '进行中' : '已确认';
      record.maturity = index < 3 ? '已实现' : (index < 6 ? '在研' : '规划');
      record.evidence = index < 4 ? 'F2' : 'P';
      record.target = index % 3 === 0 ? '待确认' : ['120 kg', '≤ 80 ms', '100 Hz'][index % 3];
    });
    project.tasks = [
      task('需求冻结评审', '需求冻结', '王博', '2026-06-25', '2026-07-05', 100, '已完成', '结构'),
      task('总体方案与接口评审', '设计评审', '王博', '2026-07-08', '2026-07-26', 100, '已完成', '结构'),
      task('电池与电源采购', '采购制造', '李强', '2026-08-12', '2026-08-23', 100, '已完成', '嵌入式硬件'),
      task('线束加工', '采购制造', '王磊', '2026-08-19', '2026-09-06', 100, '已完成', '嵌入式硬件'),
      task('底盘总装', '采购制造', '周宇', '2026-09-02', '2026-09-20', 62, '进行中', '结构'),
      task('驱动控制联调', '系统集成', '陈敏', '2026-08-26', '2026-09-06', 100, '已完成', '嵌入式软件'),
      task('安全状态机评审', '系统集成', '陈敏', '2026-09-02', '2026-09-10', 60, '进行中', '嵌入式软件', '驱动控制联调'),
      task('第一轮场地测试', '测试验证', '刘洋', '2026-09-11', '2026-09-26', 0, '待开始', '算法', '安全状态机评审'),
      task('FAT 验收脚本', 'FAT/SAT 验收', '刘洋', '2026-10-07', '2026-10-20', 0, '待开始', '算法', '第一轮场地测试'),
    ];
    project.team = [
      member('王博', '项目负责人', '系统', 160, 102, '负责总体范围、客户沟通和阶段闸门'),
      member('周宇', '结构工程师', '结构', 240, 176, '车架、总装与载荷验证'),
      member('李强', '硬件工程师', '嵌入式硬件', 220, 148, '电源、控制器与线束'),
      member('陈敏', '软件工程师', '嵌入式软件', 260, 151, '通信、日志和安全状态机'),
      member('刘洋', '算法与测试', '算法', 220, 96, '运动控制、场地测试与验收脚本'),
    ];
    project.bom = [
      bom('CH-001', '铝型材车架与连接件', '结构', 1, '套', 268000, 280000, 262000, 'ProFabX', '已到货'),
      bom('DR-101', '轮毂电机与驱动器', '嵌入式硬件', 4, '套', 68000, 288000, 272000, '待确认', '已到货'),
      bom('PW-210', '动力电池与 BMS', '嵌入式硬件', 1, '套', 168000, 180000, 168000, '待确认', '加工中'),
      bom('CT-330', '线控控制器与通信单元', '嵌入式硬件', 2, '套', 86000, 190000, 172000, '待确认', '采购中'),
      bom('SN-410', '转角、速度与惯导传感器', '算法', 1, '批', 146000, 160000, 146000, '待确认', '待下单'),
    ];
    project.acceptance.forEach((record, index) => {
      record.owner = index < 2 ? '周宇' : (index < 4 ? '陈敏' : '刘洋');
      record.plannedDate = ['2026-09-20', '2026-09-26', '2026-10-03', '2026-10-10', '2026-11-08'][index];
      record.status = index < 2 ? '已通过' : (index === 2 ? '进行中' : '待开始');
      record.evidence = index < 2 ? '测试记录已归档' : '待确认';
      record.customerConfirmed = index === 0;
    });
    project.risks = [
      risk('线束交付晚于底盘总装窗口', '进度', '中', '高', '王磊', '并行准备临时测试线束，锁定供应商每日更新', '跟踪中'),
      risk('安全状态机异常场景覆盖不足', '安全', '中', '高', '陈敏', '增加失联、欠压和驱动器过温故障注入', '开放'),
      risk('场地测试时间与学校课程冲突', '资源', '低', '中', '刘洋', '预留第二测试窗口并提前一周确认', '开放'),
      risk('电池接口定义变更', '技术', '低', '高', '李强', '已冻结接口并留存评审记录', '已关闭'),
    ];
    project.changes = [
      { id: makeId('change'), title: '增加远程接管接口', reason: '客户新增安全研究场景', scopeImpact: '增加通信接口与测试项', timeImpact: '5 天', budgetImpact: 32000, applicant: '王博', approvalStatus: '评估中', decision: '待确认' },
    ];

    return { schemaVersion: Core.SCHEMA_VERSION, activeProjectId: project.id, projects: [project] };
  }

  let index = 0;
  function makeId(prefix) { index += 1; return `${prefix}-demo-${index}`; }
  function task(title, stage, owner, plannedStart, plannedEnd, progress, status, domain, dependency) {
    return { id: makeId('task'), title, stage, owner, plannedStart, plannedEnd, actualStart: progress ? plannedStart : '', actualEnd: progress === 100 ? plannedEnd : '', progress, status, domain, dependency: dependency || '', notes: '' };
  }
  function member(name, role, domain, plannedHours, actualHours, responsibility) {
    return { id: makeId('member'), name, role, domain, responsibility, plannedHours, actualHours, status: '参与中' };
  }
  function bom(code, name, category, quantity, unit, unitPrice, budgetCost, actualCost, supplier, procurementStatus) {
    return { id: makeId('bom'), code, name, specification: '按冻结技术要求', category, quantity, unit, unitPrice, budgetCost, actualCost, supplier, procurementStatus, notes: '' };
  }
  function risk(title, category, probability, impact, owner, mitigation, status) {
    return { id: makeId('risk'), title, category, probability, impact, level: impact === '高' ? '高' : '中', owner, mitigation, dueDate: '2026-09-16', status };
  }

  root.PrdSeed = Object.freeze({ createDemoStore });
}(typeof globalThis !== 'undefined' ? globalThis : this));
