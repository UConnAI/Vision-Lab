// Three small, randomly initialized center regressors. No pretrained weights.
export const WIDTH=32, HEIGHT=18, SEED=314;
export const SPECS=[
  {id:'one',name:'Tiny A · one convolution',filters:[4]},
  {id:'two',name:'Tiny B · two convolutions',filters:[4,8]},
  {id:'wide',name:'Tiny C · wider two-layer CNN',filters:[8,12]}
];
export function buildModel(tf,spec){
  const model=tf.sequential();
  spec.filters.forEach((filters,index)=>{
    model.add(tf.layers.conv2d({...(index===0?{inputShape:[HEIGHT,WIDTH,3]}:{}),filters,kernelSize:3,padding:'same',activation:'relu',kernelInitializer:tf.initializers.glorotUniform({seed:SEED})}));
    model.add(tf.layers.maxPooling2d({poolSize:2,strides:2}));
  });
  model.add(tf.layers.flatten());
  model.add(tf.layers.dense({units:2,activation:'sigmoid',kernelInitializer:tf.initializers.glorotUniform({seed:SEED})}));
  model.compile({optimizer:tf.train.adam(.005),loss:'meanSquaredError'});
  return model;
}
export function splitVisible(positions,maxSamples=72){
  const visible=[...positions.entries()].map(([frame,p])=>({...p,frame})).filter(p=>p.visible).sort((a,b)=>a.frame-b.frame);
  if(visible.length<18)throw new Error('At least 18 visible coordinate rows are needed.');
  const stride=Math.max(1,Math.ceil(visible.length/maxSamples));
  const rows=visible.filter((_,i)=>i%stride===0),a=Math.floor(rows.length*.6),b=Math.floor(rows.length*.8);
  return {train:rows.slice(0,a),validation:rows.slice(a,b),test:rows.slice(b)};
}
export function centerError(predictions,rows,width,height){
  if(predictions.length!==rows.length||!rows.length)throw new Error('Predictions must match the evaluation rows.');
  return predictions.reduce((sum,p,i)=>sum+Math.hypot(p[0]*width-rows[i].x,p[1]*height-rows[i].y),0)/rows.length;
}

// The preview also rounds duration * CSV fps to estimate a constant-rate frame
// count. Rounding tolerates container-duration precision at the final frame.
// Validate before clamping the seek inside a frame: clamping an invalid index
// would silently teach many labels from the same final video image.
export function trainingFrameTime(frame,fps,duration){
  if(!Number.isFinite(fps)||fps<=0)throw new Error('Use a positive CSV frame rate before training.');
  if(!Number.isFinite(duration)||duration<=0)throw new Error('Wait for a video with a known positive duration before training.');
  const frameCount=Math.max(1,Math.round(duration*fps));
  if(!Number.isSafeInteger(frame)||frame<0||frame>=frameCount){
    throw new Error(`CSV Frame ${frame} is outside this video (frames 0–${frameCount-1} at ${fps} fps). Choose the matching video and CSV, and check CSV frame rate before training. No out-of-range label will be paired with the final frame.`);
  }
  return Math.min((frame+.25)/fps,Math.max(0,duration-.000001));
}
export function validateTrainingFrames(positions,fps,duration){
  // Check every visible row, not only the rows selected by the training stride.
  for(const [frame,row] of positions)if(row.visible)trainingFrameTime(frame,fps,duration);
}
