import test from 'node:test';
import assert from 'node:assert/strict';
import {demoRows,train,predict,pretrainedGesture,simulated} from '../core.mjs';
import {cartoonPoints} from '../cartoon.mjs';
test('artificial presets can seed camera play at each offered cutoff',()=>{
  for(const lead of [150,300,600,900]){
    const rows=demoRows(lead);assert.equal(rows.length,9);assert.ok(rows.every(r=>r.x?.length===8&&r.source==='simulation'&&r.lead===lead));
    const model=train(rows);assert.ok(model);assert.ok(predict(model,rows[0].x));
  }
});
test('pretrained categories map to RPS without guessing on unsupported shapes',()=>{
  for(const [categoryName,label] of [['Closed_Fist','rock'],['Open_Palm','paper'],['Victory','scissors']])assert.equal(pretrainedGesture({categoryName,score:0.9}),label);
  assert.equal(pretrainedGesture({categoryName:'Thumb_Up',score:0.95}),'unclear');assert.equal(pretrainedGesture({categoryName:'Victory',score:0.1}),'unclear');assert.equal(pretrainedGesture(null),'unclear');
});
test('cartoon uses 21 bounded points and different finger poses',()=>{
  const fist=cartoonPoints(simulated(0,'rock')),paper=cartoonPoints(simulated(3000,'paper')),scissors=cartoonPoints(simulated(3000,'scissors'));
  for(const pose of [fist,paper,scissors]){assert.equal(pose.length,21);assert.ok(pose.every(p=>p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1));}
  assert.ok(paper[8].y<fist[8].y);assert.ok(scissors[8].y<scissors[16].y);assert.ok(scissors[12].y<scissors[20].y);
});
