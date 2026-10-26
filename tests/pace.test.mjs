import test from 'node:test';
import assert from 'node:assert/strict';
import {LABELS,pacedMotion,demoRows,train,features,predict,currentGesture} from '../core.mjs';

test('paced artificial training and fresh rounds agree from fast to slow',()=>{
  for(const movementMs of [300,700,1500,2500]){
    const lead=150,duration=600+movementMs,model=train(demoRows(lead,movementMs));
    for(const label of LABELS){
      const samples=Array.from({length:Math.floor(duration/16)+1},(_,i)=>({t:i*16,v:pacedMotion(i*16,label,false,8,movementMs)}));
      assert.equal(predict(model,features(samples,duration-lead)).label,label,`${movementMs}: ${label}`);
      assert.equal(currentGesture(pacedMotion(duration,label,false,8,movementMs)),label);
    }
  }
});
test('fast delayed reveal retains identical early clues and reaches SHOW gesture',()=>{
  const movementMs=300,cutoff=750;
  for(const label of LABELS){
    assert.equal(currentGesture(pacedMotion(cutoff,label,true,0,movementMs)),'rock');
    assert.equal(currentGesture(pacedMotion(900,label,true,0,movementMs)),label);
  }
});
