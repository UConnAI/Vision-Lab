import test from 'node:test';
import assert from 'node:assert/strict';
import {observationRows,coverageCounts} from '../observations.mjs';
import {trajectory} from '../tracking.mjs';

test('accepted CNN observations take priority; appearance quality is not a CNN confidence',()=>{
  const box={class:'sports ball',bbox:[10,20,30,30],score:.6},appearance={class:'sports ball',bbox:[12,22,28,28],score:.4,source:'appearance'};
  const rows=[{t:0,objects:[box],appearance},{t:.1,objects:[],appearance},{t:.2,objects:[]}];
  const saved=structuredClone(rows),selected=observationRows(rows,.5);
  assert.equal(selected[0].objects[0].source,'cnn');
  assert.equal(selected[1].objects[0].source,'appearance');
  assert.equal(selected[1].objects[0].score,.4);
  assert.deepEqual(rows,saved);
  assert.deepEqual(coverageCounts(trajectory(selected,0)),{cnn:1,appearance:1,missing:1,total:3});
  assert.equal(observationRows(rows,.7)[0].objects[0].source,'appearance');
  assert.equal(observationRows(rows,.7,false)[0].objects.length,0);
});
