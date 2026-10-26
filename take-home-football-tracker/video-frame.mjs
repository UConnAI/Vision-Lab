// Offline sampling needs decoded pixels, not a new compositor presentation.
// Identical/black frames may not trigger requestVideoFrameCallback after a seek.
export function seekDecoded(video,time,{timeoutMs=10000}={}){
  if(!Number.isFinite(time)||time<0)return Promise.reject(new Error('Use a finite nonnegative video time.'));
  if(Math.abs(video.currentTime-time)<.001&&video.readyState>=2)return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{clearTimeout(timer);video.removeEventListener('seeked',done);video.removeEventListener('error',fail);};
    const done=()=>{cleanup();video.readyState>=2?resolve():reject(new Error('The sought video frame has no decoded pixels.'));};
    const fail=()=>{cleanup();reject(new Error('This video could not be decoded.'));};
    const timer=setTimeout(()=>{cleanup();reject(new Error('Video frame did not decode in time. Try another local MP4.'));},timeoutMs);
    video.addEventListener('seeked',done);video.addEventListener('error',fail);
    try{video.currentTime=time;}catch(error){cleanup();reject(error);}
  });
}
