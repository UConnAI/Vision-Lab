import {parsePositions} from './csv-core.mjs';
import {setupTinyCNN} from './tiny-cnn.mjs';
import {setupSticker} from './stickers.mjs';
const $=id=>document.getElementById(id),video=$('video'),canvas=$('canvas'),ctx=canvas.getContext('2d');
const samples={
  juggling:{video:'../take-home-football-tracker/assets/soccer-juggling.mp4',csv:'data/juggling.csv',fps:24,frames:346,description:'Longer soccer-juggling clip: actual CNN and CNN-seeded appearance measurements, with labeled interpolation. Kicks, changes in height and brief occlusion make this a more varied test. Missing positions remain gaps; estimates are not ground truth.'},
  basketball:{video:'../take-home-football-tracker/assets/basketball-long.mp4',csv:'data/basketball.csv',fps:24,frames:424,description:'Longer basketball challenge: actual CNN and CNN-seeded color measurements, with explicitly labeled interpolation. Fast dribbling and occlusion cause many missing positions. These estimates are not ground truth.'},
  soccer:{video:'../take-home-football-tracker/assets/single-ball.mp4',csv:'data/soccer.csv',fps:24,frames:179,description:'Soccer coordinates come from sampled CNN detections in the separate demo, with explicitly identified interpolation onto the original frame clock. CSV mode reads and draws that supplied file; the coordinates are estimates, not manual ground truth.'},
  pingpong:{video:'../take-home-football-tracker/assets/ping-pong.mp4',csv:'data/ping-pong.csv',fps:24,frames:158,description:'Ping-pong coordinates are measured orange connected components from each frame. Missing estimates preserve paddle occlusion and out-of-view intervals. This is a simple color rule, not a CNN, and similar colors can produce mistakes.'}
};
let positions=new Map(),fps=24,totalFrames=179,loadVersion=0,videoURL=null,latestPresentedTime=null;
const tiny=setupTinyCNN({video,getPositions:()=>positions,getFPS:()=>fps,onChange:draw});
const customSticker=setupSticker(draw);

function setPositions(text){
  const parsed=parsePositions(text);positions=parsed;$('csvText').value=text;
  $('previewStatus').textContent=`Loaded ${parsed.size} frame-keyed rows. ${[...parsed.values()].filter(row=>row.visible).length} rows contain a position. CSV mode uses supplied positions; small CNNs are optional below.`;
  draw();
}
function currentFrame(){
  const time=latestPresentedTime??video.currentTime;
  // Browsers can round a seek timestamp to microseconds (157/24 -> 6.541666).
  // Allow 0.001 of a frame so that rounding cannot select the previous row.
  return Math.max(0,Math.min(totalFrames-1,Math.floor(time*fps+1e-3)));
}
function point(row){
  if(!row?.visible||row.x<0||row.y<0||row.x>=canvas.width||row.y>=canvas.height)return null;
  return row;
}
function captureBall(p,radius){
  ctx.save();ctx.translate(p.x,p.y);ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.clip();ctx.fillStyle='#f6f6f6';ctx.fillRect(-radius,-radius,2*radius,2*radius);ctx.fillStyle='#e34b43';ctx.fillRect(-radius,-radius,2*radius,radius);ctx.strokeStyle='#152d35';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-radius,0);ctx.lineTo(radius,0);ctx.stroke();ctx.restore();ctx.strokeStyle='#152d35';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,Math.max(3,radius/4),0,Math.PI*2);ctx.fillStyle='#f6f6f6';ctx.fill();ctx.stroke();
}
function rockSticker(p,radius){
  ctx.save();ctx.translate(p.x,p.y);ctx.scale(radius,radius);
  const outline=[[-.98,.12],[-.7,-.55],[-.08,-.93],[.64,-.64],[.99,.04],[.69,.73],[-.39,.89]];
  const polygon=(points,fill)=>{ctx.beginPath();points.forEach(([x,y],i)=>ctx[i?'lineTo':'moveTo'](x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();};
  ctx.shadowColor='#10252b77';ctx.shadowBlur=.15;ctx.shadowOffsetY=.08;polygon(outline,'#777f8b');ctx.shadowColor='transparent';
  ctx.lineJoin='round';ctx.lineWidth=.09;ctx.strokeStyle='#fff';ctx.stroke();
  polygon([outline[0],outline[1],outline[2],[-.12,-.05]],'#b5bdc9');
  polygon([outline[2],outline[3],outline[4],[-.12,-.05]],'#929dac');
  polygon([outline[4],outline[5],outline[6],[-.12,-.05]],'#535d6d');
  polygon([outline[0],[-.12,-.05],outline[6]],'#818a98');
  ctx.strokeStyle='#3f495a';ctx.lineWidth=.025;ctx.beginPath();ctx.moveTo(-.45,-.28);ctx.lineTo(-.12,-.05);ctx.lineTo(.3,.08);ctx.stroke();ctx.restore();
}
function draw(){
  if(video.readyState<2)return;
  if(canvas.width!==video.videoWidth||canvas.height!==video.videoHeight){canvas.width=video.videoWidth;canvas.height=video.videoHeight;}
  ctx.drawImage(video,0,0,canvas.width,canvas.height);
  const frame=currentFrame(),length=Number($('trailLength').value),history=Array.from({length},(_,i)=>point(positions.get(frame-i)));
  $('scrub').max=Math.max(0,totalFrames-1);$('scrub').value=frame;
  ctx.strokeStyle='#ffc328';ctx.lineWidth=3;ctx.beginPath();
  for(let i=0;!tiny.isActive()&&i<history.length-1;i++){const a=history[i],b=history[i+1];if(a&&b){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}}
  ctx.stroke();
  for(const [i,p]of history.entries())if(p&&!tiny.isActive()){ctx.fillStyle='#ff643f';ctx.beginPath();ctx.arc(p.x,p.y,Math.max(2,5-Math.floor(i/3)),0,Math.PI*2);ctx.fill();}
  const row=positions.get(frame),current=tiny.isActive()?tiny.estimate():point(row);
  if(current&&$('effect').value==='capture')captureBall(current,Number($('radius').value));
  if(current&&$('effect').value==='rock')rockSticker(current,Number($('radius').value));
  if(current&&$('effect').value==='custom')customSticker.draw(ctx,current,Number($('radius').value));
  $('trailValue').textContent=`${length} frames · ${(length/fps).toFixed(2)} s`;
  $('radiusValue').textContent=`${$('radius').value} px`;
  $('frameInfo').textContent=`Frame ${frame} / ${Math.max(0,totalFrames-1)} · ${video.currentTime.toFixed(2)} / ${Number.isFinite(video.duration)?video.duration.toFixed(2):'…'} s\n${current?`${tiny.isActive()?'CNN estimate':'CSV position'} (${current.x.toFixed(1)}, ${current.y.toFixed(1)}) · ${tiny.isActive()?current.source:row.source}`:row?.visible?'CSV coordinate is outside this video; no point drawn.':'No position for this frame. The line breaks here.'}`;
}
async function chooseSample(name){
  const sample=samples[name],version=++loadVersion;video.pause();latestPresentedTime=null;
  tiny.clear();$('radius').value=name==='soccer'?200:name==='juggling'?95:name==='basketball'?105:65;
  if(videoURL){URL.revokeObjectURL(videoURL);videoURL=null;}
  positions=new Map();fps=sample.fps;totalFrames=sample.frames;$('fps').value=fps;
  video.src=sample.video;video.load();$('sampleDescription').textContent=sample.description;$('csvDownload').href=sample.csv;
  for(const button of document.querySelectorAll('[data-sample]')){const selected=button.dataset.sample===name;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));}
  $('previewStatus').textContent='Loading the local sample and CSV…';
  try{const response=await fetch(sample.csv);if(!response.ok)throw new Error(`CSV returned HTTP ${response.status}.`);const text=await response.text();if(version===loadVersion)setPositions(text);}catch(error){if(version===loadVersion)$('previewStatus').textContent=`Sample could not load: ${error.message}`;}
}
for(const button of document.querySelectorAll('[data-sample]'))button.onclick=()=>chooseSample(button.dataset.sample);
$('play').onclick=async()=>{try{if(video.ended)video.currentTime=0;await video.play();}catch(error){$('previewStatus').textContent=error.message;}};
$('pause').onclick=()=>video.pause();$('restart').onclick=()=>{video.pause();latestPresentedTime=null;video.currentTime=0;draw();};
$('scrub').oninput=()=>{video.pause();latestPresentedTime=null;
  // Seek inside the requested frame, avoiding a rounded boundary decoding its predecessor.
  video.currentTime=Math.min((Number($('scrub').value)+0.25)/fps,video.duration-0.000001);
};
for(const id of ['trailLength','radius','effect'])$(id).oninput=draw;
$('fps').onchange=()=>{const value=Number($('fps').value);if(!Number.isFinite(value)||value<=0){$('previewStatus').textContent='Use a positive CSV frame rate.';return;}tiny.clear();fps=value;totalFrames=Math.max(1,Math.round(video.duration*fps));draw();};
$('applyCSV').onclick=()=>{try{const text=$('csvText').value;parsePositions(text);tiny.clear();setPositions(text);}catch(error){$('previewStatus').textContent=error.message;}};
$('csvUpload').onchange=async()=>{const file=$('csvUpload').files[0];if(!file)return;try{const text=await file.text();parsePositions(text);tiny.clear();setPositions(text);}catch(error){$('previewStatus').textContent=error.message;}};
$('videoUpload').onchange=()=>{const file=$('videoUpload').files[0];if(!file)return;loadVersion++;tiny.clear();video.pause();if(videoURL)URL.revokeObjectURL(videoURL);videoURL=URL.createObjectURL(file);positions=new Map();$('csvText').value='';latestPresentedTime=null;video.src=videoURL;video.load();$('previewStatus').textContent='Custom video loaded. Choose its matching CSV and frame rate.';$('sampleDescription').textContent=`Your local video: ${file.name}. Existing positions were cleared.`;for(const button of document.querySelectorAll('[data-sample]')){button.classList.remove('selected');button.setAttribute('aria-pressed','false');}};
video.addEventListener('loadedmetadata',()=>{canvas.width=video.videoWidth;canvas.height=video.videoHeight;totalFrames=Math.max(1,Math.round(video.duration*fps));draw();});
video.addEventListener('seeked',()=>{latestPresentedTime=null;draw();});video.addEventListener('loadeddata',draw);
video.addEventListener('ended',()=>{latestPresentedTime=null;draw();});
if(video.requestVideoFrameCallback){const presented=(_now,metadata)=>{latestPresentedTime=metadata.mediaTime;draw();video.requestVideoFrameCallback(presented);};video.requestVideoFrameCallback(presented);}else{const tick=()=>{latestPresentedTime=null;draw();requestAnimationFrame(tick);};requestAnimationFrame(tick);}
async function showSource(){const file=$('sourceFile').value;$('sourceDownload').href=file;try{const response=await fetch(file);if(!response.ok)throw new Error(`HTTP ${response.status}`);$('pythonSource').textContent=await response.text();}catch(error){$('pythonSource').textContent=`Python source could not load: ${error.message}`;}}
$('sourceFile').onchange=showSource;void showSource();void chooseSample('soccer');
window.addEventListener('pagehide',()=>{video.pause();if(videoURL)URL.revokeObjectURL(videoURL);});
