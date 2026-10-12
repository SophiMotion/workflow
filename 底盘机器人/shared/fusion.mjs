import { engineering, validateConfig, defaultConfig } from './domain.mjs';
import { robotModel } from './robot.mjs';
export function fusionModel(c){
  const E={length:'body_length',width:'body_width',mast:'mast_height',wheel:'wheel_diameter'};
  const exprMm=v=>`${Number((v*1000).toFixed(5))} mm`;
  return robotModel(c).map(b=>{
    const v={...b,center:b.position.map((x,i)=>x+b.offset[i]),sizeExpr:b.size.map(exprMm),positionExpr:b.position.map((x,i)=>exprMm(x+b.offset[i]))};
    const z='wheel_diameter / 2 + 60 mm';
    if(b.id==='base_link'){v.sizeExpr=['body_length','body_width','100 mm'];v.positionExpr=['0 mm','0 mm',z];}
    if(b.id==='deck'){v.sizeExpr=['body_length - 8 mm','body_width - 8 mm','12 mm'];v.positionExpr=['0 mm','0 mm',z+' + 56 mm'];}
    if(b.id==='mast'){v.sizeExpr=['20 mm','mast_height'];v.positionExpr=['0 mm','0 mm',z+' + 70 mm + mast_height / 2'];}
    if(b.id==='mast_mount')v.positionExpr=['0 mm','0 mm',z+' + 76 mm'];
    if(/_(wheel|motor)$/.test(b.id)){const side=b.id.includes('left')?1:-1,end=b.id.startsWith('front')?1:-1;v.positionExpr=[`${end} * body_length * 0.34`,`${side} * (body_width / 2 ${b.id.endsWith('wheel')?'+ 43':'- 15'} mm)`,'wheel_diameter / 2'];v.sizeExpr[0]=b.id.endsWith('wheel')?'wheel_diameter / 2':'wheel_diameter * 0.24';}
    if(b.id==='shoulder_bar'){v.sizeExpr=['22 mm','body_width * 0.86'];v.positionExpr=['0 mm','0 mm',z+' + 70 mm + mast_height * 0.93'];}
    if(b.id==='support_bar'){v.sizeExpr=['20 mm','body_width * 0.45'];v.positionExpr=['0 mm','0 mm',z+' + 70 mm + mast_height * 0.49'];}
    if(b.id.includes('_arm_')){const side=b.id.startsWith('left')?1:-1,i=+b.id.split('_').at(-1),n=engineering(c).armDof/2;v.sizeExpr=['16 mm',`mast_height * 0.48 / ${n}`];v.positionExpr=['0 mm',`${side} * body_width * 0.43`,`${z} + 70 mm + mast_height * 0.93 - ${i-.5} * mast_height * 0.48 / ${n}`];}
    if(b.id.endsWith('brace')){v.sizeExpr=['14 mm','mast_height * 0.49'];v.positionExpr=['0 mm',`${b.id.startsWith('left')?1:-1} * body_width * 0.2`,z+' + 70 mm + mast_height * 0.245'];}
    if(b.id==='battery')v.positionExpr=['body_length * -0.15','0 mm',z];
    if(b.id==='controller')v.positionExpr=['body_length * 0.2','0 mm',z];
    if(b.id==='lidar_link')v.positionExpr=['body_length * 0.33','0 mm',z+' + 115 mm'];
    if(b.id==='camera_link')v.positionExpr=['35 mm','0 mm',z+' + 70 mm + mast_height * 0.83'];
    if(b.id==='imu_link')v.positionExpr=['0 mm','0 mm',z+' + 25 mm'];
    if(b.id==='estop_link')v.positionExpr=['body_length * -0.34','body_width * -0.30',z+' + 83 mm'];
    return v;
  });
}
export const fusionSchema = 'sophistudio.skatechassis.fusion/v1';
export function fusionPayload(project) {
  validateConfig(project.config);
  const config=Object.fromEntries(Object.keys(defaultConfig).map(k=>[k,project.config[k]]));
  return {schema:fusionSchema,project:{name:String(project.name||'SkateChassis').slice(0,100),revision:Number.isSafeInteger(project.revision)?project.revision:0},exportedAt:new Date().toISOString(),units:'mm',config,bodies:fusionModel(config)};
}
