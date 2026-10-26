import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyDiagonal,brightSquare,kernelResponse,convolve,featureImage,featureMatches,KERNELS} from '../opening.mjs';

test('diagonal names agree with visual orientation and ties remain unclassified',()=>{
 assert.deepEqual(classifyDiagonal([[1,-1],[-1,1]]),{score:4,label:'backslash',terms:[1,1,1,1]});
 assert.equal(classifyDiagonal([[-1,1],[1,-1]]).label,'slash');
 assert.equal(classifyDiagonal([[-1,1],[1,-1]]).score,-4);
 assert.deepEqual(classifyDiagonal([[1,1],[1,1]]),{score:0,label:'no preference',terms:[1,-1,-1,1]});
});
test('sliding edge responses preserve polarity, every product and five by five dimensions',()=>{
 const image=brightSquare(),saved=structuredClone(image),kernel=KERNELS.vertical;
 assert.deepEqual(convolve(image,kernel),[[1,1,0,-1,-1],[2,2,0,-2,-2],[3,3,0,-3,-3],[2,2,0,-2,-2],[1,1,0,-1,-1]]);
 const positive=kernelResponse(image,kernel,2,1),negative=kernelResponse(image,kernel,2,3,true);
 assert.equal(positive.terms.length,9);assert.equal(positive.terms.reduce((s,t)=>s+t.product,0),3);
 assert.equal(negative.raw,-3);assert.equal(negative.output,0);assert.deepEqual(image,saved);
});
test('mean and sharpen have their expected constant-image response without pretending to learn',()=>{
 const image=Array.from({length:5},()=>Array(5).fill(2));
 for(const value of convolve(image,KERNELS.mean).flat())assert(Math.abs(value-2)<1e-12);
 assert(convolve(image,KERNELS.sharpen).flat().every(value=>value===2));
});
test('a non-face decoy triggers the same local feature rule and threshold is strict',()=>{
 const image=featureImage('stripes'),result=featureMatches(image,KERNELS.eyebrow,1.5);
 assert.equal(result.matches.length,14);assert(result.matches.every(match=>match.score===3));
 assert.equal(featureMatches(image,KERNELS.eyebrow,3).matches.length,0);
 const face=featureImage(),rotated=featureImage('rotated');
 assert.equal(rotated[0][0],face[8][0]);assert.deepEqual(featureImage(),face);
});
test('invalid matrices, impossible patches and nonfinite values fail explicitly',()=>{
 assert.throws(()=>classifyDiagonal([[1]]),RangeError);
 assert.throws(()=>convolve([[1,2],[3]],[[1]]),RangeError);
 assert.throws(()=>kernelResponse(brightSquare(),KERNELS.vertical,5,0),RangeError);
 assert.throws(()=>convolve([[NaN]],[[1]]),RangeError);
 assert.throws(()=>featureMatches(featureImage(),KERNELS.eyebrow,Infinity),RangeError);
});
