import test from 'node:test';
import assert from 'node:assert/strict';
import {convolve,relu,pool,pinchRatio} from '../vision-lab.mjs';
test('edge filter cancels uniform patches and detects both orientations',()=>{
  const k=[[-1,0,1],[-1,0,1],[-1,0,1]];
  assert.deepEqual(convolve([[1,1,1],[1,1,1],[1,1,1]],k),[[0]]);
  assert.deepEqual(convolve([[0,0,1],[0,0,1],[0,0,1]],k),[[3]]);
  assert.deepEqual(convolve([[1,0,0],[1,0,0],[1,0,0]],k),[[-3]]);
});
test('activation and pooling preserve positive maxima and dimensions',()=>{
  assert.deepEqual(pool(relu([[-2,1,4,-1],[3,2,0,2],[1,7,-5,-2],[3,4,-1,-3]])),[[3,4],[7,0]]);
});
test('pinch decision is invariant to uniform scale and translation',()=>{
  const p=Array.from({length:21},()=>({x:0,y:0}));p[5]={x:1,y:1};p[17]={x:3,y:1};p[4]={x:1,y:2};p[8]={x:1.2,y:2};
  assert.ok(pinchRatio(p)<.35);
  assert.ok(Math.abs(pinchRatio(p)-pinchRatio(p.map(q=>({x:q.x*3+10,y:q.y*3-8}))))<1e-10);
  p[8]={x:3,y:2};assert.ok(pinchRatio(p)>.35);
});
