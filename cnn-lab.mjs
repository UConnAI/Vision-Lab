import {createTrainingVisual} from './cnn-training-visual.mjs';
import {IMAGE_SIZE,CLASS_NAMES,RANDOM_SEED,makeSplits,argmax,scorePredictions,ARCHITECTURE,PARAMETER_COUNT,createToyModel} from './cnn-lab-core.mjs';
const $=id=>document.getElementById(id), root=$('cnnLab');
if(root){
  const data=makeSplits(),canvas=$('cnnDraw'),ctx=canvas.getContext('2d'),sample=$('cnnSample').getContext('2d');
  let model=null,training=false,previewing=false,cancelRequested=false,ready=false,drawing=false,last=null,testIndex=0,runtimePromise=null,featureInput=data.test[0].pixels;
  const trainingVisual=createTrainingVisual(()=>window.tf);
  const tell=text=>$('cnnStatus').textContent=text;
  $('cnnArchitecture').innerHTML='<thead><tr><th>Layer</th><th>Output shape</th><th>Parameters</th></tr></thead><tbody>'+ARCHITECTURE.map(l=>`<tr><td>${l.name}</td><td>${l.shape}</td><td>${l.parameters}</td></tr>`).join('')+`<tr><th>Total</th><td></td><th>${PARAMETER_COUNT.toLocaleString()}</th></tr></tbody>`;
  async function cpuRuntime(){
    if(!window.tf)throw new Error('Local TensorFlow.js runtime is missing.');
    if(!runtimePromise)runtimePromise=(async()=>{
      const available=await tf.setBackend('cpu');
      if(!available)throw new Error('The CPU backend could not initialize.');
      await tf.ready();
      if(tf.getBackend()!=='cpu')throw new Error('The CPU backend is not active.');
    })().catch(error=>{runtimePromise=null;throw error;});
    return runtimePromise;
  }
  function buttonState(){trainingVisual.controls(training||previewing,training);for(const id of ['cnnTrain','cnnPreview','cnnClear','cnnPredict','cnnNext','cnnFilter'])$(id).disabled=training||previewing||(['cnnPredict','cnnNext'].includes(id)&&!model);$('cnnCancel').disabled=!training;}
  function clear(){ctx.fillStyle='black';ctx.fillRect(0,0,canvas.width,canvas.height);last=null;$('cnnPrediction').textContent='Draw a large ring, plus or X, then predict.';}
  function paintImage(context,pixels){const size=context.canvas.width/IMAGE_SIZE;context.fillStyle='black';context.fillRect(0,0,context.canvas.width,context.canvas.height);for(let y=0;y<IMAGE_SIZE;y++)for(let x=0;x<IMAGE_SIZE;x++){const v=Math.round(pixels[y*IMAGE_SIZE+x]*255);context.fillStyle=`rgb(${v},${v},${v})`;context.fillRect(x*size,y*size,size,size);}}
  function tensor(rows){return tf.tensor4d(Float32Array.from(rows.flatMap(row=>Array.from(row.pixels))),[rows.length,IMAGE_SIZE,IMAGE_SIZE,1]);}
  function targets(rows){return tf.tidy(()=>tf.oneHot(tf.tensor1d(rows.map(r=>r.label),'int32'),3));}
  async function predict(pixels){const output=tf.tidy(()=>model.predict(tf.tensor4d(pixels,[1,16,16,1])));try{return Array.from(await output.data());}finally{output.dispose();}}
  function describe(scores){return CLASS_NAMES.map((name,i)=>`${name} ${(scores[i]*100).toFixed(1)}%`).join(' · ');}
  async function nextExample(){const row=data.test[testIndex++%data.test.length];paintImage(sample,row.pixels);if(!model){$('cnnExampleResult').textContent=`Held-out example: ${CLASS_NAMES[row.label]}. Train before predicting.`;return;}const scores=await predict(row.pixels);await featureMap(row.pixels);$('cnnExampleResult').textContent=`Generator label: ${CLASS_NAMES[row.label]}. ${ready?'Trained CNN':'Untrained CNN'} guess: ${CLASS_NAMES[argmax(scores)]}. ${describe(scores)}`;}
  async function featureMap(pixels){
    featureInput=pixels;if(!model)return;
    const channel=Number($('cnnFilter').value),output=tf.tidy(()=>model.layers[0].apply(tf.tensor4d(pixels,[1,16,16,1])).slice([0,0,0,channel],[1,16,16,1]).reshape([16,16]));
    try{const values=await output.data(),peak=Math.max(...values);paintImage($('cnnFeature').getContext('2d'),Float32Array.from(values,v=>peak?v/peak:0));$('cnnFeatureStatus').textContent=`${ready?'Trained':'Untrained'} filter ${channel}, after ReLU. Peak activation ${peak.toFixed(3)}. Brightness is normalized within this map; compare patterns, not absolute brightness across filters.`;}finally{output.dispose();}
  }
  $('cnnFilter').onchange=()=>featureMap(featureInput).catch(error=>tell(error.message));
  $('cnnPreview').onclick=async()=>{if(training||previewing)return;previewing=true;buttonState();try{await cpuRuntime();model?.optimizer?.dispose();model?.dispose();model=createToyModel(tf);trainingVisual.reset(model,data.train[0].pixels);ready=false;$('cnnHistory').replaceChildren();$('cnnEvaluation').textContent='Network reset to seeded random weights. Train and evaluate to compare.';await nextExample();tell('Untrained CNN on CPU: seeded random weights. These scores and filters have not learned the task yet. Train to compare.');buttonState();}catch(error){tell(error.message);}finally{previewing=false;buttonState();}};
  $('cnnTrain').onclick=async()=>{
    if(training||previewing)return;training=true;cancelRequested=false;ready=false;buttonState();$('cnnHistory').replaceChildren();$('cnnEvaluation').textContent='Held-out test evaluation will run after training completes.';
    const tensors=[];let visualResult='error',completedBatches=0;trainingVisual.begin();
    try{
      if(!window.tf)throw new Error('The local TensorFlow.js runtime is missing. Keep take-home-football-tracker/vendor/tf.min.js in the workshop folder.');
      tell('Preparing the local CNN on CPU. All generated images and weights stay in this browser.');await cpuRuntime();
      model?.optimizer?.dispose();model?.dispose();model=createToyModel(tf);if(model.countParams()!==PARAMETER_COUNT)throw new Error('The teaching architecture and code disagree.');trainingVisual.capture(model,data.train[0].pixels);
      const trainX=tensor(data.train),trainY=targets(data.train),validationX=tensor(data.validation),validationY=targets(data.validation);tensors.push(trainX,trainY,validationX,validationY);
      await model.fit(trainX,trainY,{epochs:12,batchSize:32,shuffle:false,validationData:[validationX,validationY],yieldEvery:'batch',callbacks:{onBatchEnd:async()=>{trainingVisual.batchEnd(++completedBatches);if(cancelRequested)model.stopTraining=true;await tf.nextFrame();},onEpochEnd:async(epoch,logs)=>{if(cancelRequested)return;trainingVisual.epochEnd(epoch+1,logs,model,data.train[0].pixels);const item=document.createElement('li');item.textContent=`Epoch ${epoch+1}/12: loss ${logs.loss.toFixed(3)}, training ${((logs.acc??logs.accuracy??0)*100).toFixed(1)}%, validation ${((logs.val_acc??logs.val_accuracy??0)*100).toFixed(1)}%.`;$('cnnHistory').append(item);tell(`Training epoch ${epoch+1}/12 on CPU with 384 synthetic images. Validation monitors 96 separate images.`);await tf.nextFrame();}}});
      if(cancelRequested){visualResult='canceled';$('cnnEvaluation').textContent='Not evaluated: training was canceled. Retrain to run the held-out test.';tell('Training canceled. Train again to start a fresh model with seed 314.');model.optimizer?.dispose();model.dispose();model=null;return;}
      const testX=tensor(data.test);tensors.push(testX);const output=model.predict(testX);tensors.push(output);const scores=await output.array(),result=scorePredictions(data.test.map(r=>r.label),scores);
      $('cnnEvaluation').innerHTML=`<p><strong>Held-out synthetic test set: ${result.correct}/${result.total} correct (${(result.accuracy*100).toFixed(1)}%).</strong> Rows below are true labels; columns are CNN predictions.</p><table><thead><tr><th>True / predicted</th>${CLASS_NAMES.map(n=>`<th>${n}</th>`).join('')}</tr></thead><tbody>${result.matrix.map((row,i)=>`<tr><th>${CLASS_NAMES[i]}</th>${row.map(n=>`<td>${n}</td>`).join('')}</tr>`).join('')}</tbody></table><p>This result measures generated symbols from this generator. Hand drawings and camera images have a different distribution. Softmax scores are not calibrated probabilities of correctness.</p>`;
      ready=true;visualResult='complete';tell(`Training and held-out evaluation complete on ${tf.getBackend()}. ${PARAMETER_COUNT.toLocaleString()} learned parameters. Try a test sample or draw your own symbol.`);await nextExample();
    }catch(error){tell(`CNN lab stopped: ${error.message}. Training can be retried. No camera or internet is required.`);model?.optimizer?.dispose();model?.dispose();model=null;ready=false;}
    finally{for(const t of tensors)t.dispose();training=false;trainingVisual.finish(visualResult);buttonState();}
  };
  $('cnnCancel').onclick=()=>{cancelRequested=true;if(model)model.stopTraining=true;$('cnnCancel').disabled=true;tell('Canceling after the current training batch…');};
  $('cnnNext').onclick=()=>nextExample().catch(error=>tell(error.message));
  $('cnnClear').onclick=clear;
  $('cnnPredict').onclick=async()=>{try{const reduced=document.createElement('canvas');reduced.width=reduced.height=16;const c=reduced.getContext('2d');c.drawImage(canvas,0,0,16,16);const rgba=c.getImageData(0,0,16,16).data,pixels=Float32Array.from({length:256},(_,i)=>rgba[i*4]/255);const scores=await predict(pixels);await featureMap(pixels);$('cnnPrediction').textContent=`${ready?'Trained CNN':'Untrained CNN'} guess: ${CLASS_NAMES[argmax(scores)]}. ${describe(scores)}. A confident error is still an error.`;}catch(error){tell(error.message);}};
  function point(event){const r=canvas.getBoundingClientRect();return{x:(event.clientX-r.left)*canvas.width/r.width,y:(event.clientY-r.top)*canvas.height/r.height};}
  function draw(event){if(!drawing||training)return;const p=point(event);ctx.strokeStyle='white';ctx.fillStyle='white';ctx.lineWidth=canvas.width*.13;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(last?.x??p.x,last?.y??p.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();last=p;}
  canvas.onpointerdown=event=>{if(training)return;event.preventDefault();drawing=true;last=null;canvas.setPointerCapture(event.pointerId);draw(event);};canvas.onpointermove=draw;canvas.onpointerup=canvas.onpointercancel=()=>{drawing=false;last=null;};
  window.addEventListener('pagehide',()=>{cancelRequested=true;if(model){model.stopTraining=true;if(!training){model.optimizer?.dispose();model.dispose();}}});
  clear();paintImage(sample,data.test[0].pixels);$('cnnExampleResult').textContent=`Held-out example: ${CLASS_NAMES[data.test[0].label]}. Train before predicting.`;buttonState();
}
