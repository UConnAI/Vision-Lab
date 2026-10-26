// Camera access is independent of model loading; late permission responses are cleaned up.
export async function requestCamera(mediaDevices, deviceId='', timeoutMs=20000) {
  if(!mediaDevices?.getUserMedia) throw Object.assign(new Error('This browser does not expose camera capture. Open the localhost demo in Chrome or Edge.'),{name:'UnsupportedError'});
  let expired=false, timer;
  const constraints={audio:false,video:deviceId?{deviceId:{exact:deviceId},width:{ideal:640},height:{ideal:480}}:{width:{ideal:640},height:{ideal:480}}};
  const request=(async()=>{
    let stream;
    try{stream=await mediaDevices.getUserMedia(constraints);}
    catch(e){if(e.name==='OverconstrainedError'&&!deviceId)stream=await mediaDevices.getUserMedia({video:true,audio:false});else throw e;}
    if(expired){stream.getTracks().forEach(t=>t.stop());throw new Error('Camera request expired');}
    return stream;
  })();
  try{return await Promise.race([request,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Object.assign(new Error('Camera permission has not completed. Check the browser permission prompt, or open in a regular browser and retry.'),{name:'TimeoutError'}));},timeoutMs);})]);}
  finally{clearTimeout(timer);}
}
export function cameraError(error){
  const name=error.name||'Error';
  const help={NotAllowedError:'Camera access was denied by this browser or the operating system. Open in a regular browser, allow this site’s camera, and check the Windows/macOS camera settings below.',NotFoundError:'No camera was found. Connect or enable a webcam, then retry.',NotReadableError:'The camera could not start. Close other apps using it and retry.',OverconstrainedError:'The selected camera is unavailable. Select Default camera and retry.',UnsupportedError:'This browser does not expose camera capture. Open in a regular browser.',TimeoutError:'Camera permission is still pending. Check the permission prompt or open in a regular browser.'};
  return `${help[name]||'Camera startup failed. Retry in a regular browser.'} (${name}: ${error.message})`;
}
