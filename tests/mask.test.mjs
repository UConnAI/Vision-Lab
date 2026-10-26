import test from 'node:test';
import assert from 'node:assert/strict';
import {MASK_FILTERS,maskStrength,outputPixel,inspectMaskPatch} from '../mask-core.mjs';
import {analyzePhoto} from '../photo-core.mjs';
test('vertical and horizontal Sobel filters separate boundary orientations',()=>{
 const vertical=Array.from({length:5},()=>[0,0,1,1,1]);
 const horizontal=Array.from({length:5},(_,y)=>Array(5).fill(y>=2?1:0));
 assert.equal(inspectMaskPatch(vertical,MASK_FILTERS.vertical,0,0).score,4);
 assert.equal(inspectMaskPatch(vertical,MASK_FILTERS.horizontal,0,0).score,0);
 assert.equal(inspectMaskPatch(horizontal,MASK_FILTERS.horizontal,0,0).score,4);
 assert.equal(inspectMaskPatch(horizontal,MASK_FILTERS.vertical,0,0).score,0);
 assert.equal(maskStrength(4,MASK_FILTERS.vertical),.5);
 assert.equal(maskStrength(-4,MASK_FILTERS.vertical),.5);
});
test('every response maps to its original center and matches the nine displayed products',()=>{
 const input=Array.from({length:7},(_,y)=>Array.from({length:9},(_,x)=>(x*y%11)/11));
 for(const kernel of Object.values(MASK_FILTERS)){
  const result=analyzePhoto(input,kernel,0,{relu:false});
  assert.equal(result.responses.length,5);assert.equal(result.responses[0].length,7);
  result.responses.forEach((values,row)=>values.forEach((score,column)=>{
   const trace=inspectMaskPatch(input,kernel,row,column);
   assert.equal(trace.score,score);assert.equal(trace.terms.length,9);
   assert.deepEqual(outputPixel(row,column),{x:column+1,y:row+1});
  }));
 }
});
test('flat images and zero kernels give no edge evidence; weight scale preserves strength',()=>{
 const flat=Array.from({length:4},()=>Array(4).fill(.5));
 for(const kernel of Object.values(MASK_FILTERS))assert.equal(inspectMaskPatch(flat,kernel,0,0).score,0);
 assert.equal(maskStrength(0,Array.from({length:3},()=>[0,0,0])),0);
 assert.equal(maskStrength(8,MASK_FILTERS.vertical.map(r=>r.map(v=>v*2))),.5);
 assert.throws(()=>inspectMaskPatch(flat,MASK_FILTERS.vertical,2,0),/fit/);
});
