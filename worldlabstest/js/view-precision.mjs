// Keep millimetre road paint resolvable after zooming out from a vehicle close-up.
export const groundTop=-.15;
export const cameraClipping=distance=>({near:Math.max(.08,Math.min(6,distance/100)),far:1800});
export const depthResolution=(distance,near,far,bits=24)=>distance*distance*(far-near)/(far*near*(2**bits-1));
