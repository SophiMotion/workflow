import {parseConfig} from './parameters';
import {parseLimbConfig} from './limbs';
import {parseHeadConfig} from './head';
import {parseMotors} from './motors';
export function createFusionRequest(config:unknown,sha:string,poseMode:'fusion'|'website'){
 const parameters=parseConfig(config,sha),c=config as {source?:string;limbs?:unknown;motors?:unknown;head?:unknown};
 if(poseMode!=='fusion'&&poseMode!=='website')throw new Error('Choose a Fusion pose export mode.');
 return {version:1,source:c.source,sourceSha256:sha,parameters,limbs:parseLimbConfig(c.limbs),motors:parseMotors(c.motors),head:parseHeadConfig(c.head),fusionExport:{version:2,poseMode,geometry:'native-fusion-design',coverPolicy:'complete-assembly',motorPolicy:'metadata-only'}};
}
