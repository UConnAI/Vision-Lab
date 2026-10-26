import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {SPECS,splitVisible,centerError,buildModel} from '../tiny-cnn-core.mjs';
import {parsePositions} from '../csv-core.mjs';
const require=createRequire(import.meta.url),tf=require('../../take-home-football-tracker/vendor/tf.min.js');
test('the real CSV parser supplies frame numbers through its Map keys',()=>{
  const text='Frame,Visibility,X,Y\n'+Array.from({length:30},(_,i)=>`${i*2},1,20,30`).join('\n');
  const all=Object.values(splitVisible(parsePositions(text))).flat();
  assert.equal(all[0].frame,0);assert.equal(all.at(-1).frame,58);assert.ok(all.every(p=>Number.isInteger(p.frame)));
});
test('chronological visible-only split has no overlap and ignores absent labels',()=>{
  const positions=new Map(Array.from({length:100},(_,i)=>[i,{frame:99-i,visible:i%5!==0,x:20,y:30}]));
  const split=splitVisible(positions,36),all=Object.values(split).flat();
  assert.ok(all.length<=36);assert.equal(new Set(all.map(p=>p.frame)).size,all.length);
  assert.ok(all.every(p=>p.visible));assert.ok(split.train.at(-1).frame<split.validation[0].frame);assert.ok(split.validation.at(-1).frame<split.test[0].frame);
  assert.throws(()=>splitVisible(new Map()));
});
test('center metric uses original video pixels, not a claimed accuracy score',()=>{
  assert.equal(centerError([[.5,.5]],[{x:50,y:25}],100,50),0);
  assert.equal(centerError([[.6,.5]],[{x:50,y:25}],100,50),10);
  assert.throws(()=>centerError([],[],100,50));
});
test('all three tiny CNNs have expected parameter counts and predict two bounded coordinates',async()=>{
  await tf.setBackend('cpu');await tf.ready();
  const input=tf.zeros([1,18,32,3]);
  for(const [i,spec]of SPECS.entries()){
    const model=buildModel(tf,spec),prediction=model.predict(input),values=await prediction.data();
    assert.equal(model.countParams(),[1266,922,1870][i]);assert.deepEqual(prediction.shape,[1,2]);assert.ok([...values].every(v=>v>=0&&v<=1));
    prediction.dispose();model.optimizer.dispose();model.dispose();
  }
  input.dispose();
});
test('actual optimizer updates reduce coordinate loss on a controlled training example',async()=>{
  const model=buildModel(tf,SPECS[0]),input=tf.ones([4,18,32,3]),target=tf.tensor2d([[.8,.2],[.8,.2],[.8,.2],[.8,.2]]);
  const before=model.evaluate(input,target),initial=(await before.data())[0];before.dispose();
  await model.fit(input,target,{epochs:12,batchSize:4,shuffle:false,verbose:0});
  const after=model.evaluate(input,target);assert.ok((await after.data())[0]<initial*.5);
  after.dispose();model.optimizer.dispose();model.dispose();input.dispose();target.dispose();
});
