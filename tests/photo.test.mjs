import test from 'node:test';
import assert from 'node:assert/strict';
import {grayscaleRows,smoothPhoto,analyzePhoto,nextPhotoPatch} from '../photo-core.mjs';
import {KERNELS,convolve} from '../opening.mjs';
test('photograph pixels become normalized grayscale using all three color channels',()=>{
  const data=new Uint8ClampedArray(3*3*4);for(let i=0;i<data.length;i+=4){data[i]=255;data[i+3]=255;}
  const rows=grayscaleRows(data,3,3);assert.ok(Math.abs(rows[0][0]-.299)<1e-12);
  assert.throws(()=>grayscaleRows(data,2,3));assert.throws(()=>grayscaleRows([],3,3));
});

test('photo scan matches the teaching convolution for every preset, smoothing and ReLU',()=>{
  const image=Array.from({length:7},(_,row)=>Array.from({length:9},(_,column)=>((row*91+column*37+314)%256)/255));
  for(const kernel of Object.values(KERNELS))for(const smooth of [false,true])for(const relu of [false,true]){
    const result=analyzePhoto(image,kernel,.15,{smooth,relu});
    assert.deepEqual(result.responses,convolve(smooth?smoothPhoto(image):image,kernel,relu));
  }
  assert.throws(()=>analyzePhoto(image,[[1]],0));
  assert.throws(()=>analyzePhoto([[1,2,3],[1],[1,2,3]],KERNELS.mean,0));
});

test('animated scan advances one output pixel, wraps to the next row, then loops',()=>{
  assert.deepEqual(nextPhotoPatch(0,0,5,6),{row:0,column:1});
  assert.deepEqual(nextPhotoPatch(0,3,5,6),{row:1,column:0});
  assert.deepEqual(nextPhotoPatch(2,3,5,6),{row:0,column:0});
  assert.deepEqual(nextPhotoPatch(0,0,3,3),{row:0,column:0});
  assert.throws(()=>nextPhotoPatch(0,0,2,6));
});
test('constant brightness has no edge response, even after border-preserving smoothing',()=>{
  const image=Array.from({length:5},()=>Array(6).fill(.7));
  const smoothed=smoothPhoto(image);assert.equal(smoothed.length,5);assert.equal(smoothed[0].length,6);
  const result=analyzePhoto(image,KERNELS.vertical,.01,{smooth:true});
  assert.equal(result.responses.length,3);assert.equal(result.responses[0].length,4);assert.equal(result.matches.length,0);
});
test('thresholded matches refer to actual patch centers, and ReLU preserves the chosen sign rule',()=>{
  const image=[[1,1,1],[0,0,0],[0,0,0]];
  assert.deepEqual(analyzePhoto(image,KERNELS.eyebrow,2.5).matches,[{row:1,column:1,score:3}]);
  assert.equal(analyzePhoto(image,KERNELS.eyebrow,3).matches.length,0);
  const reversed=[...image].reverse();assert.equal(analyzePhoto(reversed,KERNELS.eyebrow,0).responses[0][0],0);
  assert.equal(analyzePhoto(reversed,KERNELS.eyebrow,0,{relu:false}).responses[0][0],-3);
  assert.throws(()=>analyzePhoto(image,KERNELS.eyebrow,NaN));
});
