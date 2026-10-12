import {advancePlayback,pathLength,samplePath,sampleAxlePose} from './route-math.mjs';
// Each entry owns progress and play state; the editor aliases only the selected route.
export function tickDrive(drive,dt){
 const length=drive.length??pathLength(drive.samples);
 if(!drive.playing)return 0;
 const before=drive.distance,next=advancePlayback(before,drive.route.speed,dt,length,drive.route.loop);
 drive.distance=next.distance;drive.playing=!next.finished;
 const traveled=drive.route.loop?Math.max(0,drive.route.speed)*Math.max(0,dt):next.distance-before;
 drive.travel=(drive.travel??before)+traveled;return traveled;
}
export function drivePose(drive,wheelbase=1.683){return drive.route.preset_id==='campus-proving-v3'?sampleAxlePose(drive.samples,drive.distance,wheelbase):samplePath(drive.samples,drive.distance);}
export function validDrive(d,ids){return !!d&&ids.has(d.object_id)&&Array.isArray(d.points)&&d.points.length<=2048&&d.points.every(p=>Array.isArray(p)&&p.length===3&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e6))&&Number.isFinite(d.speed)&&d.speed>=.1&&d.speed<=10&&Number.isFinite(d.distance??0)&&(d.distance??0)>=0&&(d.distance??0)<=1e6&&(d.loop===undefined||typeof d.loop==='boolean')&&(d.surface===undefined||['road','plane','terrain'].includes(d.surface));}
