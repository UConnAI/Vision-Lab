import {trajectory,pointAt,annotationMetrics,chooseBall} from './tracking.mjs';
import {sampleTimes,videoEnd} from './timeline.mjs';
import {seekDecoded} from './video-frame.mjs';
import {learnBallAppearance,appearanceBall} from './appearance.mjs';
import {observationRows,coverageCounts} from './observations.mjs';
const $=id=>document.getElementById(id),video=$('video'),input=document.createElement('canvas'),cnnInput=document.createElement('canvas'),original=$('original').getContext('2d'),remix=$('remix').getContext('2d');
const FPS=10,appearanceInput=document.createElement('canvas');
let analysisComplete=false,analyzedDuration=0;
let modelPromise=null,scrubbing=false;
let model=null,raw=[],track=[],labels=[],busy=false,epoch=0,source='Soccer · one clear ball',videoURL=null,customImage=null,customURL=null;
function status(message){$('status').textContent=message;}
function setBusy(value){busy=value;for(const el of document.querySelectorAll('button,input,select'))el.disabled=value;$('cancel').disabled=!value;if(!value)$('play').disabled=!raw.length;}
const seek=t=>seekDecoded(video,t);
async function loadModel(){if(model)return model;if(modelPromise)return modelPromise;modelPromise=initializeModel().catch(error=>{modelPromise=null;throw error;});return modelPromise;}
async function initializeModel(){if(!window.tf||!window.cocoSsd)throw new Error('Local TensorFlow.js files are missing. Keep the complete vendor folder.');try{await tf.setBackend('webgl');}catch{await tf.setBackend('cpu');}await tf.ready();model=await cocoSsd.load({base:$('cnn').value,modelUrl:new URL($('cnn').value==='mobilenet_v1'?'./vendor/model-v1/model.json':'./vendor/model/model.json',import.meta.url).href});return model;}
function updateTrack(){
  track=trajectory(observationRows(raw,Number($('threshold').value),$('visualTracking').checked),0,Number($('smooth').value));
  const counts=coverageCounts(track),duration=Number.isFinite(video.duration)?video.duration:0,last=raw.at(-1)?.t||0;
  $('thresholdValue').textContent=$('threshold').value;$('smoothValue').textContent=Number($('smooth').value).toFixed(1);
  $('coverage').textContent=raw.length?`${analysisComplete?'Full video analyzed':'Analysis range'}: 0.00–${last.toFixed(3)} s of ${duration.toFixed(3)} s · ${counts.cnn} CNN + ${counts.appearance} appearance-tracked + ${counts.missing} without a position (${counts.total} samples)`:`Ready to analyze the full ${duration?duration.toFixed(2)+' s':'video'}.`;
  $('evidence').textContent=JSON.stringify({complete:analysisComplete,duration,lastSample:last,counts,first:raw[0],middle:raw[Math.floor(raw.length/2)],last:raw.at(-1),trajectory:track},null,2);
  metrics();
}
function metrics(){const result=annotationMetrics(labels,track,Math.hypot(input.width,input.height));$('metrics').textContent=result.labeled?`${result.labeled} labeled samples · ${result.detected} visible-ball detections · ${result.missed} visible-ball misses · ${result.falsePositives} detections on absent-ball frames · mean center error ${result.meanError===null?'unavailable':(result.meanError*100).toFixed(2)+'% of image diagonal'}`:'No manually labeled samples yet.';}
function captureBall(ctx,p,time){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(time*1.8);ctx.beginPath();ctx.arc(0,0,p.r,0,Math.PI*2);ctx.clip();ctx.fillStyle='#fff';ctx.fillRect(-p.r,-p.r,p.r*2,p.r*2);ctx.fillStyle='#e95750';ctx.fillRect(-p.r,-p.r,p.r*2,p.r);ctx.strokeStyle='#102c35';ctx.lineWidth=Math.max(2,p.r*.12);ctx.beginPath();ctx.moveTo(-p.r,0);ctx.lineTo(p.r,0);ctx.stroke();ctx.restore();ctx.save();ctx.translate(p.x,p.y);ctx.beginPath();ctx.arc(0,0,p.r,0,Math.PI*2);ctx.strokeStyle='#102c35';ctx.lineWidth=Math.max(2,p.r*.07);ctx.stroke();ctx.beginPath();ctx.arc(0,0,p.r*.25,0,Math.PI*2);ctx.fillStyle='white';ctx.fill();ctx.stroke();ctx.restore();}
function effect(p){p={...p,r:p.r*Number($('size').value)};const skin=$('skin').value;if(skin==='capture')captureBall(remix,p,video.currentTime);else if(skin==='orb'){remix.save();remix.shadowColor='#83dfc6';remix.shadowBlur=25;const g=remix.createRadialGradient(p.x-p.r*.3,p.y-p.r*.3,1,p.x,p.y,p.r);g.addColorStop(0,'white');g.addColorStop(.4,'#83dfc6');g.addColorStop(1,'#734ce1');remix.fillStyle=g;remix.beginPath();remix.arc(p.x,p.y,p.r,0,Math.PI*2);remix.fill();remix.restore();}else if(skin==='emoji'){remix.save();remix.textAlign='center';remix.textBaseline='middle';remix.font=`${p.r*2.3}px Arial`;remix.fillText('🌝',p.x,p.y);remix.restore();}else if(skin==='custom'&&customImage)remix.drawImage(customImage,p.x-p.r,p.y-p.r,p.r*2,p.r*2);}
function paint(){
  if(video.readyState>=2){
    original.drawImage(video,0,0,input.width,input.height);remix.drawImage(video,0,0,input.width,input.height);
    const t=video.currentTime,p=pointAt(track,t),near=raw.reduce((best,row)=>Math.abs(row.t-t)<.051&&(!best||Math.abs(row.t-t)<Math.abs(best.t-t))?row:best,null);
    if(near)for(const object of near.objects.filter(o=>o.class==='sports ball')){
      original.strokeStyle='#83dfc6';original.lineWidth=3;original.strokeRect(...object.bbox);
      original.fillStyle='#071b25';original.fillRect(object.bbox[0],Math.max(0,object.bbox[1]-24),165,24);
      original.fillStyle='white';original.font='16px Arial';original.fillText(`CNN ball ${object.score.toFixed(2)}`,object.bbox[0]+4,Math.max(18,object.bbox[1]-6));
    }
    if($('trail').checked){
      remix.strokeStyle='#83dfc6';remix.lineWidth=3;let connected=false;remix.beginPath();
      for(const row of track.filter(r=>r.t<=t&&r.t>=t-2)){if(!row.point){connected=false;continue;}remix[connected?'lineTo':'moveTo'](row.point.x,row.point.y);connected=true;}remix.stroke();
    }
    if(p){original.strokeStyle=p.source==='appearance'?'#65b9ff':'#ffdd67';original.lineWidth=3;original.beginPath();original.arc(p.x,p.y,p.r,0,Math.PI*2);original.stroke();effect(p);}
    const origin=p?.source==='appearance'?'Appearance tracker':'CNN';
    const kind=p?.kind==='interpolated'?' · interpolated':p?.kind==='held'?' · brief final hold':'';
    $('tracking').textContent=raw.length?`${p?`${origin}${kind} · center ${Math.round(p.x)}, ${Math.round(p.y)}`:'Ball unavailable / out of view · original stays visible'} | ${track.filter(r=>r.point).length}/${raw.length} samples with a position`:'Analyze the full video to place the effect.';
    for(const label of labels.filter(l=>l.visible&&Math.abs(l.t-t)<.025)){original.strokeStyle='#ea6852';original.lineWidth=3;original.beginPath();original.arc(label.x,label.y,9,0,Math.PI*2);original.stroke();}
    if(!scrubbing)$('time').value=Math.min(t,Number($('time').max));
    $('timeValue').textContent=`${t.toFixed(2)} / ${Number.isFinite(video.duration)?video.duration.toFixed(2):'—'} s`;
  }
  requestAnimationFrame(paint);
}
$('analyze').onclick=async()=>{
  video.pause();const token=++epoch;raw=[];labels=[];analysisComplete=false;analyzedDuration=0;updateTrack();setBusy(true);$('progress').value=0;
  let appearance=null,pending=[];
  try{
    if(video.readyState<2)await new Promise((resolve,reject)=>{video.addEventListener('loadeddata',resolve,{once:true});video.addEventListener('error',reject,{once:true});});
    status('Loading the bundled CNN… first run may take a moment.');await loadModel();if(token!==epoch)return;
    const times=sampleTimes(video.duration,FPS);analyzedDuration=video.duration;$('progress').max=times.length;
    appearanceInput.width=160;appearanceInput.height=Math.max(1,Math.round(160*input.height/input.width));
    for(let i=0;i<times.length;i++){
      if(token!==epoch)return;const t=times[i];await seek(t);if(token!==epoch)return;
      await new Promise(resolve=>setTimeout(resolve,0));if(token!==epoch)return;
      input.getContext('2d').drawImage(video,0,0,input.width,input.height);
      const side=Math.ceil(Math.max(input.width,input.height)*1.3),dx=(side-input.width)/2,dy=(side-input.height)/2;
      cnnInput.width=cnnInput.height=side;const c=cnnInput.getContext('2d');c.fillStyle='#000';c.fillRect(0,0,side,side);c.drawImage(input,dx,dy);
      const objects=(await model.detect(cnnInput,100,.2)).map(o=>({...o,bbox:[o.bbox[0]-dx,o.bbox[1]-dy,o.bbox[2],o.bbox[3]]}));if(token!==epoch)return;
      const row={t,objects};raw.push(row);
      const ac=appearanceInput.getContext('2d',{willReadFrequently:true});ac.drawImage(input,0,0,appearanceInput.width,appearanceInput.height);
      const image=ac.getImageData(0,0,appearanceInput.width,appearanceInput.height);
      const anchor=chooseBall(objects,null,.35);
      if(!appearance&&anchor)appearance=learnBallAppearance(image,anchor.bbox,input.width,input.height);
      if(appearance){
        for(const past of pending)past.row.appearance=appearanceBall(past.image,appearance,input.width,input.height);
        pending=[];row.appearance=appearanceBall(image,appearance,input.width,input.height);
      }else{
        pending.push({row,image});if(pending.length>FPS*30)pending.shift();
      }
      $('progress').value=i+1;
      status(`Analyzing full video · ${t.toFixed(2)} / ${video.duration.toFixed(2)} s · sample ${i+1}/${times.length}`);
    }
    analysisComplete=true;updateTrack();await seek(0);
    const counts=coverageCounts(track);
    status(`Full ${video.duration.toFixed(2)} s analyzed · ${counts.cnn} CNN samples + ${counts.appearance} appearance-tracked + ${counts.missing} without a position · ${tf.getBackend()} backend. Play the full video; unavailable positions remain unfilled.`);
  }catch(e){status(`Analysis stopped: ${e.message||'Video unavailable'}`);}
  finally{setBusy(false);updateTrack();if(token!==epoch)status('Analysis canceled. Partial results are ready; Analyze full video restarts cleanly.');}
};
$('cancel').onclick=()=>{epoch++;video.pause();$('cancel').disabled=true;status('Canceling… waiting for the current CNN call to finish.');};
$('play').onclick=async()=>{try{if(video.ended||video.currentTime>=videoEnd(video.duration))await seek(0);await video.play();}catch(e){status(`Playback could not start: ${e.message}`);}};
$('pause').onclick=()=>video.pause();$('reset').onclick=async()=>{video.pause();await seek(0);};
// Playback ends at the real media end; no ten-second pause or truncation.
$('time').oninput=()=>{scrubbing=true;video.pause();};$('time').onchange=async()=>{const t=nearestSampleTime(Number($('time').value));try{await seek(t);}catch(e){status(e.message);}finally{scrubbing=false;}};
$('threshold').oninput=$('smooth').oninput=updateTrack;$('visualTracking').onchange=updateTrack;
function dimensions(){
  const width=Math.min(960,video.videoWidth||960),height=Math.round(width*(video.videoHeight||540)/(video.videoWidth||960));
  for(const canvas of [input,$('original'),$('remix')]){canvas.width=width;canvas.height=height;}
  if(Number.isFinite(video.duration)&&video.duration>0)$('time').max=videoEnd(video.duration);
  updateTrack();
}
video.addEventListener('loadedmetadata',dimensions);
video.addEventListener('error',()=>status('The video could not load. Keep the local assets folder, or choose a supported local MP4.'));
function changeSource(url,name){
  epoch++;video.pause();raw=[];track=[];labels=[];analysisComplete=false;analyzedDuration=0;source=name;video.src=url;video.load();$('time').value=0;updateTrack();
  for(const button of document.querySelectorAll('[data-clip]'))button.setAttribute('aria-pressed',String(url.endsWith('/'+button.dataset.clip+'.mp4')));
  $('selectedClip').textContent=name;status('Video selected. Analyze full video processes its entire duration.');$('play').disabled=true;
}
$('cnn').onchange=()=>{model?.dispose();model=null;modelPromise=null;raw=[];track=[];labels=[];analysisComplete=false;updateTrack();$('play').disabled=true;status('CNN changed. Analyze the selected clip again to compare.');};$('upload').onchange=()=>{const file=$('upload').files[0];if(!file)return;if(videoURL)URL.revokeObjectURL(videoURL);videoURL=URL.createObjectURL(file);changeSource(videoURL,file.name);};$('size').oninput=()=>{$('sizeValue').textContent=Number($('size').value).toFixed(2)+'×';};$('clip').onchange=()=>{if(videoURL)URL.revokeObjectURL(videoURL);videoURL=null;changeSource('assets/'+$('clip').value+'.mp4',$('clip').selectedOptions[0].textContent);};$('sample').onclick=()=>{if(videoURL)URL.revokeObjectURL(videoURL);videoURL=null;changeSource('assets/'+$('clip').value+'.mp4',$('clip').selectedOptions[0].textContent);};
for(const button of document.querySelectorAll('[data-clip]'))button.onclick=()=>{
  $('clip').value=button.dataset.clip;if(videoURL)URL.revokeObjectURL(videoURL);videoURL=null;
  changeSource('assets/'+button.dataset.clip+'.mp4',button.querySelector('strong').textContent);
};
$('artwork').onchange=()=>{const file=$('artwork').files[0];if(!file)return;if(customURL)URL.revokeObjectURL(customURL);customURL=URL.createObjectURL(file);const image=new Image();image.onload=()=>{customImage=image;$('skin').value='custom';};image.onerror=()=>status('That artwork could not be decoded. Try PNG or JPEG.');image.src=customURL;};
function nearestSampleTime(current){return raw.length?raw.reduce((best,row)=>Math.abs(row.t-current)<Math.abs(best-current)?row.t:best,raw[0].t):Math.min(Number($('time').max),Math.round(current*FPS)/FPS);}
async function labelTime(){video.pause();const t=nearestSampleTime(video.currentTime);await seek(t);return t;}
$('original').onclick=async event=>{if(!$('labelMode').checked||busy)return;if(!video.paused||Math.abs(video.currentTime-nearestSampleTime(video.currentTime))>.025){status('Pause and select a sampled time before clicking the ball center.');return;}const rect=$('original').getBoundingClientRect(),x=(event.clientX-rect.left)*input.width/rect.width,y=(event.clientY-rect.top)*input.height/rect.height;try{const t=await labelTime();labels=labels.filter(l=>l.t!==t);labels.push({t,x,y,visible:true});metrics();}catch(e){status(e.message);}};
$('absent').onclick=async()=>{try{const t=await labelTime();labels=labels.filter(l=>l.t!==t);labels.push({t,visible:false});metrics();}catch(e){status(e.message);}};$('clearLabels').onclick=()=>{labels=[];metrics();};
function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=()=>download('ball-remix-results.json',JSON.stringify({source,model:'COCO-SSD '+$('cnn').value+' pretrained',sampleStep:1/FPS,videoDuration:video.duration,analyzedDuration,analysisComplete,appearanceTracking:$('visualTracking').checked,positionSources:coverageCounts(track),threshold:Number($('threshold').value),smoothing:Number($('smooth').value),replacementScale:Number($('size').value),preprocessing:'centered black square padding, side 1.3 x largest image dimension',dimensions:[input.width,input.height],raw,trajectory:track,labels,metrics:annotationMetrics(labels,track,Math.hypot(input.width,input.height))},null,2),'application/json');
$('snapshot').onclick=()=>{const a=document.createElement('a');a.download='ball-remix-frame.png';a.href=$('remix').toDataURL('image/png');a.click();};
window.addEventListener('pagehide',()=>{epoch++;video.pause();model?.dispose();if(videoURL)URL.revokeObjectURL(videoURL);if(customURL)URL.revokeObjectURL(customURL);});if(video.readyState>=1)dimensions();paint();
