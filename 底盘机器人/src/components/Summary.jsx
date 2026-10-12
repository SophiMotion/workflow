import { Weight, Zap, Battery, ArrowRight, ChevronRight, CircleAlert, Box, GitBranch, Radar, Cpu } from 'lucide-react';
import { engineering, quote, label, checks, money } from '../../shared/domain.mjs';
export function Summary({project:p,onTab,onGroup}){
  const e=engineering(p.config),q=quote(p.config,p.prices,p.rules),warnings=checks(p.config);
  return <aside className="summary-column"><div className="panel summary-panel"><h2>设计概览</h2><div className="metrics"><div><Weight size={17}/><span>目标载荷</span><b>{p.config.payload}<small> kg</small></b></div><div><Zap size={17}/><span>额定功率</span><b>{e.power}<small> W</small></b></div><div><Battery size={17}/><span>电池容量</span><b>{e.batteryWh}<small> Wh</small></b></div></div><div className="module-list"><h3>已选模块</h3>{[
    ['structure',Box,'底盘总成',`${label('drive',p.config.drive)} · ${p.config.length} × ${p.config.width}`],
    ['structure',GitBranch,'上肢与立柱',label('arm',p.config.arm)],
    ['control',Cpu,'计算与控制',label('compute',p.config.compute)],
    ['sensor',Radar,'感知系统',label('lidar',p.config.lidar)]
  ].map(([id,Icon,title,detail])=><button key={title} onClick={()=>onGroup(id)}><span className="module-icon"><Icon size={23} strokeWidth={1.35}/></span><span><strong>{title}</strong><small>{detail}</small></span><ChevronRight size={15}/></button>)}</div><div className="estimate-metrics"><div><span>估算自重</span><b>{e.mass} kg</b></div><div><span>估算续航</span><b>{e.runtime} h</b></div><small>按 25% 驱动负荷、80% 可用电量估算</small></div></div>
    <div className="cost-panel"><h3>预估物料成本</h3><div className="big-price">{money(q.materials).replace('.00','')}</div><p>{q.allVerified?'天猫 SKU 核价完成':'估算价格 · 待天猫核价'}<span>未税 / 单台</span></p><button className="button dark" onClick={()=>onTab('bom')}>查看 BOM <ArrowRight size={17}/></button></div>
    {warnings.length>0&&<button className="warning-summary" onClick={()=>onTab('exports')}><CircleAlert size={15}/>{warnings.length} 项工程复核提示<ChevronRight size={14}/></button>}
  </aside>;
}
