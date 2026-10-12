// Qualitative demonstration model. Coefficients are not a qualified WPS or FEA material law.
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const PROCESS_DEFAULTS={torchDistance:15,gasFlow:18,preflow:.7,postflow:3,coolDuration:90,poolTemp:1550};
export const PROCESS_LIMITS={torchDistance:[8,30],gasFlow:[2,35],preflow:[0,5],postflow:[0,15],coolDuration:[30,240],poolTemp:[1200,1800]};
export const processNames={mag:'MAG 常规',pulse:'脉冲 MAG',tig:'TIG 氩弧'};
export const weaveNames={straight:'直线窄焊道',zigzag:'横向摆动',circle:'环形鱼鳞'};
export const heatInput=p=>+(p.efficiency*p.voltage*p.current/p.speed/1000).toFixed(3);
export function beadProfile(p){const e=heatInput(p.params),pulse=p.process==='pulse',tig=p.process==='tig',weave=p.weave!=='straight';const coverage=clamp(1-Math.max(0,12-p.params.gasFlow)*.07-Math.max(0,p.params.gasFlow-26)*.035-Math.max(0,p.params.torchDistance-20)*.025-(p.params.postflow<1?.15:0),.15,1);return {width:clamp(3.1+e*5+(weave?2.8:0)-(tig?.8:0),2.5,13),height:clamp(1.1+e*1.4+(tig?-.4:0),.7,4.5),pitch:clamp(p.params.speed/(pulse?7:tig?4:5),.6,5),ripples:pulse||p.weave==='circle'?'密集鱼鳞':p.weave==='zigzag'?'宽幅波纹':tig?'细密层叠':'细直焊道',coverage,spatter:clamp((p.gas==='co2'?.5:.1)+(1-coverage)*.7+(p.params.voltage>30?.3:0)-(pulse?.2:0)-(tig?.3:0),0,1),oxidation:1-coverage};}
export function thermalConstants(p){const energy=heatInput(p.params);return {peak:clamp(p.params.poolTemp*(.78+energy*.35)*(p.process==='tig'?.96:1),650,1950),tau:clamp(13+energy*19+p.params.preheat*.045+(p.material==='304'?9:0)-p.params.thickness*.45,10,65)};}
export function thermalCycle(age,p){const {peak,tau}=thermalConstants(p);if(age<0)return p.params.preheat;return 20+(peak-20)*Math.exp(-age/tau);}
export function processState(time,seam,p){const progress=clamp((time-seam.start)/seam.duration,0,1);const arc=time>=seam.start&&time<seam.end;return {progress,arc,phase:time<seam.start?'待焊':arc?'焊接中':time<seam.end+p.params.postflow?'后送气':time<seam.end+35?'冷却中':'已焊',temperature:time<seam.start?p.params.preheat:thermalCycle(Math.max(0,time-(seam.start+seam.duration*.5)),p)};}
export function assessRisks(p){const e=heatInput(p.params),b=beadProfile(p),c=thermalConstants(p),t85=c.tau*Math.log(780/480);const hot=e*6/p.params.thickness;return [
 {key:'thermal',title:'热应力与变形',level:hot>.95||p.strategy!=='balanced'&&hot>.6?'high':'watch',reason:`线能量 ${e.toFixed(3)} kJ/mm；${p.strategy==='balanced'?'采用对称顺序':'非对称顺序可能积累收缩'}。约束和温度梯度会影响残余应力。`,action:'比较焊接顺序、拘束条件与道间温度，正式结论需热力耦合求解。'},
 {key:'cooling',title:'快速冷却 / 裂纹倾向',level:t85<11&&p.material==='Q235B'?'high':'watch',reason:`演示 t₈/₅ ≈ ${t85.toFixed(1)} s。冷却速度需要结合材料碳当量、氢含量与拘束判断。`,action:'此处不计算裂纹概率；用材料数据库、实测冷却曲线和合格 WPS 复核。'},
 {key:'shielding',title:'气孔 / 氧化倾向',level:b.coverage<.7||p.process==='tig'&&p.gas!=='argon'?'high':'low',reason:`${p.params.gasFlow} L/min、枪距 ${p.params.torchDistance} mm、后送气 ${p.params.postflow} s。${p.process==='tig'&&p.gas!=='argon'?'当前演示 TIG 与活性混合气组合不匹配。':b.coverage<.7?'当前保护条件偏离示例范围。':'示例保护条件未触发主要提示。'}`,action:'检查气体适配、喷嘴和泄漏；可见纹理不能排除内部气孔。'},
 {key:'fusion',title:'未熔合 / 咬边倾向',level:e<.28||p.params.speed>18?'high':'low',reason:`速度 ${p.params.speed} mm/s，线能量 ${e.toFixed(3)} kJ/mm。过快走枪或热输入不足可能影响融合。`,action:'结合截面、焊脚尺寸和无损检测确认，不以外观代替检验。'},
 {key:'burn',title:'过热 / 烧穿倾向',level:hot>1.15?'high':'low',reason:`板厚 ${p.params.thickness} mm；单位厚度热输入随速度和电流变化。`,action:'较高热输入需评估熔深和薄板烧穿；本模型不预测实际熔深。'}
 ];}
