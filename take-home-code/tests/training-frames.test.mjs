import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePositions} from '../csv-core.mjs';
import {splitVisible,trainingFrameTime,validateTrainingFrames} from '../tiny-cnn-core.mjs';

test('valid frame seeks stay inside their own frame including rounded final durations',()=>{
  for(const count of [179,158,346])for(const precisionError of [-.000001,0,.000001]){
    const fps=24,duration=count/fps+precisionError;
    for(const frame of [0,1,count-1]){
      const time=trainingFrameTime(frame,fps,duration);
      assert.equal(Math.floor(time*fps+1e-3),frame);
      assert.ok(time<duration);
    }
    assert.throws(()=>trainingFrameTime(count,fps,duration),/outside this video.*matching video and CSV/);
  }
});

test('distant and malformed indices never clamp to the final video frame',()=>{
  for(const frame of [-1,.5,179,10000,NaN,Infinity])assert.throws(()=>trainingFrameTime(frame,24,179/24),/outside this video/);
  for(const fps of [0,-24,NaN,Infinity])assert.throws(()=>trainingFrameTime(0,fps,1),/positive CSV frame rate/);
  for(const duration of [0,-1,NaN,Infinity])assert.throws(()=>trainingFrameTime(0,24,duration),/known positive duration/);
});

test('all visible CSV labels are validated before sampling can hide an invalid row',()=>{
  const csv='Frame,Visibility,X,Y\n'+Array.from({length:180},(_,frame)=>`${frame},1,10,20`).join('\n');
  const positions=parsePositions(csv);
  const selected=Object.values(splitVisible(positions)).flat();
  assert.ok(!selected.some(row=>row.frame===179),'fixture must place invalid final row between stride samples');
  assert.throws(()=>validateTrainingFrames(positions,24,179/24),/CSV Frame 179.*frames 0–178/);
});

test('sparse in-range visible labels retain their exact frame time and absent rows are not training labels',()=>{
  const positions=parsePositions('Frame,Visibility,X,Y\n0,1,10,20\n17,1,30,40\n178,1,50,60\n999,0,,');
  assert.doesNotThrow(()=>validateTrainingFrames(positions,24,179/24));
  assert.equal(trainingFrameTime(17,24,179/24),17.25/24);
});
