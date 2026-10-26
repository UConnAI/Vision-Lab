import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {patchOrigin,weightPixel,setPixelWeight,searchPixelEyes,pixelContribution,catTestViews,testCatKernel} from '../pixel-eye-core.mjs';
const fixtures=JSON.parse(readFileSync(new URL('../assets/eye-pixel-lab.json',import.meta.url),'utf8'));
test('the same hand-designed 4x4 filter finds both human eye pairs with zero extras',()=>{
  assert.deepEqual(fixtures.astronaut.weights,fixtures.hopper.weights);
  for(const key of ['astronaut','hopper','cat']){
    const d=fixtures[key],r=searchPixelEyes(d,d.weights,d.threshold);
    assert.deepEqual(r.grade,{found:2,expected:2,extra:0,passed:true},key);
    assert.equal(r.scan.templates.length,1);
    assert.equal(r.scan.scanned,(d.width-3)*(d.height-3));
    assert.equal(d.weights.length,16);assert.ok(d.weights.every(v=>v===-1||v===1));
    assert.equal(searchPixelEyes(d,Array(16).fill(0),d.threshold).grade.passed,false);
  }
});
test('cat test is solvable by three sign repairs while all twelve fixed cells remain unchanged',()=>{
  const d=fixtures.cat;let values=d.starter.slice();
  assert.equal(d.editable.length,4);assert.equal(searchPixelEyes(d,values,d.threshold).grade.passed,false);
  let changes=0;
  for(const index of d.editable)if(values[index]!==d.weights[index]){values=setPixelWeight(values,index,d.weights[index],d.editable);changes++;}
  assert.equal(changes,3);assert.equal(searchPixelEyes(d,values,d.threshold).grade.passed,true);
  d.starter.forEach((value,index)=>{if(!d.editable.includes(index))assert.equal(values[index],value);});
  assert.throws(()=>setPixelWeight(values,0,0,d.editable),/fixed/);
  assert.throws(()=>setPixelWeight(values,4,2,d.editable),/Use/);
});
test('all sixteen weights map to the exact same relative row and column of the selected image patch',()=>{
  const image=fixtures.astronaut,origin=patchOrigin(image,10,8);
  for(let index=0;index<16;index++){
    const p=weightPixel(origin,index),trace=pixelContribution(image,image.weights,origin,index);
    assert.equal(p.x,origin.x+index%4);assert.equal(p.y,origin.y+Math.floor(index/4));
    assert.equal(trace.pixel,image.pixels[p.y*image.width+p.x]);
    assert.equal(trace.patch[index],trace.pixel);
    assert.equal(trace.product,(trace.weight-trace.weightMean)*(trace.pixel-trace.pixelMean));
  }
  assert.deepEqual(patchOrigin(image,-50,-50),{x:0,y:0});
  assert.deepEqual(patchOrigin(image,999,999),{x:image.width-4,y:image.height-4});
  assert.throws(()=>weightPixel(origin,16),/16 weights/);
});
test('manual from-scratch construction solves the real photographic fixtures without fitting any weights',()=>{
  for(const key of ['astronaut','hopper']){
    const d=fixtures[key];let values=Array(16).fill(1);
    assert.equal(searchPixelEyes(d,values,.6).grade.passed,false);
    for(const index of [4,5,6])values=setPixelWeight(values,index,-1,d.editable);
    assert.equal(searchPixelEyes(d,values,.6).grade.passed,true);
    assert.ok(searchPixelEyes(d,values,.95).grade.found<2);
  }
});

test('one cat kernel passes all controlled views, while starter and over-strict threshold fail',()=>{
  const d=fixtures.cat,views=catTestViews(d);
  assert.equal(views.length,3);
  assert.ok(testCatKernel(d,d.weights,.65).every(r=>r.passed&&r.found===2&&r.extra===0));
  assert.ok(testCatKernel(d,d.starter,.65).some(r=>!r.passed));
  assert.ok(testCatKernel(d,d.weights,.95).every(r=>!r.passed));
  assert.ok(testCatKernel(d,Array(16).fill(0),.65).every(r=>r.found===0));
  assert.deepEqual(views[1].inspect[0],[d.inspect[0][0]+1,d.inspect[0][1]+2]);
  assert.equal(views[1].pixels[2*views[1].width+1],d.pixels[0]*.65+25);
});
