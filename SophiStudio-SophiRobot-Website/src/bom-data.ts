import {defaults,type Params} from './parameters';
import {defaultMotors,type Motors} from './motors';
export interface BomRow{id:string;group:string;item:string;material:string;quantity:number;unit:string;unitPrice:number}
export function exampleBom(p:Params=defaults,m:Motors=defaultMotors()):BomRow[]{
 const rows:BomRow[]=[];const add=(id:string,group:string,item:string,material:string,quantity:number,unitPrice:number,unit='pc')=>rows.push({id,group,item,material,quantity,unitPrice,unit});
 add('tray','Base','Folded AGV base tray',`Q235 steel sheet, ${p.thin_sheet} mm; envelope ${p.base_length} × ${p.base_width} × ${p.base_height} mm`,1,480);
 add('covers','Base','Top metal covers',`Q235 steel sheet, ${p.thin_sheet} mm; powder coated`,2,120);
 add('wheels','Base','Drive wheel and tire',`Rubber tire Ø${p.od_tire} mm; aluminium hub`,2,180);
 add('casters','Base','Caster assembly','Polyurethane wheel; steel bracket',2,85);
 add('spine','Frame','Central spine','6063-T5 aluminium extrusion, 80 × 80 mm',1,320);
 add('frame','Frame','Base frame profiles','6063-T5 aluminium extrusion, 40 × 40 mm',1,360,'set');
 add('shoulder-beam','Frame','Shoulder beam',`6063-T5 aluminium, span ${p.shoulder_length} mm`,1,160);
 add('hip-beam','Frame','Hip frame',`6063-T5 aluminium, span ${p.hip_length} mm`,1,130);
 for(const [id,item,length,price] of [['tube-upper','Upper arm tubes',p.upper_arm_length,40],['tube-lower','Lower arm tubes',p.lower_arm_length,55],['tube-thigh','Thigh tubes',p.thigh_length,45],['tube-leg','Lower leg tubes',p.lower_leg_length,45]] as const)add(id,'Limbs',item,`6061-T6 aluminium tube Ø${p.tube_diameter} × ${p.tube_thickness} mm wall × ${length} mm`,2,price);
 add('brackets','Limbs','Joint mounting brackets','6061-T6 aluminium, machined',1,850,'set');
 add('grippers','Limbs','Gripper jaws and mounts','6061-T6 aluminium; rubber grip pads',2,220);
 add('head-mount','Head','Head and neck brackets','6061-T6 aluminium, machined',1,320,'set');
 add('motor-covers','Frame','Motor covers','ABS printed shells or folded aluminium',1,280,'set');
 const names={base:'Base drive',shoulder:'Shoulder lift / swing',elbow:'Elbow',knee:'Knee',wrist:'Wrist rotation'};
 const prices={base:680,shoulder:2000,elbow:900,knee:1400,wrist:180};
 for(const group of ['base','shoulder','elbow','knee','wrist'] as const)for(const side of ['l','r'] as const){const slot=`${group}_${side}` as keyof Motors,s=m[slot].options[m[slot].selected];const details=[s.type==='Unspecified'?'Motor and gearbox':s.type,s.torque===null?'':`${s.torque} N·m`,s.speed===null?'':`${s.speed} rpm`,s.voltage===null?'':`${s.voltage} V`,s.ratio===null?'':`${s.ratio}:1`].filter(Boolean).join(' · ');add(slot,'Motors',`${names[group]} ${side.toUpperCase()} — ${s.name}`,details,group==='shoulder'?2:1,prices[group]);}
 add('hip-motors','Motors','Hip motors','Example geared actuator; specification TBD',2,1400);
 add('twist-motors','Motors','Arm twist motors','Example geared actuator; specification TBD',2,650);
 add('clamp-servos','Motors','Clamping servos','Example metal-geared servo; specification TBD',2,180);
 add('head-rotation','Motors','Head rotation motor','Example rotary actuator; specification TBD',1,950);
 add('head-tilt','Motors','Head tilt motor','Example stepper and gearbox; specification TBD',1,550);
 add('bearings','Hardware','Bearings, shafts and couplings','Bearing steel / stainless steel; assorted',1,620,'set');
 add('fasteners','Hardware','Fasteners and inserts','Steel bolts, nuts, washers and inserts',1,240,'set');
 add('controller','Electronics','Main controller','Example embedded control computer',1,1500);
 add('drivers','Electronics','Motor drivers and distribution','Example driver boards and power distribution',1,2200,'set');
 add('battery','Electronics','Battery and BMS','Example 24 V battery pack; capacity TBD',1,1800);
 add('wiring','Electronics','Wiring and connectors','Copper cable, connectors and cable protection',1,380,'set');
 add('safety','Electronics','Emergency stop and switches','Example industrial switches and relay',1,220,'set');
 return rows;
}
export function lineTotalFen(r:BomRow){if(!Number.isInteger(r.quantity)||r.quantity<0||r.quantity>100000||!Number.isFinite(r.unitPrice)||r.unitPrice<0||r.unitPrice>10000000)throw new Error('Use whole-number quantities (0–100,000) and prices from ¥0 to ¥10,000,000.');return r.quantity*Math.round(r.unitPrice*100);}
export const totalFen=(rows:BomRow[])=>rows.reduce((sum,r)=>sum+lineTotalFen(r),0);
export function bomCsv(rows:BomRow[]){const cell=(v:string|number)=>{let s=String(v);if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};const lines:(string|number)[][]=[['SophiStudio / SophiRobot — Example prices in CNY; not supplier quotes'],['Category','Item','Example material / specification','Quantity','Unit','Unit price (CNY)','Line total (CNY)'],...rows.map(r=>[r.group,r.item,r.material,r.quantity,r.unit,r.unitPrice.toFixed(2),(lineTotalFen(r)/100).toFixed(2)]),['Total estimate (CNY)','','','','','',(totalFen(rows)/100).toFixed(2)]];return '\uFEFF'+lines.map(row=>row.map(cell).join(',')).join('\r\n');}
