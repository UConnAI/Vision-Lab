// A reproducible teaching dataset, independent of camera/video data.
export const IMAGE_SIZE=16, CLASS_NAMES=['Ring','Plus','X'], RANDOM_SEED=314;
export function seededRandom(seed=RANDOM_SEED){let state=seed>>>0;return()=>{state=(1664525*state+1013904223)>>>0;return state/4294967296;};}
export function makeImage(label,rng){
  const size=IMAGE_SIZE, pixels=new Float32Array(size*size);
  const cx=7.5+(rng()-.5)*3,cy=7.5+(rng()-.5)*3,radius=4+rng()*1.5,thickness=.75+rng()*.45,angle=(rng()-.5)*.18;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const dx=x-cx,dy=y-cy,u=dx*Math.cos(angle)-dy*Math.sin(angle),v=dx*Math.sin(angle)+dy*Math.cos(angle);
    const d=label===0?Math.abs(Math.hypot(u,v)-radius):label===1?Math.min(Math.max(Math.abs(u)-thickness,Math.abs(v)-radius),Math.max(Math.abs(v)-thickness,Math.abs(u)-radius)):Math.min(Math.max(Math.abs(u-v)/Math.SQRT2-thickness,Math.abs(u+v)/Math.SQRT2-radius),Math.max(Math.abs(u+v)/Math.SQRT2-thickness,Math.abs(u-v)/Math.SQRT2-radius));
    const ink=label===0?Math.max(0,Math.min(1,(thickness-d)*2)):Math.max(0,Math.min(1,1-d*2));
    pixels[y*size+x]=Math.max(0,Math.min(1,ink+(rng()-.5)*.08));
  }
  return pixels;
}
export function makeSplits({train=384,validation=96,test=120,seed=RANDOM_SEED}={}){
  const rng=seededRandom(seed);let id=0;
  function split(count,name){const rows=Array.from({length:count},(_,i)=>{const label=i%CLASS_NAMES.length;return{id:id++,split:name,label,pixels:makeImage(label,rng)};});for(let i=rows.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[rows[i],rows[j]]=[rows[j],rows[i]];}return rows;}
  return {train:split(train,'train'),validation:split(validation,'validation'),test:split(test,'test')};
}
export function argmax(values){return values.reduce((best,value,index)=>value>values[best]?index:best,0);}
export function scorePredictions(labels,predictions){if(labels.length!==predictions.length)throw new Error('Every example needs one prediction.');const matrix=CLASS_NAMES.map(()=>CLASS_NAMES.map(()=>0));let correct=0;labels.forEach((label,i)=>{const guess=argmax(predictions[i]);matrix[label][guess]++;if(guess===label)correct++;});return {correct,total:labels.length,accuracy:labels.length?correct/labels.length:0,matrix};}
export const ARCHITECTURE=[
  {name:'Input',shape:'16 × 16 × 1',parameters:0},
  {name:'Conv 3 × 3, 8 filters, same, ReLU',shape:'16 × 16 × 8',parameters:80},
  {name:'Max pool 2 × 2',shape:'8 × 8 × 8',parameters:0},
  {name:'Conv 3 × 3, 12 filters, valid, ReLU',shape:'6 × 6 × 12',parameters:876},
  {name:'Max pool 2 × 2 / flatten',shape:'3 × 3 × 12 / 108',parameters:0},
  {name:'Dense softmax',shape:'3 scores',parameters:327}
];
export const PARAMETER_COUNT=ARCHITECTURE.reduce((sum,layer)=>sum+layer.parameters,0);
export function createToyModel(tf){
  const model=tf.sequential();
  const initializer=()=>tf.initializers.glorotUniform({seed:RANDOM_SEED});
  model.add(tf.layers.conv2d({
    inputShape:[16,16,1],
    filters:8,
    kernelSize:3,
    padding:'same',
    activation:'relu',
    kernelInitializer:initializer()
  }));
  model.add(tf.layers.maxPooling2d({poolSize:2,strides:2}));
  model.add(tf.layers.conv2d({
    filters:12,
    kernelSize:3,
    padding:'valid',
    activation:'relu',
    kernelInitializer:initializer()
  }));
  model.add(tf.layers.maxPooling2d({poolSize:2,strides:2}));
  model.add(tf.layers.flatten());
  model.add(tf.layers.dense({
    units:3,
    activation:'softmax',
    kernelInitializer:initializer()
  }));
  model.compile({
    optimizer:tf.train.adam(.01),
    loss:'categoricalCrossentropy',
    metrics:['accuracy']
  });
  return model;
}
