import {assessEarlyEvidence} from './early-evidence.mjs';
import {LABELS,counter,outcome,openness,train,predict,evaluate,simulated,currentGesture,pretrainedGesture,demoRows,pacedMotion,fingerMovement} from './core.mjs';
import {drawCartoon} from './cartoon.mjs';
import {requestCamera,cameraError} from './camera.mjs';
import {drawFinger} from './finger-view.mjs';
import {loadVision} from './model-loader.mjs';
const $=id=>document.getElementById(id);
let source='camera', stream=null, detector=null, rows=[], tests=[], model=null, samples=[], round=null, pending=null, sequence=0, loading=false, cameraEpoch=0, lastVideoTime=-1, lastValues=[0.28,0.28,0.28,0.28], visibleGesture='unclear', trackingReady=false, observedCategory=null;
const ctx=$('canvas').getContext('2d');
let decisionTimer=null;
function dismissDecision(){clearTimeout(decisionTimer);$('decisionOverlay').hidden=true;}
function showDecision(guess,label=null,evidence=null){
  dismissDecision();coach('',guess?'Round complete · see the computer’s move':'No prediction · check the evidence',guess?'The result is shown in the large window.':evidence?.message||'Inspect the early-evidence report before retrying.');
  const move=guess?counter(guess):null;
  $('decisionHand').hidden=!move;
  if(move)drawCartoon($('decisionHand').getContext('2d'),simulated(3000,move,false),false,'COMPUTER’S MOVE');
  $('decisionHand').setAttribute('aria-label',move?`Computer hand showing ${move}`:'No valid decision');
  $('decisionMove').textContent=move?move.toUpperCase():'NO DECISION';
  $('decisionOutcome').textContent=label&&move?outcome(move,label):move?'Decision locked before SHOW':'Round could not be scored';
  $('decisionDetail').textContent=label&&move?`You showed ${label.toUpperCase()}. Early guess: ${guess.toUpperCase()} · ${guess===label?'correct':'incorrect'}.`:move?`Early guess: ${guess.toUpperCase()}. Confirm your actual move below to score the round.`:evidence?.message||'No valid early evidence was available. Inspect the report before retrying.';
  $('decisionOverlay').hidden=false;
  decisionTimer=setTimeout(dismissDecision,5000);
}
$('dismissDecision').onclick=dismissDecision;
document.addEventListener('keydown',e=>{if(e.key==='Escape')dismissDecision();});
const edges=[[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]];
const fingerHistory=[[],[],[],[]];let lastFingerTime=0;
$('bars').innerHTML=['Index','Middle','Ring','Little'].map((s,i)=>`<article class="fingerCard"><h3>${s}</h3><canvas id="finger${i}" width="220" height="200" aria-label="${s} finger illustration and recent movement"></canvas><label>${s} straightness<meter id="bar${i}" min="0" max="1" value="0"></meter></label><strong id="value${i}">—</strong><span id="fingerState${i}">No tracking</span></article>`).join('');
function updateFingers(v,t=performance.now()){
  const record=t-lastFingerTime>=70;if(record)lastFingerTime=t;
  for(let i=0;i<4;i++){
    if(!v)fingerHistory[i]=[];
    else if(record){fingerHistory[i].push({t,v:v[i]});fingerHistory[i]=fingerHistory[i].filter(p=>t-p.t<=2000);}
    $('bar'+i).value=v?v[i]:0;$('value'+i).textContent=v?v[i].toFixed(2):'—';
    const recent=fingerHistory[i].filter(p=>t-p.t<=300),delta=recent.length>1?recent.at(-1).v-recent[0].v:0;
    $('fingerState'+i).textContent=v?(delta>.08?'Moving · opening':delta<-.08?'Moving · curling':v[i]>=.8?'Straight':v[i]<.65?'Curled':'Partly open'):'No tracking';
    drawFinger($('finger'+i).getContext('2d'),v?v[i]:null,fingerHistory[i].map(p=>p.v));
  }
}
function coach(phase,title,help,progress=0){
  $('roundCoach').classList.toggle('running',!!round||!!pending);$('coachTitle').textContent=title;$('coachHelp').textContent=help;$('phaseProgress').value=progress;
  ['Ready','Move','Hold','Confirm'].forEach(p=>$('phase'+p).classList.toggle('active',p===phase));syncScreen();
}
function hideLabels(){if($('labelArea').open)$('labelArea').close();}
function showLabels(){
  if(!pending.x&&pending.purpose==='test'&&!pending.invalidRecorded){tests.push({source:pending.source,label:null,guess:null,x:null,lead:pending.lead,movementMs:pending.movementMs,frames:samples.length,movement:fingerMovement(samples,pending.cutoff),invalid:true,quality:pending.evidence?.quality||null});pending.invalidRecorded=true;report();}
  const movement=fingerMovement(samples,pending.cutoff);
  const observed=movement.names.length?`${movement.names.join(' + ')} moved.`:movement.available?'No clear finger change in the captured early frames.':'No finger movement could be measured in the early frames.';
  $('labelTitle').textContent=pending.x?'What did you actually show?':'Finger movement · no prediction';
  $('labelPrompt').textContent=pending.x?`The current recognizer suggests ${visibleGesture.toUpperCase()}. Choose the gesture YOU made; your answer ${pending.purpose==='train'?'labels this training example':'scores this round'}.`:`${observed} ${pending.evidence?.message||'There was not enough fresh tracking for a prediction.'} You can still watch which fingers move in the large panel.`;
  document.querySelectorAll('[data-label]').forEach(b=>b.disabled=!pending.x);
  $('gestureChoices').hidden=!pending.x;$('movementSummary').hidden=!!pending.x;
  $('movementSummary').innerHTML=['Index','Middle','Ring','Little'].map(name=>`<div class="${movement.names.includes(name)?'moving':'quiet'}"><strong>${name}</strong><span>${movement.names.includes(name)?'Movement observed':movement.available?'No clear change':'Not measured'}</span></div>`).join('');
  $('labelFeedback').textContent=pending.x?'The suggestion may be wrong. Your own label is the answer.':'Movement observations are still useful. This attempt has no valid training vector or scored prediction.';
  $('labelStop').hidden=source!=='camera';
  coach('Confirm',pending.x?'CONFIRM · choose your final gesture':'MOVEMENT OBSERVED',pending.x?'Use the large gesture choices to label your final move.':observed,1);
  $('labelArea').showModal();
}
document.querySelectorAll('[data-label]').forEach(b=>drawCartoon(b.querySelector('canvas').getContext('2d'),simulated(3000,b.dataset.label),false,b.dataset.label.toUpperCase()));

let expandedView=false,nativeView=false;
const overlayHomes=[$('decisionOverlay'),$('labelArea')].map(element=>({element,parent:element.parentNode,next:element.nextSibling}));
function syncScreen(){
  $('screenTitle').textContent=$('coachTitle').textContent;$('screenHelp').textContent=$('coachHelp').textContent;
  $('screenTracking').textContent=$('trackingHint').textContent;$('screenPrediction').textContent=$('prediction').textContent;
  $('screenPlay').disabled=$('round').disabled;$('screenPlay').textContent=$('round').textContent;
  $('screenStop').disabled=$('stopTop').disabled;
}
function restoreView(){
  expandedView=false;nativeView=false;$('computerView').classList.remove('expanded');
  $('fullscreenView').textContent='Full screen ⛶';$('fullscreenView').setAttribute('aria-pressed','false');
  overlayHomes.forEach(({element,parent,next})=>parent.insertBefore(element,next?.parentNode===parent?next:null));
}
$('fullscreenView').onclick=async()=>{
  if(expandedView){if(document.fullscreenElement=== $('computerView'))await document.exitFullscreen();restoreView();return;}
  expandedView=true;$('computerView').classList.add('expanded');$('fullscreenView').textContent='Exit full screen ×';$('fullscreenView').setAttribute('aria-pressed','true');
  overlayHomes.forEach(({element})=>$('computerView').append(element));syncScreen();
  try{if($('computerView').requestFullscreen){await $('computerView').requestFullscreen();nativeView=true;}}catch{ /* Keep the full-window view when the host denies native fullscreen. */ }
};
document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement=== $('computerView'))nativeView=true;else if(nativeView)restoreView();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&expandedView&&!nativeView&&!$('labelArea').open)restoreView();});
$('screenPlay').onclick=()=>{$('round').onclick();};
$('screenStop').onclick=()=>{$('stopTop').onclick();};
function status(s){$('status').textContent=s;}
function guide(){
  const ready=source==='simulation'||!!stream;
  const remaining=LABELS.find(l=>rows.filter(r=>r.label===l).length<3);
  const step=!ready?1:model?4:remaining?2:3;
  [1,2,3,4].forEach(i=>$('step'+i).classList.toggle('selected',i===step));
  if(source==='camera'&&stream&&!trackingReady){$('nextTitle').textContent='Camera preview is on · hand tracking is not ready yet';$('nextHelp').textContent=loading?'You can already see the live camera. Wait for the locally bundled model to load before recording rounds.':'Read the tracking error above. Click Retry hand tracking below the views, or Stop camera at the top to turn it off.';return;}
  if(pending){$('nextTitle').textContent='Confirm what you showed';$('nextHelp').textContent='Click Rock, Paper, or Scissors below. The visible-hand label is only a suggestion; you supply the correct answer.';return;}
  if(round){$('nextTitle').textContent=round.locked?'Guess locked · finish your move':'Follow READY → MOVE → SHOW';$('nextHelp').textContent='READY: make a fist. MOVE: reveal your chosen gesture. SHOW: hold it still.';return;}
  if(step===1){$('nextTitle').textContent=$('cameraError').hidden?'Start here: turn on your camera':'Camera could not start here · use the recovery steps';$('nextHelp').textContent=$('cameraError').hidden?'Click Start camera and allow camera access. Watch your real video beside the computer’s points and current gesture label.':'Read the error below. If access is denied in this browser, click Open in a regular browser, then allow that browser’s camera prompt.';}
  else if(step===2){const n=rows.filter(r=>r.label===remaining).length;$('nextTitle').textContent=`Next: record ${remaining.toUpperCase()} · example ${n+1} of 3`;$('nextHelp').textContent=source==='simulation'?'Click Record to watch this artificial move. Simulation saves the final label automatically and advances to the next example.':'Click the round button. Start with a fist, open toward this move during MOVE, then hold it at SHOW. Confirm the final move to save the example.';}
  else if(step===3){$('nextTitle').textContent='Your 9 examples are ready · click Train model';$('nextHelp').textContent='Training learns a typical early movement pattern for each move. Then the app switches to Play automatically.';}
  else {$('nextTitle').textContent=source==='simulation'?'Ready to play · choose a simulated move':'Ready to play · choose your move privately';$('nextHelp').textContent=source==='simulation'?'Choose Simulated final move below, then click Play. Watch the current label change while the early guess stays locked. Simulation scores the final move automatically.':'Start a round. The computer locks its early guess and counter-move before SHOW. Confirm your actual move to see who won.';}
  $('round').textContent=($('purpose').value==='test'?'Play a round':`Record ${remaining?remaining.toUpperCase():'another example'}`)+` · ${(Number($('movementDuration').value)/1000).toFixed(1)} s move`;
  $('roundHelp').textContent=model?'Current gesture shows what your hand looks like now. Locked early guess stays fixed even as your hand changes.':'Collect three rounds of each move. During collection, there is no trained early guess yet.';
}
function live(v){
  visibleGesture=source==='camera'?pretrainedGesture(observedCategory):currentGesture(v);
  $('liveTag').textContent=visibleGesture==='unclear'?'UNCLEAR / moving':visibleGesture.toUpperCase();
  $('currentLabel').textContent=`Current gesture: ${visibleGesture.toUpperCase()}${source==='simulation'?' · simulated':''}`;
  const names=['index','middle','ring','little'];
  $('currentReason').textContent=names.map((n,i)=>`${n}: ${v[i]>=0.8?'straight':v[i]<0.65?'curled':'partly open'}`).join(' · ')+(source==='camera'?`. Pretrained model: ${observedCategory?.categoryName||'None'} (${Math.round(100*(observedCategory?.score||0))}% score for the current shape, not the future move).`:'. Simulation uses finger rules; these are artificial measurements.');
}
function noHand(message='No hand detected · show one hand to the camera'){
  visibleGesture='unclear';$('liveTag').textContent='NO HAND';$('currentLabel').textContent=message;$('currentReason').textContent='Keep your palm facing the lens and all fingertips in view. No current-hand label is available.';
  updateFingers(null);$('trackingHint').textContent=message.includes('waiting')||message.includes('off')?'Tracking: waiting for camera and hand.':'Tracking lost · show your palm, keep all fingertips in view, and hold your wrist steady.';syncScreen();
}
function controls(){
  const busy=!!round||!!pending||loading;
  ['round','camera','stop','stopTop','retryTracker','simulation','lead','movementDuration','purpose','simLabel','late','train','reset','export','quick','device','cameraDemo'].forEach(id=>$(id).disabled=busy);
  $('round').disabled=busy||(source==='camera'&&(!stream||!trackingReady))||($('purpose').value==='test'&&!model);
  $('train').disabled=busy||LABELS.some(l=>rows.filter(r=>r.label===l).length<3);
  $('stop').disabled=$('stopTop').disabled=!stream&&!loading;
  $('retryTracker').hidden=!stream||trackingReady;
  $('retryTracker').disabled=busy||!stream;
  $('camera').disabled=busy||!!stream;
  guide();syncScreen();
}
function report(){
  $('counts').textContent='Training: '+LABELS.map(l=>`${l} ${rows.filter(r=>r.label===l).length}`).join(' · ');
  $('modelTag').textContent=model?`${source.toUpperCase()} INPUT / ${model.provenance==='artificial'?'ARTIFICIAL EXAMPLES':'YOUR EXAMPLES'}`:'NO MODEL';
  const e=evaluate(tests);
  $('score').textContent=e.n?`${source==='simulation'?'Artificial simulation only. ':model?.provenance==='artificial'?'Real camera tested with artificial training examples. ':''}Early guesses correct: ${e.correct}/${e.n} (${Math.round(100*e.correct/e.n)}%). Training-majority baseline: ${e.baseline}/${e.n}. Uniform random guessing: 33% expected. Invalid test rounds: ${tests.length-e.n}.`:model?`Ready to play. No scored rounds yet.${tests.length?' Invalid tracking rounds: '+tests.length+'.':''}`:'Collect nine examples, then click Train model to unlock Play.';
  $('matrix').innerHTML=e.n?'<table><caption>Actual move ↓ / frozen guess →</caption><thead><tr><th>Move</th>'+LABELS.map(l=>`<th>${l}</th>`).join('')+'</tr></thead><tbody>'+e.matrix.map((r,i)=>`<tr><th>${LABELS[i]}</th>${r.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')+'</tbody></table>':'';
  controls();
}
function clear(){$('evidenceStatus').textContent='No round checked yet. The report will explain whether early data was usable.';dismissDecision();coach('','Choose your move before you start','READY: fist. MOVE: open once. HOLD: keep it still. Then confirm the gesture you made.');rows=[];tests=[];model=null;samples=[];pending=null;round=null;sequence=0;$('purpose').value='train';hideLabels();$('prediction').textContent='Early guess: —';$('bot').textContent='Computer plays: —';$('timing').textContent='The guess locks before the SHOW cue.';$('roundResult').textContent='';$('modelInfo').textContent='Collect at least 3 rounds of each move, then train.';$('cue').textContent='Ready?';report();}
function stopCamera(){cameraEpoch++;trackingReady=false;loading=false;stream?.getTracks().forEach(t=>t.stop());stream=null;$('video').srcObject=null;lastVideoTime=-1;observedCategory=null;$('cameraDiagnostics').textContent='Camera off · no video frames are being captured.';$('cameraPlaceholder').hidden=false;$('cameraPlaceholder').textContent='Camera off · click Start camera above.';ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);if(source==='camera')noHand('Camera off · click Start camera');}
$('external').onclick=async()=>{
  try{const response=await fetch('/api/open-browser',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const result=await response.json();if(!response.ok)throw new Error(result.error);status(`Opened ${result.browser}. Click Start camera in that window and allow camera access.`);}
  catch(e){status(`Could not open a browser: ${e.message}. Copy this page URL into Chrome or Edge manually.`);}
};
async function startCamera(useDemo=false){
  retryWithDemo=useDemo;
  loading=true;controls();$('cameraError').hidden=true;status('Requesting camera access… allow the browser prompt.');
  const epoch=++cameraEpoch;
  try{
    if(!window.isSecureContext)throw Object.assign(new Error('Use the localhost server or HTTPS.'),{name:'UnsupportedError'});
    const acquired=await requestCamera(navigator.mediaDevices,$('device').value);
    if(epoch!==cameraEpoch){acquired.getTracks().forEach(t=>t.stop());return;}
    stream=acquired;source='camera';$('cartoon').hidden=true;$('inputTitle').textContent='YOUR CAMERA · the input';clear();$('modeTag').textContent='CAMERA PREVIEW';$('simControls').hidden=true;
    $('video').srcObject=stream;
    await Promise.race([$('video').play(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Camera video did not begin playback.')),10000))]);
    if(epoch!==cameraEpoch)return;
    $('cameraPlaceholder').hidden=true;noHand('Camera preview on · hand tracker loading');status('Camera preview is on. Loading hand tracking separately…');
    const width=$('video').videoWidth||640,height=$('video').videoHeight||480;
    $('canvas').width=width;$('canvas').height=height;
    document.querySelectorAll('.stage').forEach(el=>el.style.aspectRatio=`${width}/${height}`);
    let frames=0,lastDiagnostic=0;
    function loop(){
      if(epoch!==cameraEpoch||!stream)return;
      const t=performance.now();
      if($('video').readyState>=2&&$('video').currentTime!==lastVideoTime){
        lastVideoTime=$('video').currentTime;frames++;
        ctx.clearRect(0,0,width,height);ctx.save();ctx.translate(width,0);ctx.scale(-1,1);ctx.drawImage($('video'),0,0,width,height);ctx.restore();
        if(trackingReady){
          try{
            const result=detector.recognizeForVideo($('video'),t);
            observedCategory=result.gestures[0]?.[0]||null;
            if(result.landmarks[0]){const p=result.landmarks[0];lastValues=openness(result.worldLandmarks[0]||p);drawHand(p);ingest(t,lastValues);}else noHand();
          }catch(e){trackingReady=false;detector?.close();detector=null;$('cameraError').hidden=false;$('cameraError').textContent='Camera preview still works, but hand tracking failed: '+e.message;status('Preview continues. Click Retry hand tracking to reload the model.');controls();}
        }
        if(t-lastDiagnostic>1000){lastDiagnostic=t;$('cameraDiagnostics').textContent=`Live camera frames: ${frames} · ${width} × ${height} · hand tracking: ${trackingReady?'ready':'not ready'}`;}
      }
      requestAnimationFrame(loop);
    }
    loop();
    navigator.mediaDevices.enumerateDevices?.().then(devices=>{
      if(epoch!==cameraEpoch)return;
      const selected=stream?.getVideoTracks()[0]?.getSettings().deviceId;
      $('device').replaceChildren(new Option('Default camera',''));
      devices.filter(d=>d.kind==='videoinput').forEach((d,i)=>$('device').add(new Option(d.label||`Camera ${i+1}`,d.deviceId)));
      if(selected)$('device').value=selected;
    }).catch(()=>{});
    await prepareTracker(epoch,useDemo);
  }catch(e){
    if(epoch!==cameraEpoch)return;
    stopCamera();$('modeTag').textContent='CAMERA BLOCKED';$('cameraError').hidden=false;$('cameraError').textContent=cameraError(e);status('Camera did not start. See the error above.');
    if(source==='simulation'){drawSimulation(lastValues);ingest(performance.now(),lastValues);}
    controls();
  }
  if(epoch===cameraEpoch){loading=false;controls();}
};
async function prepareTracker(epoch,useDemo=false){
  if(epoch!==cameraEpoch||!stream)return;
  loading=true;controls();$('cameraError').hidden=true;status('Camera preview continues. Loading hand tracking…');
  try{
    if(!detector){
      const {FilesetResolver,GestureRecognizer}=await loadVision();
      if(epoch!==cameraEpoch||!stream)return;
      const files=await FilesetResolver.forVisionTasks(new URL('./vendor/wasm',import.meta.url).href);
      const created=await GestureRecognizer.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('./vendor/gesture_recognizer.task',import.meta.url).href,delegate:'CPU'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:0.6,minHandPresenceConfidence:0.6,minTrackingConfidence:0.6});
      if(epoch!==cameraEpoch||!stream){created.close();return;}
      detector=created;
    }
    trackingReady=true;if(useDemo)loadDemoModel();$('modeTag').textContent='LIVE CAMERA';status('Camera and hand tracking ready. Both views are mirrored.');
  }catch(e){
    if(epoch!==cameraEpoch)return;
    $('cameraError').hidden=false;$('cameraError').textContent='Camera preview is available, but the hand model could not load: '+e.message;status('Preview continues. Click Retry hand tracking, or Stop camera to turn it off.');
  }finally{if(epoch===cameraEpoch){loading=false;controls();}}
}
let retryWithDemo=false;
$('retryTracker').onclick=()=>prepareTracker(cameraEpoch,retryWithDemo);
$('camera').onclick=()=>startCamera(false);
$('cameraDemo').onclick=async()=>{if(stream&&trackingReady)loadDemoModel();else await startCamera(true);};
$('device').onchange=()=>{if(stream){stopCamera();$('camera').onclick();}};
$('stop').onclick=$('stopTop').onclick=()=>{if(round||pending){$('evidenceStatus').textContent='Round cancelled when the camera stopped. Start a fresh round to check early evidence.';$('prediction').textContent='Round cancelled';$('bot').textContent='Computer plays: —';$('timing').textContent='Start camera again for a new round.';}round=null;pending=null;samples=[];hideLabels();dismissDecision();stopCamera();$('cue').textContent='Stopped';coach('','Camera stopped','Start the camera again when ready.');$('modeTag').textContent='CAMERA OFF';$('cameraError').hidden=true;status('Camera stopped. Any unfinished round was cancelled. Start camera again when ready.');controls();};
$('simulation').onclick=()=>{stopCamera();source='simulation';$('cartoon').hidden=false;$('inputTitle').textContent='CARTOON PLAYER · how to move';$('cameraPlaceholder').hidden=true;$('canvas').width=640;$('canvas').height=480;document.querySelectorAll('.stage').forEach(el=>el.style.aspectRatio='4/3');$('cameraError').hidden=true;clear();$('modeTag').textContent='SIMULATION';$('simControls').hidden=false;$('cameraPlaceholder').textContent='Simulation mode · no camera input. Click Start camera for your real hand.';status('Simulation ready. Artificial motion only; no evidence of human prediction accuracy.');drawSimulation(lastValues);ingest(performance.now(),lastValues);};
$('quick').onclick=()=>{
  $('simulation').onclick();syncMovementTiming();$('late').checked=false;
  rows=demoRows(Number($('lead').value),Number($('movementDuration').value));
  $('train').onclick();status('Ready-made artificial examples loaded. Play now, then hide the opening to see why an early guess can fail. Use Play with camera · skip collection to try these examples with your real hand, or Start camera to collect your own.');
};
function drawHand(p){ctx.strokeStyle='#96e3cb';ctx.fillStyle='#fff';ctx.lineWidth=3;const xy=q=>[$('canvas').width*(1-q.x),$('canvas').height*q.y];edges.forEach(e=>{ctx.beginPath();e.forEach((n,i)=>{const [x,y]=xy(p[n]);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();});p.forEach(q=>{ctx.beginPath();ctx.arc(...xy(q),4,0,2*Math.PI);ctx.fill();});ctx.font='bold 18px Arial';[8,12,16,20].forEach((n,i)=>{const [x,y]=xy(p[n]);ctx.strokeStyle='#142d32';ctx.lineWidth=4;ctx.strokeText(['index','middle','ring','little'][i],x+7,y-8);ctx.fillText(['index','middle','ring','little'][i],x+7,y-8);});}
function drawSimulation(v){drawCartoon($('cartoon').getContext('2d'),v,false);drawCartoon(ctx,v,true);}
function loadDemoModel(){
  rows=demoRows(Number($('lead').value),Number($('movementDuration').value));$('train').onclick();
  $('modelInfo').textContent='Ready to play with your camera. Early predictor uses 9 artificial movement examples; current hand labels come from Google’s pretrained recognizer. Real accuracy is not guaranteed.';
  status('Camera play unlocked without collection. Choose a move privately, follow the countdown, then confirm your final move.');
}
$('simLabel').onchange=()=>{if(source==='simulation'&&!round){lastValues=simulated(3000,$('simLabel').value,false);drawSimulation(lastValues);ingest(performance.now(),lastValues);$('cue').textContent='Preview';$('movementHelp').textContent=`${$('simLabel').value.toUpperCase()} preview. A round begins with a fist, then opens toward this gesture during MOVE.`;}};
function ingest(t,v){updateFingers(v,t);live(v);$('trackingHint').textContent=visibleGesture==='unclear'?'Hand tracked · shape is changing or unclear. Hold the final gesture still.':'Hand tracked · '+visibleGesture.toUpperCase()+' visible. Open your fingers once; keep the wrist steady.';syncScreen();if(round&&!round.locked&&t<=round.cutoff)samples.push({t,v:[...v]});}
$('round').onclick=()=>{
  dismissDecision();
  if(source==='simulation'&&$('purpose').value==='train'){
    const needed=LABELS.find(l=>rows.filter(r=>r.label===l).length<3);if(needed)$('simLabel').value=needed;
  }
  const start=performance.now(),lead=Number($('lead').value),movementMs=Number($('movementDuration').value),duration=600+movementMs;
  samples=[];pending=null;sequence++;
  round={start,reveal:start+duration,cutoff:start+duration-lead,lead,movementMs,duration,holdEnd:start+duration+700,purpose:$('purpose').value,simLabel:$('simLabel').value,late:$('late').checked,locked:false,x:null,guess:null,baseline:model?.majority||null,lockTime:null,source};
  $('evidenceStatus').textContent='Waiting for this round’s cutoff. No evidence check yet.';$('prediction').textContent='Early guess: waiting for lock…';$('bot').textContent='Computer plays: waiting…';$('roundResult').textContent='';if(!expandedView)$('roundCoach').scrollIntoView({behavior:'smooth',block:'start'});controls();tick();
};
function tick(){
  if(!round)return;
  const now=performance.now(), elapsed=now-round.start;
  if(source==='simulation'){lastValues=pacedMotion(elapsed,round.simLabel,round.late,sequence,round.movementMs);drawSimulation(lastValues);ingest(now,lastValues);}
  if(!round.locked&&now>=round.cutoff){
    round.locked=true;round.lockTime=now;round.evidence=assessEarlyEvidence(samples,round.cutoff,now,round.reveal);round.x=round.evidence.x;$('evidenceStatus').textContent=round.evidence.message;
    round.guess=predict(model,round.x)?.label||null;
    const movement=fingerMovement(samples,round.cutoff);round.movement=movement;
    $('prediction').textContent=round.guess?`Locked early guess: ${round.guess.toUpperCase()}`:round.x?'Early measurements locked · collect a label':movement.names.length?`No prediction · ${movement.names.join(' + ')} moved`:'No prediction · see early-evidence report';
    $('bot').textContent=round.guess?`Computer commits to: ${counter(round.guess).toUpperCase()}`:'Computer plays: —';
    $('timing').textContent=`Movement stage: ${round.movementMs} ms. Requested lead: ${round.lead} ms. Actual commitment before cue: ${Math.max(0,Math.round(round.reveal-now))} ms. ${samples.length} early frames.`;
  }
  if(elapsed<600){$('cue').textContent='READY · fist';coach('Ready','READY · make a fist','Keep your palm facing the lens and your wrist steady. Move when the green MOVE cue appears.',elapsed/600);}
  else if(now<round.reveal){$('cue').textContent=round.locked?'MOVE · guess locked':'MOVE';coach('Move',`MOVE · ${Math.max(0,(round.reveal-now)/1000).toFixed(1)} s left`,'Open once into your chosen gesture. You do not need to shake your hand. The computer will lock its guess before HOLD.',(elapsed-600)/round.movementMs);}
  else{$('cue').textContent='HOLD · keep still';coach('Hold','HOLD · keep your final gesture still','Stop moving for a moment so the visible shape can be read. Your early guess is already frozen.',Math.min(1,(now-round.reveal)/700));}
  $('movementHelp').textContent=$('coachHelp').textContent;
  guide();
  if(now>=round.holdEnd){pending=round;round=null;controls();if(source==='simulation')finish(pending.simLabel);else showLabels();return;}
  requestAnimationFrame(tick);
}
function finish(label){
  if(!pending)return;
  const r={source:pending.source,label,x:pending.x,guess:pending.guess,baseline:pending.baseline,lead:pending.lead,movementMs:pending.movementMs,actualLead:Math.max(0,pending.reveal-pending.lockTime),frames:samples.length,modelProvenance:model?.provenance||null,quality:pending.evidence?.quality||null};
  if(r.x&&pending.purpose==='train'){if(source==='camera'&&rows.some(x=>x.source==='simulation')){rows=[];model=null;tests=[];}rows.push(r);$('roundResult').textContent=`Saved ${label} training round. Retrain to include it.`;}
  else if(pending.purpose==='test'){tests.push(r);$('roundResult').textContent=r.guess?`You showed ${label}. ${outcome(counter(r.guess),label)}. ${r.guess===label?'Correct early guess.':'The early guess was wrong.'}`:'Invalid test round: '+(pending.evidence?.message||'insufficient fresh early tracking or missed deadline.');}
  else $('roundResult').textContent='Discarded: '+(pending.evidence?.message||'No usable early vector.');
  if(pending.purpose==='test')showDecision(r.guess,label,pending.evidence);else coach('',r.x?'Example saved · ready for the next round':'No example saved · check the evidence',r.x?'Your label has been saved. Follow the next-step guide for the next example.':pending.evidence?.message||'Inspect the early-evidence report before retrying.');
  pending=null;$('roundCoach').classList.remove('running');hideLabels();report();
}
document.querySelectorAll('[data-label]').forEach(b=>b.onclick=()=>finish(b.dataset.label));
$('discard').onclick=()=>{pending=null;hideLabels();$('roundResult').textContent='Round discarded.';coach('','Ready to try again','Choose your move first. Keep your wrist steady and follow READY → MOVE → HOLD.');controls();};
$('retryRound').onclick=()=>{$('discard').onclick();$('round').onclick();};
$('labelStop').onclick=()=>{$('stopTop').onclick();};
$('labelArea').addEventListener('cancel',e=>{e.preventDefault();$('discard').onclick();});
$('train').onclick=()=>{$('evidenceStatus').textContent='Model trained. Start a fresh test round to check its early evidence.';model=train(rows);model.provenance=rows.every(r=>r.source==='simulation')?'artificial':'camera';tests=[];$('purpose').value='test';$('prediction').textContent='Early guess: ready for your first play round';$('bot').textContent='Computer plays: waiting for a round';$('cue').textContent='Ready?';$('timing').textContent='The next guess locks before the SHOW cue.';$('roundResult').textContent='Model ready. Click Play a round.';$('modelInfo').textContent=`Trained on ${model.count} ${model.provenance==='artificial'?'artificial':'camera'} rounds. Ready to play. The early predictor learns from these examples; current camera labels use a separate pretrained gesture model.`;report();};
$('reset').onclick=clear;
function syncMovementTiming(){
  const duration=Number($('movementDuration').value);
  $('movementValue').textContent=`${(duration/1000).toFixed(1)} seconds`;
  [...$('lead').options].forEach(o=>o.disabled=Number(o.value)>duration-150);
  if(Number($('lead').value)>duration-150)$('lead').value='150';
}
$('movementDuration').oninput=()=>{syncMovementTiming();};
$('movementDuration').onchange=()=>{
  const artificial=model?.provenance==='artificial';syncMovementTiming();clear();
  if(artificial){rows=demoRows(Number($('lead').value),Number($('movementDuration').value));$('train').onclick();}
  status(artificial?'Movement pace changed. Artificial examples rebuilt for this timing; scores cleared. Ready to play.':'Movement pace changed. Training and scores cleared; collect examples at this timing.');
};
syncMovementTiming();
$('lead').onchange=()=>{clear();status('Lead time changed. Training and scores cleared: collect examples at the new timing.');};
$('purpose').onchange=controls;
$('export').onclick=()=>{const a=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify({format:1,source,lead:Number($('lead').value),movementMs:Number($('movementDuration').value),training:rows,tests,model},null,2)],{type:'application/json'}));a.href=url;a.download='hand-motion-measurements.json';a.click();URL.revokeObjectURL(url);};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(round||pending)){$('evidenceStatus').textContent='Round cancelled because this tab was hidden. No early prediction is scored for the cancelled round.';round=null;pending=null;hideLabels();$('cue').textContent='Cancelled';coach('','Round cancelled','Keep this tab visible during the round.');status('Round cancelled because the page was hidden. Keep the tab visible for accurate timing.');controls();}});
window.addEventListener('pagehide',stopCamera);
$('modeTag').textContent='CAMERA OFF';$('simControls').hidden=true;status('Start camera to see your hand and the computer’s labels, or try the ready-made simulation.');noHand('Current gesture: waiting for camera');report();
