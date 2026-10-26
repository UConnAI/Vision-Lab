import {TRAINING_NODES,TRAINING_STEPS,trainingProgress,trainingSnapshot,createEpochHistory} from './cnn-training-visual-core.mjs';

export function createTrainingVisual(tfProvider){
  const panel=document.getElementById('cnnTrainingVisual');
  if(!panel)return {begin(){},capture(){},batchEnd(){},epochEnd(){},finish(){},reset(){},controls(){}};
  const $=id=>panel.querySelector('#'+id);
  let step=0,timer=null;
  const history=createEpochHistory();
  const number=value=>Number(value).toFixed(4);
  const graph=$('ctvNetwork');
  $('ctvTrain').onclick=()=>document.getElementById('cnnTrain').click();$('ctvCancel').onclick=()=>document.getElementById('cnnCancel').click();
  for(const node of TRAINING_NODES){
    const card=document.createElement('div');card.className='ctvNode';card.dataset.node=node.id;
    const title=document.createElement('strong');title.textContent=node.name;
    const picture=document.createElement('div');picture.className='ctvSketch';picture.setAttribute('aria-hidden','true');
    for(let i=0;i<(node.id==='loss'?1:node.id==='scores'?3:4);i++){const map=document.createElement('span');map.style.setProperty('--map',i);picture.append(map);}
    const shape=document.createElement('b');shape.textContent=node.shape;
    const detail=document.createElement('small');detail.textContent=node.detail;
    const parameters=document.createElement('small');parameters.textContent=node.parameters?`${node.parameters} learned parameters`:'No learned parameters';
    card.append(title,picture,shape,detail,parameters);graph.append(card);
  }
  function paint(canvas,pixels){
    const context=canvas.getContext('2d'),data=context.createImageData(16,16);canvas.width=canvas.height=16;
    pixels.forEach((value,index)=>{const i=4*index;data.data[i]=data.data[i+1]=data.data[i+2]=Math.round(255*Math.max(0,Math.min(1,value)));data.data[i+3]=255;});context.putImageData(data,0,0);
  }
  function renderSnapshot(){
    const state=history.state(),entry=state.entry;
    $('ctvEpoch').disabled=!entry;$('ctvEpoch').max=Math.max(0,state.latest);$('ctvEpoch').value=entry?.epoch??0;
    $('ctvEpochPrevious').disabled=!entry||entry.epoch===0;$('ctvEpochNext').disabled=!entry||entry.epoch===state.latest;$('ctvEpochLive').disabled=!entry||state.following;
    if(!entry){$('ctvEpochValue').textContent='No snapshots yet';$('ctvEpochStatus').textContent='Epoch 0 is the seeded, untrained network. Snapshots 1–12 become available as each epoch finishes.';$('ctvEpochMetrics').textContent='Train or inspect the untrained CNN to begin.';$('ctvEpoch').removeAttribute('aria-valuetext');$('ctvActivationLabel').textContent='Snapshots appear after initialization and each complete epoch.';$('ctvWeights').replaceChildren();for(const id of ['ctvInput','ctvActivation'])$(id).getContext('2d').clearRect(0,0,16,16);return;}
    const snapshot=entry.snapshot,previous=state.previous?.snapshot,snapshotEpoch=entry.epoch;
    $('ctvEpochValue').textContent=`Epoch ${snapshotEpoch} / 12${snapshotEpoch===0?' · untrained':''}`;
    $('ctvEpoch').setAttribute('aria-valuetext',`Epoch ${snapshotEpoch}, ${snapshotEpoch===0?'seeded initial weights':'after completed training'}, latest available epoch ${state.latest}`);
    $('ctvEpochStatus').textContent=`${state.following?'Following the latest epoch.':`Viewing saved epoch ${snapshotEpoch}; this view stays here as training continues.`} ${state.count} snapshot${state.count===1?'':'s'} available (0–${state.latest}). Scrubbing changes the display, not the model.`;
    $('ctvEpochMetrics').textContent=entry.metrics?`Selected epoch ${snapshotEpoch} · training loss ${entry.metrics.loss.toFixed(4)} · training ${(entry.metrics.accuracy*100).toFixed(1)}% · validation ${(entry.metrics.validationAccuracy*100).toFixed(1)}%.`:'Selected epoch 0 · seeded random weights, before any optimizer updates. No training or validation metrics yet.';
    const channel=Number($('ctvFilter').value),values=snapshot.weights.filter((_,index)=>index%8===channel);
    const before=previous?.weights.filter((_,index)=>index%8===channel);
    $('ctvWeights').replaceChildren();
    values.forEach((value,index)=>{const cell=document.createElement('span');cell.textContent=number(value);cell.title=before?`Previous snapshot ${number(before[index])}; change ${number(value-before[index])}`:'Seeded initial value';cell.className=before&&value!==before[index]?(value>before[index]?'increased':'decreased'):'';$('ctvWeights').append(cell);});
    paint($('ctvInput'),snapshot.input);
    const activation=snapshot.activations.filter((_,index)=>index%8===channel),peak=Math.max(0,...activation);
    const shared=$('ctvSharedScale').checked,scale=shared?history.activationScale(channel):peak;
    paint($('ctvActivation'),activation.map(value=>scale?value/scale:0));
    $('ctvSnapshot').textContent=`Actual ${snapshotEpoch===0?'initial weights':`weights after epoch ${snapshotEpoch}`} · filter ${channel} · first coefficient ${number(values[0])}${before?` (epoch ${snapshotEpoch-1}: ${number(before[0])}, change ${number(values[0]-before[0])})`:''}. Colors mark increases (teal) and decreases (purple) since the previous epoch.`;
    $('ctvActivationLabel').textContent=`Epoch ${snapshotEpoch} · actual filter ${channel} activation after ReLU on the fixed image. ${shared?`Shared brightness scale across all ${state.count} saved snapshots`:'Brightness normalized within this epoch'}; scale maximum ${number(scale)}, this epoch’s peak ${number(peak)}.`;
  }
  function renderStep(){
    const state=TRAINING_STEPS[step];panel.dataset.direction=state.direction;
    for(const card of graph.children)card.classList.toggle('isActive',state.node==='all'?TRAINING_NODES.find(node=>node.id===card.dataset.node).parameters>0:card.dataset.node===state.node);
    $('ctvPhase').textContent=`${step+1}/${TRAINING_STEPS.length} · ${state.direction==='backward'?'← BACKWARD':state.direction==='forward'?'FORWARD →':state.direction==='update'?'UPDATE WEIGHTS':'NEXT BATCH ↻'}`;
    $('ctvTitle').textContent=state.title;$('ctvDescription').textContent=state.description;
    $('ctvPlay').textContent=timer===null?'Play explanation':'Pause explanation';
  }
  function pause(){if(timer!==null)clearInterval(timer);timer=null;renderStep();}
  function play(){pause();timer=setInterval(()=>{step=(step+1)%TRAINING_STEPS.length;renderStep();},Number($('ctvSpeed').value));renderStep();}
  $('ctvPlay').onclick=()=>timer===null?play():pause();
  $('ctvStep').onclick=()=>{pause();step=(step+1)%TRAINING_STEPS.length;renderStep();};
  $('ctvRestart').onclick=()=>{pause();step=0;renderStep();};
  $('ctvSpeed').onchange=()=>{if(timer!==null)play();};$('ctvFilter').onchange=renderSnapshot;
  $('ctvEpoch').oninput=()=>{history.select(Number($('ctvEpoch').value));renderSnapshot();};
  $('ctvEpochPrevious').onclick=()=>{history.select(history.state().entry.epoch-1);renderSnapshot();};
  $('ctvEpochNext').onclick=()=>{history.select(history.state().entry.epoch+1);renderSnapshot();};
  $('ctvEpochLive').onclick=()=>{history.live();renderSnapshot();};
  $('ctvSharedScale').onchange=renderSnapshot;
  const anchor=document.createComment('training visualization position');panel.before(anchor);
  const dialog=document.createElement('dialog');dialog.className='ctvDialog';dialog.setAttribute('aria-labelledby','ctvHeading');document.body.append(dialog);
  $('ctvFocus').onclick=()=>{const focused=panel.classList.toggle('ctvFocused');panel.classList.toggle('ctvReview',!focused);$('ctvFocus').textContent=focused?'Explore epochs and weights':'Focus network';if(!focused)$('ctvEpochHistory').scrollIntoView({block:'start'});else if(dialog.open)dialog.scrollTop=0;else panel.scrollIntoView({block:'start'});};
  function closeLarge(){dialog.close();anchor.after(panel);panel.classList.remove('ctvFocused','ctvReview');$('ctvFocus').textContent='Focus network';$('ctvLarge').textContent='Large presentation view';}
  $('ctvLarge').onclick=()=>{if(dialog.open){closeLarge();return;}panel.classList.remove('ctvReview');panel.classList.add('ctvFocused');$('ctvFocus').textContent='Explore epochs and weights';dialog.append(panel);dialog.showModal();$('ctvLarge').textContent='Close large view';};
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeLarge();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',pause);
  renderStep();renderSnapshot();
  return {
    controls(busy,training){$('ctvTrain').disabled=busy;$('ctvCancel').disabled=!training;},
    begin(){pause();step=0;history.clear();renderSnapshot();$('ctvProgress').value=0;$('ctvMeasured').textContent='Preparing a fresh seeded CNN. Training progress will appear here.';$('ctvMetrics').textContent='Training and validation metrics will appear after each completed epoch.';$('ctvSnapshot').textContent='Preparing actual weight snapshots…';play();},
    capture(model,pixels){history.record(0,trainingSnapshot(tfProvider(),model,pixels));renderSnapshot();},
    batchEnd(batches){const progress=trainingProgress(batches);$('ctvProgress').value=progress.completed;$('ctvMeasured').textContent=`Actual training: ${progress.completed}/144 optimizer steps · ${Math.floor(progress.completed/12)}/12 complete epochs. The schematic runs at its own teaching pace.`;},
    epochEnd(epoch,logs,model,pixels){history.record(epoch,trainingSnapshot(tfProvider(),model,pixels),{loss:logs.loss,accuracy:logs.acc??logs.accuracy??0,validationAccuracy:logs.val_acc??logs.val_accuracy??0});renderSnapshot();$('ctvMetrics').textContent=`Actual epoch ${epoch}/12 · training loss ${logs.loss.toFixed(4)} · training ${((logs.acc??logs.accuracy??0)*100).toFixed(1)}% · validation ${((logs.val_acc??logs.val_accuracy??0)*100).toFixed(1)}%. Validation computes scores without updating weights.`;},
    finish(status='complete'){pause();$('ctvMeasured').textContent+=(status==='complete'?' Training and held-out evaluation complete.':status==='canceled'?' Training canceled; this run was not tested.':' Training stopped with an error.');},
    reset(model,pixels){pause();step=0;history.clear();$('ctvProgress').value=0;$('ctvMeasured').textContent='Untrained CNN · 0/144 optimizer steps.';$('ctvMetrics').textContent='No training or validation metrics for this fresh model.';history.record(0,trainingSnapshot(tfProvider(),model,pixels));renderSnapshot();renderStep();}
  };
}
