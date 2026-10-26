import {SPECS,WIDTH,HEIGHT,buildModel,splitVisible,centerError,trainingFrameTime,validateTrainingFrames} from './tiny-cnn-core.mjs';
export function setupTinyCNN({video,getPositions,getFPS,onChange}){
  const $=id=>document.getElementById(id),tf=window.tf,models=new Map();
  let generation=0,running=false,active=null,latest=null,lastTime=-Infinity,trainingModel=null;
  const disposeModel=model=>{model.optimizer?.dispose();model.dispose();};
  const status=text=>$('tinyStatus').textContent=text;
  function clear(){
    generation++;if(trainingModel)trainingModel.stopTraining=true;active=null;latest=null;lastTime=-Infinity;
    for(const model of models.values())disposeModel(model);models.clear();
    $('positionSource').innerHTML='<option value="csv">Supplied CSV positions</option>';
    $('tinyResults').replaceChildren();$('tinySplit').textContent='';status('Train the three small CNNs on the selected clip, then compare their held-out coordinate errors.');
    $('previewStatus').textContent='CSV mode: supplied coordinates drive the effect; missing positions remain gaps.';onChange();
  }
  function estimate(){
    if(!active||video.readyState<2)return null;
    if(Math.abs(video.currentTime-lastTime)>=.09||!latest){
      const values=tf.tidy(()=>active.predict(tf.image.resizeBilinear(tf.browser.fromPixels(video),[HEIGHT,WIDTH]).toFloat().div(255).expandDims()).dataSync());
      latest={x:values[0]*video.videoWidth,y:values[1]*video.videoHeight,source:'tiny CNN center estimate'};lastTime=video.currentTime;
    }
    return latest;
  }
  function decoderFrame(decoder,time){return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{cleanup();reject(new Error('The video decoder did not finish seeking.'));},8000);
    const cleanup=()=>{clearTimeout(timeout);decoder.removeEventListener('seeked',done);decoder.removeEventListener('error',fail);};
    const done=()=>{cleanup();resolve();},fail=()=>{cleanup();reject(new Error('Could not decode this video.'));};
    decoder.addEventListener('seeked',done);decoder.addEventListener('error',fail);decoder.currentTime=time;
  });}
  $('positionSource').onchange=()=>{active=models.get($('positionSource').value)||null;latest=null;lastTime=-Infinity;$('previewStatus').textContent=active?'CNN mode: the selected center regressor drives the sticker. It cannot determine whether a ball is absent.':'CSV mode: supplied coordinates drive the effect; missing positions remain gaps.';onChange();};
  $('tinyTrain').onclick=async()=>{
    if(running)return;
    clear();const run=generation,epochs=Number($('tinyEpochs').value);running=true;$('tinyTrain').disabled=true;$('tinyStop').disabled=false;
    const decoder=document.createElement('video');decoder.muted=true;decoder.preload='auto';decoder.src=video.currentSrc||video.src;
    let tensors=[],uncommitted=null;
    try{
      if(!tf)throw new Error('The bundled TensorFlow runtime is unavailable.');
      await tf.setBackend('cpu');await tf.ready();
      const positions=getPositions(),split=splitVisible(positions),fps=getFPS(),width=video.videoWidth,height=video.videoHeight;
      if(!width||!height)throw new Error('Wait for the video to load.');
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Video metadata timed out.')),8000);decoder.onloadeddata=()=>{clearTimeout(timer);resolve();};decoder.onerror=()=>{clearTimeout(timer);reject(new Error('Video could not load.'));};decoder.load();});
      validateTrainingFrames(positions,fps,decoder.duration);
      const sampleCanvas=document.createElement('canvas');sampleCanvas.width=WIDTH;sampleCanvas.height=HEIGHT;const context=sampleCanvas.getContext('2d',{willReadFrequently:true});
      const batches={};let count=0;const total=Object.values(split).flat().length;
      for(const [name,rows]of Object.entries(split)){
        const pixels=[];
        for(const row of rows){
          if(run!==generation)throw new Error('Training cancelled.');
          if(row.x<0||row.x>=width||row.y<0||row.y>=height)throw new Error('A visible CSV coordinate lies outside the video.');
          await decoderFrame(decoder,trainingFrameTime(row.frame,fps,decoder.duration));
          context.drawImage(decoder,0,0,WIDTH,HEIGHT);const rgba=context.getImageData(0,0,WIDTH,HEIGHT).data;
          for(let i=0;i<rgba.length;i+=4)pixels.push(rgba[i]/255,rgba[i+1]/255,rgba[i+2]/255);
          status(`Reading training/evaluation frames: ${++count}/${total}. No image is uploaded.`);
        }
        const xs=tf.tensor4d(pixels,[rows.length,HEIGHT,WIDTH,3]),ys=tf.tensor2d(rows.map(p=>[p.x/width,p.y/height]));
        tensors.push(xs,ys);batches[name]={xs,ys};
      }
      $('tinySplit').textContent=`Chronological split: ${split.train.length} train / ${split.validation.length} validation / ${split.test.length} test visible frames. Input 32 × 18 RGB · CPU · seed 314.`;
      const mean=split.train.reduce((m,p)=>[m[0]+p.x/split.train.length/width,m[1]+p.y/split.train.length/height],[0,0]);
      addResult('Training-mean baseline',0,centerError(split.test.map(()=>mean),split.test,width,height),0);
      for(const spec of SPECS){
        if(run!==generation)throw new Error('Training cancelled.');
        const model=buildModel(tf,spec);uncommitted=model;trainingModel=model;const started=performance.now();let best=Infinity,bestWeights=null;
        try{
          await model.fit(batches.train.xs,batches.train.ys,{epochs,batchSize:12,shuffle:false,validationData:[batches.validation.xs,batches.validation.ys],callbacks:{onEpochEnd:async(epoch,logs)=>{
            if(logs.val_loss<best){best=logs.val_loss;if(bestWeights)tf.dispose(bestWeights);bestWeights=model.getWeights().map(w=>w.clone());}
            status(`${spec.name}: epoch ${epoch+1}/${epochs} · training MSE ${logs.loss.toFixed(4)} · validation MSE ${logs.val_loss.toFixed(4)}`);
            if(run!==generation)model.stopTraining=true;await tf.nextFrame();
          }}});
          if(run!==generation)throw new Error('Training cancelled.');
          if(bestWeights)model.setWeights(bestWeights);
        }finally{if(bestWeights)tf.dispose(bestWeights);trainingModel=null;}
        const predictions=model.predict(batches.test.xs);const values=await predictions.array();predictions.dispose();
        models.set(spec.id,model);uncommitted=null;
        addResult(spec.name,model.countParams(),centerError(values,split.test,width,height),(performance.now()-started)/1000);
        const option=document.createElement('option');option.value=spec.id;option.textContent=spec.name;$('positionSource').append(option);
      }
      status('Three CNNs trained. Compare test error with the mean baseline, then choose a CNN under Position source to move the sticker with its predictions. These models always predict a center—even when no ball is visible.');
    }catch(error){status(error.message);}
    finally{if(uncommitted)disposeModel(uncommitted);tf?.dispose(tensors);decoder.removeAttribute('src');decoder.load();running=false;$('tinyTrain').disabled=false;$('tinyStop').disabled=true;}
  };
  function addResult(name,parameters,error,seconds){const row=document.createElement('tr');for(const text of [name,parameters.toLocaleString(),`${error.toFixed(1)} px`,`${(100*error/Math.hypot(video.videoWidth,video.videoHeight)).toFixed(2)}%`,parameters?`${seconds.toFixed(1)} s`:'—']){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}$('tinyResults').append(row);}
  $('tinyStop').onclick=()=>{generation++;if(trainingModel)trainingModel.stopTraining=true;status('Stopping training…');};
  window.addEventListener('pagehide',clear);
  return {clear,estimate,isActive:()=>Boolean(active)};
}
