export const defaults = Object.freeze({base_length:900,base_width:850,base_height:200,total_height:1875.75,wheel_base:500,od_tire:150,tire_thickness:20,thin_sheet:2,structural_sheet:5,base_angle:30,base_middle_length:100,wheel_track:600,shoulder_length:450,hip_length:400,hip_position:800,tube_diameter:50,tube_thickness:2,upper_arm_length:200,lower_arm_length:300,thigh_length:250,lower_leg_length:250});
export type Params = {-readonly [K in keyof typeof defaults]:number};
export type Key = keyof Params;
export type Tab = 'Base'|'Wheels'|'Body'|'Limbs'|'Head'|'Motors';
export interface Field {key:Key;label:string;min:number;max:number;step:number;unit:string;tab:Tab;section:string;help:string;test:number}
const field=(key:Key,label:string,min:number,max:number,tab:Tab,section:string,help:string,test:number,step=1,unit='mm'):Field=>({key,label,min,max,step,tab,section,help,test,unit});
export const fields:Field[]=[
 field('base_length','Base length',650,1400,'Base','Base geometry','Overall front-to-rear dimension along Y.',1000),
 field('base_width','Base width',650,1200,'Base','Base geometry','Overall side-to-side dimension along X.',900),
 field('base_height','Base height',160,350,'Base','Base geometry','Tray height above the fixed 50 mm ground clearance.',220),
 field('base_angle','Base angle',15,60,'Base','Base geometry','Angle of the folded end ramps to the ground.',35,1,'°'),
 field('base_middle_length','Middle length',40,220,'Base','Base geometry','Vertical straight section between the upper and lower end ramps.',120),
 field('thin_sheet','Thin sheet',1,6,'Base','Material','Tray and cover thickness. Folded regions use a mesh approximation.',3,0.1),
 field('structural_sheet','Structural sheet',5,5,'Base','Material','Unavailable in model 4: the separate structural sheet mounting plates are absent. Retained at 5 mm for configuration compatibility.',5,0.5),
 field('wheel_base','Wheel base',300,850,'Wheels','Wheel geometry','Drive axle to rear caster pivot spacing; each end moves by half the change.',540),
 field('wheel_track','Wheel track',400,950,'Wheels','Wheel geometry','Center-to-center spacing of the left and right wheel assemblies.',620),
 field('od_tire','Tire outer diameter',100,220,'Wheels','Wheel geometry','Drive tire outer diameter. Axle height follows radius; casters retain their size.',180),
 field('tire_thickness','Tire thickness',8,50,'Wheels','Wheel geometry','Screenshot convention: rim diameter = OD − thickness. Radial rubber wall = thickness / 2.',30),
 field('total_height','Total height',1200,2200,'Body','Body geometry','Neutral assembly height including the head. Moving the arm can change the measured envelope.',1800,.25),
 field('shoulder_length','Shoulder length',250,800,'Body','Body geometry','Shoulder beam span, centered on the spine.',550),
 field('hip_length','Hip length',180,650,'Body','Body geometry','Total hip span including the 80 mm spine; inner ends remain attached.',450),
 field('hip_position','Hip position',350,1500,'Body','Body geometry','Height from the top of the base deck to the lower face of the hip frame.',900),
 field('tube_diameter','Tube diameter',30,80,'Limbs','Tube frame','Shared outside diameter for all eight hollow arm and leg tubes.',60),
 field('tube_thickness','Tube thickness',1,16,'Limbs','Tube frame','Radial wall thickness. Tube inner diameter = diameter − 2 × thickness.',3,.5),
 field('upper_arm_length','Upper arm length',100,500,'Limbs','Arm lengths','Upper tube cut length. Its top stays fixed; the elbow and lower arm follow the bottom.',250),
 field('lower_arm_length','Lower arm length',100,650,'Limbs','Arm lengths','Lower tube cut length. Its top stays fixed at the elbow end.',350),
 field('thigh_length','Thigh length',100,500,'Limbs','Leg lengths','Thigh tube cut length for both legs. Its top stays fixed; the knee and lower leg follow its bottom.',300),
 field('lower_leg_length','Lower leg length',100,500,'Limbs','Leg lengths','Lower-leg tube cut length for both legs. Extends downward from the knee attachment.',300),
];
export function rampStart(p:Params){return 362.325662851831+(p.base_length-900)/2-((p.base_height-p.base_middle_length)/2/Math.tan(p.base_angle*Math.PI/180)-50/Math.tan(Math.PI/6));}
export function validate(p:Params):string[]{
 const errors:string[]=[];
 for(const f of fields){const v=p[f.key];if(!Number.isFinite(v)) errors.push(`${f.label}: enter a finite number.`);else if(v<f.min||v>f.max) errors.push(`${f.label}: use ${f.min}–${f.max} ${f.unit}.`);}
 if(errors.length) return errors;
 if(p.tube_diameter-2*p.tube_thickness<12)errors.push('Tube inner diameter must be at least 12 mm. Reduce thickness or increase diameter.');
 const armBottom=857.6+p.total_height-defaults.total_height-(p.upper_arm_length-200)-(p.lower_arm_length-300);
 if(armBottom<50+p.base_height+20)errors.push('The neutral arm must stay at least 20 mm above the base deck. Shorten the arm or increase total height.');
 if(p.base_middle_length>p.base_height-40) errors.push('Middle length must leave at least 20 mm for each end ramp.');
 if(p.wheel_base/2+p.od_tire/2+6>=rampStart(p)) errors.push('The drive wheel opening reaches the end ramp. Increase base length or angle, or reduce wheel base / tire diameter.');
 if(p.wheel_track/2+81+p.thin_sheet>=p.base_width/2) errors.push('The motor assembly needs 81 mm outside each wheel center. Increase base width or reduce wheel track.');
 if(p.od_tire-p.tire_thickness<70) errors.push('The rim diameter must be at least 70 mm to clear the fixed hub.');
 if(p.od_tire+8>=50+p.base_height-p.thin_sheet) errors.push('The tire must clear the underside of the top deck by at least 8 mm.');
 if(407.5+p.hip_position-800-(p.thigh_length-250)-(p.lower_leg_length-250)<270) errors.push('The neutral leg tubes need 20 mm clearance above the deck. Shorten the legs or raise hip position.');
 if(p.hip_position+50+p.base_height+80>=p.total_height-171.75) errors.push('The hip needs at least 80 mm clearance below the shoulder. Lower the hip or increase total height.');
 return errors;
}
export function parseConfig(value:unknown,sha:string):Params{
 if(!value||typeof value!=='object') throw new Error('Choose a SophiRobot configuration JSON file.');
 const v=value as {version?:number;sourceSha256?:string;parameters?:Record<string,unknown>};
 if(v.version!==1||v.sourceSha256!==sha||!v.parameters) throw new Error('This configuration belongs to a different model or format.');
 const p={...defaults} as Params;
 for(const f of fields){if((f.key==='thigh_length'||f.key==='lower_leg_length')&&v.parameters[f.key]===undefined)continue;if(typeof v.parameters[f.key]!=='number') throw new Error(`Missing numeric parameter: ${f.label}.`);p[f.key]=v.parameters[f.key] as number;}
 const errors=validate(p);if(errors.length)throw new Error(errors.join(' '));return p;
}
