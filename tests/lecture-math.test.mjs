import test from 'node:test';
import assert from 'node:assert/strict';
import {convolutionShape,smoothPositions,intersectionOverUnion} from '../lecture-math.mjs';
test('convolution calculator covers actual playground and a multichannel convolution',()=>{assert.deepEqual(convolutionShape(8,3,1,0,1,1),{output:6,parameters:10,activations:36});assert.deepEqual(convolutionShape(16,3,1,0,1,8),{output:14,parameters:80,activations:1568});assert.equal(convolutionShape(32,3,2,1,3,16).output,16);assert.throws(()=>convolutionShape(2,5,1,0,1,1));});
test('smoothing chart exposes lag and follows a direction reversal',()=>{assert.deepEqual(smoothPositions([0,10,0],.5),[0,5,2.5]);assert.deepEqual(smoothPositions([0,10,0],0),[0,10,0]);assert.throws(()=>smoothPositions([1],1));});
test('IoU demo uses overlap rather than center proximity or confidence',()=>{assert.equal(intersectionOverUnion([0,0,10,10],[0,0,10,10]),1);assert.equal(intersectionOverUnion([0,0,10,10],[5,0,10,10]),1/3);assert.equal(intersectionOverUnion([0,0,10,10],[10,0,10,10]),0);assert.equal(intersectionOverUnion([0,0,0,10],[0,0,10,10]),0);});
