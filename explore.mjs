import {canPaint,currentTwist} from './party.mjs';
import {convolve,relu,pool,pinchRatio,cameraBrush} from './vision-lab.mjs';
import {requestCamera,cameraError} from './camera.mjs';
import {loadVision} from './model-loader.mjs';
const $=id=>document.getElementById(id), kernels={vertical:[[-1,0,1],[-1,0,1],[-1,0,1]],horizontal:[[-1,-1,-1],[0,0,0],[1,1,1]],blur:Array.from({length:3},()=>[1/9,1/9,1/9])};
let image=[],selected=[0,0];
const format=n=>Number(n.toFixed(2)).toString();
function grid(id,values,click){
  const box=$(id),width=values[0].length;
  const activeIndex=[...box.children].indexOf(document.activeElement);
  let focusIndex=activeIndex>=0?activeIndex:Number(box.dataset.focusIndex||0);
  focusIndex=Math.max(0,Math.min(values.length*width-1,focusIndex));
  box.replaceChildren();box.style.gridTemplateColumns=`repeat(${width},1fr)`;
  function focusCell(index){
    focusIndex=index;box.dataset.focusIndex=String(index);
    [...box.children].forEach((cell,i)=>{cell.tabIndex=i===index?0:-1;});
    box.children[index].focus({preventScroll:true});
  }
  values.forEach((row,y)=>row.forEach((value,x)=>{
    const index=y*width+x,cell=document.createElement(click?'button':'span');cell.textContent=format(value);
    if(id==='pixels'){cell.setAttribute('aria-label',`Pixel row ${y+1}, column ${x+1}`);cell.setAttribute('aria-pressed',String(value===1));}
    else{cell.style.background=value<0?'#ffe0cc':`rgba(8,126,128,${Math.min(.85,.08+Math.abs(value)/4)})`;if(click)cell.setAttribute('aria-label',`Response row ${y+1}, column ${x+1}: ${format(value)}`);}
    if(id==='response'&&y===selected[0]&&x===selected[1])cell.classList.add('selected');
    if(click){
      cell.type='button';cell.tabIndex=index===focusIndex?0:-1;
      cell.onclick=()=>{box.dataset.focusIndex=String(index);click(y,x);};
      cell.onkeydown=event=>{
        let next=index;
        if(event.key==='ArrowLeft')next=y*width+Math.max(0,x-1);
        else if(event.key==='ArrowRight')next=y*width+Math.min(width-1,x+1);
        else if(event.key==='ArrowUp')next=Math.max(0,y-1)*width+x;
        else if(event.key==='ArrowDown')next=Math.min(values.length-1,y+1)*width+x;
        else if(event.key==='Home')next=event.ctrlKey?0:y*width;
        else if(event.key==='End')next=event.ctrlKey?values.length*width-1:y*width+width-1;
        else return;
        event.preventDefault();focusCell(next);
      };
    }
    box.append(cell);
  }));
  if(click&&activeIndex>=0)focusCell(focusIndex);
}
function render(){const k=kernels[$('filter').value],raw=convolve(image,k),out=$('relu').checked?relu(raw):raw;grid('pixels',image,(y,x)=>{image[y][x]=1-image[y][x];render();});grid('kernel',k);grid('response',out,(y,x)=>{selected=[y,x];render();});grid('pool',pool(out));const [y,x]=selected,terms=k.flatMap((row,dy)=>row.map((w,dx)=>`${image[y+dy][x+dx]} × ${format(w)}`));$('calculation').textContent=`Patch (${y+1}, ${x+1}): ${terms.join(' + ')} = ${format(raw[y][x])}${$('relu').checked?` → ReLU: ${format(out[y][x])}`:''}`;}
for(const name of ['vertical','horizontal','checker','blank'])$(name).onclick=()=>{image=Array.from({length:8},(_,y)=>Array.from({length:8},(_,x)=>name==='vertical'?Number(x>=4):name==='horizontal'?Number(y>=4):name==='checker'?(x+y)%2:0));render();};
$('filter').onchange=$('relu').onchange=render;$('vertical').click();
const art=$('art').getContext('2d'),pointer=$('pointer').getContext('2d'),tracking=$('tracking').getContext('2d');
let stream=null,model=null,epoch=0,frame=0,previous=null,mouseDown=false,lastVideo=-1;
let erasing=false,palmSince=null;
$('eraser').onclick=()=>{erasing=!erasing;previous=null;$('eraser').setAttribute('aria-pressed',String(erasing));$('eraser').setAttribute('aria-label',erasing?'Eraser on · switch to pen':'Eraser off · switch to eraser');};
$('brushSize').onchange=$('ink').onchange=()=>{previous=null;};
function brush(x,y,down){
  if(currentTwist()==='mirror')x=800-x;
  down=down&&canPaint();const size=Number($('brushSize').value)*(erasing?3:1);
  pointer.clearRect(0,0,800,600);pointer.beginPath();pointer.arc(x,y,down?size/2:9,0,Math.PI*2);pointer.strokeStyle=erasing?'#ea6852':$('ink').value;pointer.lineWidth=3;pointer.stroke();
  if(down){art.save();art.globalCompositeOperation=erasing?'destination-out':'source-over';art.strokeStyle=$('ink').value;art.fillStyle=$('ink').value;art.lineWidth=size;art.lineCap='round';art.beginPath();art.moveTo(previous?.x??x,previous?.y??y);art.lineTo(x,y);art.stroke();art.beginPath();art.arc(x,y,size/2,0,Math.PI*2);art.fill();art.restore();previous={x,y};}else previous=null;
}
const fadeTimer=setInterval(()=>{if(currentTwist()==='vanish'&&canPaint()){art.save();art.globalCompositeOperation='destination-out';art.fillStyle='rgba(0,0,0,0.05)';art.fillRect(0,0,800,600);art.restore();}},100);
window.addEventListener('pagehide',()=>clearInterval(fadeTimer));

function stop(){palmSince=null;epoch++;cancelAnimationFrame(frame);stream?.getTracks().forEach(t=>t.stop());stream=null;model?.close();model=null;$('video').srcObject=null;previous=null;lastVideo=-1;pointer.clearRect(0,0,800,600);tracking.clearRect(0,0,640,480);$('start').disabled=false;$('stop').disabled=true;$('seen').textContent='Camera is off';$('status').textContent='Mouse / touch mode: drag on the board.';}
const connections=[[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]];
function tick(){try{if(model&&$('video').readyState>=2&&$('video').currentTime!==lastVideo){lastVideo=$('video').currentTime;const result=model.recognizeForVideo($('video'),performance.now()),p=result.landmarks[0];tracking.clearRect(0,0,640,480);if(p){tracking.strokeStyle='#96e3cb';tracking.lineWidth=3;for(const chain of connections){tracking.beginPath();chain.forEach((i,j)=>tracking[j?'lineTo':'moveTo']((1-p[i].x)*640,p[i].y*480));tracking.stroke();}for(const point of p){tracking.beginPath();tracking.arc((1-point.x)*640,point.y*480,4,0,Math.PI*2);tracking.fillStyle='#ea6852';tracking.fill();}let down=pinchRatio(p)<.35;if($('gestureEraser').checked){const g=result.gestures[0]?.[0];const state=cameraBrush(g?.categoryName,g?.score||0,down,performance.now(),palmSince);palmSince=state.palmSince;const erase=state.tool==='eraser';if(erase!==erasing)$('eraser').click();down=state.down;$('toolCue').textContent=!canPaint()?'Round paused · brush lifted':erase?(down?'OPEN PALM · erasing':'Hold your palm steady · preparing eraser'):'Pinch to draw · open palm to erase';}brush((1-p[8].x)*800,p[8].y*600,down);$('seen').textContent=`Hand found · ${!canPaint()?'round paused':down?(erasing?($('gestureEraser').checked?'PALM / erasing':'PINCH / erasing'):'PINCH / painting'):'brush lifted'} · ${result.gestures[0]?.[0]?.categoryName||'no gesture label'}`;}else{palmSince=null;previous=null;pointer.clearRect(0,0,800,600);$('seen').textContent='No hand found · painting paused';}}frame=requestAnimationFrame(tick);}catch(e){stop();$('status').textContent=`Tracking stopped: ${e.message}. Retry Start camera.`;}}
$('start').onclick=async()=>{const token=++epoch;$('start').disabled=true;$('stop').disabled=false;$('status').textContent='Allow the camera prompt. Loading the local hand model…';try{const captured=await requestCamera(navigator.mediaDevices);if(token!==epoch){captured.getTracks().forEach(t=>t.stop());return;}stream=captured;$('video').srcObject=stream;await $('video').play();const {FilesetResolver,GestureRecognizer}=await loadVision();if(token!==epoch)return;const files=await FilesetResolver.forVisionTasks(new URL('./vendor/wasm',import.meta.url).href);const created=await GestureRecognizer.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('./vendor/gesture_recognizer.task',import.meta.url).href,delegate:'CPU'},runningMode:'VIDEO',numHands:1});if(token!==epoch){created.close();return;}model=created;previous=null;$('status').textContent='Camera mode: point to aim; pinch to paint. Separate fingers to lift.';tick();}catch(e){if(token===epoch){stop();$('status').textContent=cameraError(e);}}};
$('stop').onclick=$('mouse').onclick=stop;window.addEventListener('pagehide',stop);
function mouse(e){if(stream||$('start').disabled)return;const r=$('art').getBoundingClientRect();brush((e.clientX-r.left)*800/r.width,(e.clientY-r.top)*600/r.height,mouseDown);}
$('art').onpointerdown=e=>{if(stream||$('start').disabled)return;mouseDown=true;$('art').setPointerCapture(e.pointerId);mouse(e);};$('art').onpointermove=mouse;$('art').onpointerup=$('art').onpointercancel=()=>{mouseDown=false;previous=null;};
$('clear').onclick=()=>{art.clearRect(0,0,800,600);pointer.clearRect(0,0,800,600);previous=null;if(erasing)$('eraser').click();};$('save').onclick=()=>{const output=document.createElement('canvas');output.width=800;output.height=600;const ctx=output.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,800,600);ctx.drawImage($('art'),0,0);const a=document.createElement('a');a.download='air-art.png';a.href=output.toDataURL('image/png');a.click();};
