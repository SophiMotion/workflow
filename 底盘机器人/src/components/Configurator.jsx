import { Box, Zap, Cpu, Radar, ArrowUpRight } from 'lucide-react';
import { choices, configLimits } from '../../shared/domain.mjs';
import { RangeField, Options, Toggle } from './Controls.jsx';
const groups=[['structure','结构',Box],['power','动力',Zap],['control','电控',Cpu],['sensor','传感',Radar]];
export function Configurator({config:c,set,group,setGroup,disabled}){
  const field=(key,title,unit='mm',step=1)=><RangeField key={key} label={title} value={c[key]} min={configLimits[key][0]} max={configLimits[key][1]} unit={unit} step={step} onChange={v=>set(`config.${key}`,v)}/>;
  const options=(key,title,compact=false)=><Options key={key} label={title} options={choices[key]} value={c[key]} onChange={v=>set(`config.${key}`,v)} compact={compact}/>;
  return <aside className="config-panel panel"><div className="config-tabs">{groups.map(([id,name,Icon])=><button className={group===id?'active':''} key={id} onClick={()=>setGroup(id)}><Icon size={21}/><span>{name}</span></button>)}</div><fieldset className="config-content" disabled={disabled}>
    <h2>{({structure:'结构设计',power:'动力系统',control:'电控系统',sensor:'传感方案'})[group]}</h2>
    {group==='structure'&&<>{options('drive','行走方案',true)}{field('length','底盘长度')}{field('width','底盘宽度')}{field('mast','立柱高度')}{field('wheel','轮径')}{options('material','结构材料',true)}{options('arm','上肢机构')}</>}
    {group==='power'&&<>{options('motor','驱动电机')}{field('batteryAh','电池容量','Ah')}{field('payload','目标载荷','kg')}{field('speed','目标速度','m/s',.1)}<div className="inline-note">24V 动力平台，4 个编码器电机。电池容量和速度为设计输入，实际续航与性能以测试为准。</div></>}
    {group==='control'&&<>{options('controller','运动控制器')}{options('compute','ROS 2 计算平台')}<Toggle label="硬件急停" detail="独立切断动力电源" checked={c.estop} onChange={v=>set('config.estop',v)}/><div className="inline-note">默认接口：CAN / UART。驱动协议、供电和 ROS 驱动需在详细设计中确认。</div></>}
    {group==='sensor'&&<>{options('lidar','激光雷达')}{options('camera','视觉传感')}<Toggle label="9 轴 IMU" detail="姿态与里程计融合" checked={c.imu} onChange={v=>set('config.imu',v)}/></>}
    <a className="text-link reference-link" href="https://www.sophicar.com/parametric-modeling" target="_blank" rel="noreferrer">SophiCar 参数化参考 <ArrowUpRight size={14}/></a>
  </fieldset></aside>;
}
