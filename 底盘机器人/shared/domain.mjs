export const configLimits = {
  length: [400, 1000], width: [350, 800], mast: [600, 1600], wheel: [150, 300],
  payload: [10, 100], speed: [0.2, 2], batteryAh: [10, 60], quantity: [1, 100],
};
export const defaultConfig = { length: 600, width: 480, mast: 1200, wheel: 200, payload: 50, speed: 1.2, batteryAh: 20, quantity: 1, material: 'aluminum', drive: 'differential', motor: '250w', controller: 'stm32', compute: 'rpi5', arm: 'dual6', lidar: 'a1', camera: 'none', imu: true, estop: true };
export const choices = {
  material: [{id:'aluminum', name:'6061 铝合金', detail:'轻量 · CNC / 钣金'}, {id:'steel',name:'Q235 钢材',detail:'经济 · 焊接结构'}],
  drive: [{id:'differential',name:'四轮差速',detail:'标准轮 · 原地转向'}, {id:'mecanum',name:'麦克纳姆',detail:'全向平移 · 平整地面'}],
  motor: [{id:'250w',name:'24V · 250W',detail:'编码器减速电机 × 4'}, {id:'350w',name:'24V · 350W',detail:'编码器减速电机 × 4'}],
  controller: [{id:'stm32',name:'STM32 控制板',detail:'CAN / UART · 运动控制'}, {id:'industrial',name:'工业运动控制器',detail:'CAN / EtherCAT · 运动控制'}],
  compute: [{id:'rpi5',name:'Raspberry Pi 5',detail:'8GB · ROS 2 计算平台'}, {id:'jetson',name:'Jetson Orin Nano',detail:'8GB · 边缘 AI 计算平台'}, {id:'none',name:'外部计算机',detail:'仅配置底层运动控制'}],
  arm: [{id:'dual6',name:'双臂 · 共 6 轴',detail:'每臂 3 轴 · 概念机构'}, {id:'dual12',name:'双臂 · 共 12 轴',detail:'每臂 6 轴 · 概念机构'}, {id:'none',name:'立柱平台 · 无双臂',detail:'保留立柱与上装接口'}],
  lidar: [{id:'a1',name:'RPLIDAR A1',detail:'二维激光雷达 · USB'}, {id:'mid360',name:'Livox Mid-360',detail:'三维激光雷达 · Ethernet'}, {id:'none',name:'不配置雷达',detail:'后续按任务选配'}],
  camera: [{id:'none',name:'不配置相机',detail:'保留安装接口'}, {id:'depth',name:'RealSense D435i',detail:'深度相机 · USB 3.0'}, {id:'rgb',name:'USB RGB 相机',detail:'1080p · USB 2.0'}],
};
export const label = (key, id) => choices[key]?.find(x=>x.id===id)?.name || id;
export const money = n => new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY',maximumFractionDigits:2}).format(n);
export const round = n => Math.round((n+Number.EPSILON)*100)/100;
export function validateConfig(c) {
  for (const [k,[min,max]] of Object.entries(configLimits)) if (!Number.isFinite(c[k]) || c[k]<min || c[k]>max || (k !== 'speed' && !Number.isInteger(c[k]))) throw Error(`${k} 超出允许范围 ${min}–${max}`);
  for (const [key, options] of Object.entries(choices)) if (!options.some(x=>x.id===c[key])) throw Error(`${key} 选项无效`);
  for (const key of ['imu','estop']) if(typeof c[key]!=='boolean') throw Error(`${key} 必须为布尔值`);
  return c;
}
export function engineering(c) {
  const power = (c.motor==='350w'?350:250)*4;
  const armDof=c.arm==='none'?0:c.arm==='dual12'?12:6;
  const mass=round(c.length*c.width/288000*(c.material==='steel'?21:11)+10+c.batteryAh*.18+(armDof?8+armDof*.35:1));
  const watts=power*.25+(c.compute==='jetson'?25:c.compute==='rpi5'?12:0)+armDof*8+15;
  return {power,armDof,mass,batteryWh:c.batteryAh*24,runtime:round(c.batteryAh*24*.8/watts),height:round(c.wheel/2+110+c.mast),torque:round((mass+c.payload)*9.81*.03*(c.wheel/2000)/4)};
}
export function checks(c) {
  const out=[];
  if(c.mast/c.width>2.7) out.push({level:'warning',text:'高宽比偏大：建议加宽底盘，并复核双臂伸展时的重心与抗倾覆。'});
  if(!c.estop) out.push({level:'error',text:'未选配硬件急停，工程交付前必须确认独立急停回路。'});
  if(c.payload>60) out.push({level:'warning',text:'目标载荷超过 60 kg，需验证电机减速比、轴承和结构强度。'});
  if(c.compute==='none'&&(c.lidar!=='none'||c.camera!=='none')) out.push({level:'warning',text:'已选传感器但未选板载计算机，请补充外部计算与数据链路。'});
  if(c.drive==='mecanum') out.push({level:'info',text:'麦克纳姆轮按外包络建模；滚子接触与全向控制需单独验证。'});
  return out;
}
const seed = (id,category,name,spec,qty,unitPrice,query) => ({id,category,name,spec,qty,unitPrice,query:query||name+' '+spec});
export function bom(c, prices={}) {
  const e=engineering(c), area=c.length*c.width/288000;
  const rows=[
    seed(`deck-${c.material}-${c.length}-${c.width}`,'结构','底盘壳体与盖板',`${label('material',c.material)} · ${c.length} × ${c.width} mm`,1,round((c.material==='aluminum'?620:460)*area),'机器人底盘 铝合金 CNC 定制'),
    seed(`mast-${c.mast}`,'结构','立柱与法兰',`铝管 Ø40 · ${c.mast} mm`,1,round(180*c.mast/1200)),
    seed(`wheel-${c.drive}-${c.wheel}`,'动力',c.drive==='mecanum'?'麦克纳姆轮':'橡胶轮',`Ø${c.wheel} mm`,4,round((c.drive==='mecanum'?230:85)*c.wheel/200)),
    seed(`motor-${c.motor}`,'动力','编码器减速电机',`24V · ${c.motor==='250w'?250:350}W`,4,c.motor==='250w'?380:490),
    seed('drivers','电控','双通道电机驱动器','24V · 额定 2 × 20A',2,320),
    seed(`battery-${c.batteryAh}`,'动力','锂电池组与 BMS',`24V · ${c.batteryAh}Ah`,1,round(c.batteryAh*38)),
    seed('charger','电控','配套充电器','匹配 24V 电池组 · 5A',1,160),
    seed(`controller-${c.controller}`,'电控',label('controller',c.controller),'与电机驱动协议匹配',1,c.controller==='stm32'?280:1480),
    seed('power','电控','电源与线束套件','DC-DC · 保险丝 · 接插件',1,280),
    seed('fasteners','结构','紧固件与安装件','M4 / M6 · 一套',1,160),
  ];
  if(c.compute!=='none') rows.push(seed(`compute-${c.compute}`,'电控',label('compute',c.compute),'8GB · 含散热与存储估算',1,c.compute==='jetson'?2199:699));
  if(e.armDof) rows.push(seed(`arm-tubes-${e.armDof}-${c.mast}`,'结构','双臂连杆与关节壳体',`${e.armDof} 轴 · 铝合金`,1,round(90*e.armDof)),seed('arm-servo','动力','关节舵机','总线舵机 · 扭矩需复核',e.armDof,220));
  if(c.lidar!=='none') rows.push(seed(`lidar-${c.lidar}`,'传感',label('lidar',c.lidar),c.lidar==='a1'?'二维扫描 · USB':'三维扫描 · Ethernet',1,c.lidar==='a1'?699:3999));
  if(c.camera!=='none') rows.push(seed(`camera-${c.camera}`,'传感',label('camera',c.camera),'含安装支架',1,c.camera==='depth'?2299:180));
  if(c.imu) rows.push(seed('imu','传感','9 轴 IMU','UART / I²C',1,159));
  if(c.estop) rows.push(seed('estop','电控','硬件急停套件','按钮 · 接触器 · 独立断电',1,180));
  return rows.map(r=>{
    const p=prices[r.id], valid=p && validTmall(p.url) && p.spec && p.shop && p.checkedAt && Number.isFinite(p.price) && p.price>=0 && Number.isFinite(p.taxRate);
    const stale=valid&&(Date.now()-new Date(p.checkedAt).getTime()>7*86400000);
    const net=valid?p.price/(1+p.taxRate/100):r.unitPrice;
    return {...r,source:p||null,status:valid?(stale?'stale':'verified'):'estimate',unitNet:round(net),total:round(round(net)*r.qty),searchUrl:`https://list.tmall.com/search_product.htm?q=${encodeURIComponent(r.query)}`};
  });
}
export function validTmall(url) { try { const u=new URL(url); return u.protocol==='https:' && (u.hostname==='detail.tmall.com'||u.hostname==='detail.tmall.hk') && /^\d+$/.test(u.searchParams.get('id')||''); } catch { return false; } }
export const defaultRules={scrap:3,assembly:800,testing:400,overhead:8,margin:20,tax:13,nre:3000,shipping:200,discount:0};
export function validateRules(r){ for(const k of Object.keys(defaultRules)) if(!Number.isFinite(r[k])||r[k]<0||r[k]>(['assembly','testing','nre','shipping'].includes(k)?1000000:k==='margin'?80:k==='discount'?50:100)) throw Error(`报价规则 ${k} 超出范围`); return r; }
export function quote(c,prices,rules=defaultRules){
  validateRules(rules); const rows=bom(c,prices), materials=round(rows.reduce((s,r)=>s+r.total,0));
  const scrap=round(materials*rules.scrap/100), overhead=round((materials+scrap+rules.assembly+rules.testing)*rules.overhead/100);
  const unitCost=round(materials+scrap+rules.assembly+rules.testing+overhead);
  const unitSale=round(unitCost/(1-rules.margin/100));
  const discount=round(unitSale*c.quantity*rules.discount/100);
  const net=round(unitSale*c.quantity-discount+rules.nre+rules.shipping);
  const tax=round(net*rules.tax/100);
  return {materials,scrap,overhead,unitCost,unitSale,discount,net,tax,total:round(net+tax),verified:rows.filter(r=>r.status==='verified').length,count:rows.length,allVerified:rows.every(r=>r.status==='verified')};
}
export const prdSections=[
  ['identity','文档信息与版本记录','项目名称 / 编号、产品线、版本 / 状态、DRI、评审人、创建 / 冻结日期、客户与关联文档。'],
  ['overview','项目概况','背景与问题、成功标准、Must / Should / Non-goals、产品化分类、风险、用户场景与环境约束。'],
  ['requirements','需求与指标基线','总体方案、结构 / 硬件 / 软件 / 算法指标、证据状态、可量化达标线与 DRI。'],
  ['interfaces','接口与外部依赖','对接双方、协议 / 单位 / 采样率、提供方、就绪时间、外部依赖与备选方案。'],
  ['raci','责任分工','每项交付物指定执行人 R 和批准人 A，并明确咨询 C、知会 I 及升级路径。'],
  ['milestones','里程碑节点与交付计划','M1–M8 计划 / 实际日期、交付物、DoD、DRI、验收人；测试方法、阈值、证据和待决问题。'],
  ['resources','资源、BOM 与预算','成员、模块、计划 / 实际人天、BOM、NRE、服务及差旅预算。'],
  ['business','商务','客户与预算主体、采购 / 验收负责人、预算窗口、交付期与采购路径。'],
  ['changes','变更控制（CR）','变更内容、成本 / 周期 / 验收影响、提出人与批准人、日期、状态。'],
  ['safety','安全、数据与知识产权','运行安全边界、数据权属、第三方许可、IP 与成果发表、质保与支持。'],
  ['retrospective','节点绩效与复盘','按冻结目标记录计划与实际、交付质量、协作响应、根因和可复用资产。'],
  ['kickoff','启动对齐确认','确认量化指标、范围、RACI、日期、DoD、依赖、测试、风险、预算和变更流程。'],
  ['incentives','激励','项目引入与团队开发的时间、效果、评价依据和激励约定。'],
];
export function createProject(){
  return {schemaVersion:1,name:'SkateChassis',revision:0,updatedAt:new Date().toISOString(),config:{...defaultConfig},prices:{},rules:{...defaultRules},
    prd:{status:'草案',owner:'',targetDate:'',sections:{
      identity:'产品线：机器人 / SophiStudio\n项目编号：SC-001\n技术、交付、商业评审人：待项目组填写\n关联资料：参数配置、BOM、报价、URDF、Fusion 参数包。',
      overview:'面向高校与研发团队的双臂移动机器人实验平台。\nMust：参数化底盘、模块选配、工程数据与可追溯成本。\nShould：任务相关的感知与上层算法。\nNon-goals：未验证的户外越障、双臂协同负载和自主导航性能承诺。\n应用环境：室内平整地面；需提供场地、供电及局域网。\nTOP 风险：重心变化、峰值电流、零件供货；责任人与应对在评审时确认。',
      requirements:'以下指标由当前参数生成，证据状态为设计目标。验收前需要实物测试与签字记录。\n总体架构：传感器 → ROS 2 计算平台 → 运动控制器 → 驱动 / 关节；急停回路独立切断动力电源。',
      interfaces:'运动接口：ROS 2 /cmd_vel，线速度 m/s，角速度 rad/s。\n硬件：24V 母线；电机驱动 CAN / UART；传感器 USB / Ethernet。\n模型：URDF，右手坐标系，X 前 / Y 左 / Z 上，长度 m。\n依赖：电机减速比、舵机扭矩、驱动协议、供货日期由供应商确认；责任人和就绪时间待填写。',
      raci:'工作模块：总体架构、机械、嵌入式硬件、软件、算法、测试、采购、交付。\n请为每个模块填写：R（执行人） / A（批准人） / C（咨询） / I（知会）。\n沟通：每周更新节点、风险与决定；影响交付的阻塞及时升级至项目 DRI。',
      milestones:'M1 需求冻结 → M2 方案评审 → M3 详细设计 → M4 原理样机 → M5 工程样机 / 内测 → M6 FAT → M7 SAT / 交付 → M8 复盘。\n各节点补充：计划日期、交付物、可验证 DoD、DRI、验收人、状态、实际日期和偏差。\n验收记录应含需求编号、工具 / 环境、阈值、证据文件、测试人和签字。\n停止条件：核心指标验证失败、关键部件不兼容或预算超出批准范围。',
      resources:'物料和报价见下方实时成本基线。\n人力：成员 / 模块 / 计划人天 / 投入周期 / 实际人天。\n差旅与现场支持：按客户现场条件评审。',
      business:'填写客户与预算主体、课题负责人、实际使用者、采购与验收人。\n明确采购路径、预算窗口、期望交付时间、付款及有效期。\n当前金额为配置估算，采购前逐项核价并经商务复核。',
      changes:'冻结后新增范围、接口、数量、参数或日期变更，应记录 CR 编号、原因、成本和周期影响、提出与批准人。\n重开草案会保留已冻结快照；批准记录和签字证据由项目组补充。',
      safety:'急停、限位、通信失联停车、电池保护与异常恢复需实测。\n数据：明确工程数据和客户数据归属、权限与保存期限。\n许可：核查 ROS、硬件驱动与第三方软件许可证。\nIP / 成果发表 / 质保期限 / 超范围支持：由双方填写约定。',
      retrospective:'逐条回顾成功标准及证据；记录计划与实际、一次验收通过率、缺陷与返工。\n总结根因、协作响应、可复用零部件、代码、接口、文档和测试。',
      kickoff:'启动会逐项确认量化指标、范围、责任、里程碑、外部依赖、验收方案、风险与资源。',
      incentives:'待双方约定：项目引入、开发贡献、时间达成、交付效果、评价证据与激励方案。',
    },requirements:[{id:'ST-01',text:'底盘载荷',metric:'在平整地面达到配置目标载荷',owner:'',due:'',evidence:'设计目标'},{id:'HW-01',text:'连续运行',metric:'按实际任务功耗测试续航并归档温升数据',owner:'',due:'',evidence:'待确认'},{id:'SW-01',text:'ROS 模型加载',metric:'URDF 可解析；关节树单根无环；RViz 可显示',owner:'',due:'',evidence:'设计目标'}],checklist:Array(10).fill(false)},comments:[],versions:[],activity:[]};
}
export function freezeIssues(p){const a=[]; if(!p.prd.owner.trim()) a.push('填写项目 DRI');if(!p.prd.targetDate)a.push('填写目标冻结日期'); if(p.prd.requirements.some(r=>!r.owner.trim()||!r.due||!r.metric.trim()))a.push('补全每条需求的负责人、日期与达标线');if(p.prd.checklist.some(x=>!x))a.push('完成全部启动确认项');return a;}
