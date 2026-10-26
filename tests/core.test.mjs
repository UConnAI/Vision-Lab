import test from 'node:test';
import assert from 'node:assert/strict';
import {LABELS,counter,outcome,features,train,predict,evaluate,simulated,openness,currentGesture} from '../core.mjs';
const motion=(label,late=false,variation=0)=>Array.from({length:91},(_,i)=>({t:i*33,v:simulated(i*33,label,late,variation)}));
const rows=LABELS.flatMap(label=>[0,1,2].map(i=>({label,x:features(motion(label,false,i),2700)})));
test('visible-shape labels handle all moves and ambiguous shapes',()=>{
  assert.equal(currentGesture([0.3,0.3,0.3,0.3]),'rock');
  assert.equal(currentGesture([0.95,0.95,0.95,0.95]),'paper');
  assert.equal(currentGesture([0.95,0.95,0.3,0.3]),'scissors');
  assert.equal(currentGesture([0.7,0.7,0.7,0.7]),'unclear');
  assert.equal(currentGesture([0.9,0.3,0.3,0.3]),'unclear');
});
test('future and stale frames cannot enter early features',()=>{
  const early=motion('paper').filter(x=>x.t<=2700);
  assert.deepEqual(features([...early,{t:2800,v:[999,999,999,999]}],2700),features(early,2700));
  assert.equal(features(early,3100),null);
});
test('insufficient count and span reject a round',()=>{
  assert.equal(features([{t:2650,v:[1,1,1,1]},{t:2700,v:[1,1,1,1]}],2700),null);
  assert.equal(features([2660,2670,2680,2690].map(t=>({t,v:[1,1,1,1]})),2700),null);
  assert.equal(features([],2700),null);
});
test('rates use elapsed seconds',()=>{
  const s=[0,100,200,300].map(t=>({t,v:Array(4).fill(0.3+t/1000)}));
  const x=features(s,300);assert.ok(Math.abs(x[0]-0.6)<1e-10);assert.ok(Math.abs(x[4]-1)<1e-10);
});
test('all classes need three training rounds',()=>{
  assert.equal(train(rows.slice(1)),null);assert.equal(train([]),null);
});
test('fresh artificial traces classified after fitting on training only',()=>{
  const m=train(rows);LABELS.forEach(l=>assert.equal(predict(m,features(motion(l,false,9),2700)).label,l));
});
test('late motion is ambiguous at cutoff',()=>{
  const x=LABELS.map(l=>features(motion(l,true),2700));assert.deepEqual(x[0],x[1]);assert.deepEqual(x[1],x[2]);
  const m=train(rows);assert.equal(new Set(x.map(v=>predict(m,v).label)).size,1);
});
test('prediction and evaluation do not mutate trained centers',()=>{
  const m=train(rows),saved=JSON.stringify(m);predict(m,Array(8).fill(999));evaluate([{label:'paper',guess:'rock',baseline:'rock'}]);assert.equal(JSON.stringify(m),saved);
});
test('evaluation reports confusion and excludes invalid guesses',()=>{
  const e=evaluate([{label:'rock',guess:'paper',baseline:'rock'},{label:'paper',guess:'paper',baseline:'rock'},{label:'scissors',guess:null,baseline:'rock'}]);
  assert.equal(e.n,2);assert.equal(e.correct,1);assert.equal(e.baseline,1);assert.equal(e.matrix[0][1],1);assert.equal(e.matrix[1][1],1);
});
test('all game outcomes and counters',()=>{
  LABELS.forEach(l=>{assert.equal(outcome(l,l),'Tie');assert.equal(outcome(counter(l),l),'Computer wins');assert.equal(outcome(l,counter(l)),'You win');});
});
test('straight and folded finger geometry',()=>{
  const p=Array.from({length:21},()=>({x:0,y:0,z:0}));
  [5,9,13,17].forEach(i=>[0,1,2,3].forEach(j=>p[i+j]={x:j,y:0,z:0}));assert.deepEqual(openness(p),[1,1,1,1]);
  [5,9,13,17].forEach(i=>{p[i+2]={x:1,y:1,z:0};p[i+3]={x:0,y:1,z:0};});openness(p).forEach(x=>assert.ok(Math.abs(x-1/3)<1e-10));
});
