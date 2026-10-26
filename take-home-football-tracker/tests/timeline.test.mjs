import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleTimes,videoEnd} from '../timeline.mjs';
import {trajectory,pointAt} from '../tracking.mjs';

function checkTimes(duration,fps=10) {
  const times=sampleTimes(duration,fps);
  assert.equal(times[0],0);
  assert.equal(times.at(-1),videoEnd(duration));
  assert.equal(new Set(times).size,times.length);
  assert(times.every((time,index)=>Number.isFinite(time)&&time>=0&&time<duration&&(index===0||time>times[index-1])));
  assert(duration-times.at(-1)<.101);
  return times;
}

test('full-video sampling continues beyond ten seconds without a hidden cutoff',()=>{
  const times=checkTimes(23.347);
  assert(times.includes(10));
  assert(times.includes(20));
  assert(times.at(-1)>23.34);
  assert.equal(times.length,235);
  assert.equal(checkTimes(1200).length,12001);
});

test('soccer and ping-pong durations include their final partial sample interval',()=>{
  assert.equal(checkTimes(7.47).length,76);
  assert.equal(checkTimes(6.6).length,67);
  assert.equal(checkTimes(7.501).at(-1),7.5);
});

test('shorter-than-one-frame clips retain zero and a safe final decoded timestamp',()=>{
  for(const duration of [.04,.001,.0001,Number.MIN_VALUE])checkTimes(duration);
  assert.deepEqual(sampleTimes(.04),[0,.039]);
  assert.deepEqual(sampleTimes(.001),[0,.0005]);
});

test('invalid duration/rate and unsafe allocations fail explicitly instead of hanging or truncating',()=>{
  for(const duration of [0,-1,NaN,Infinity,-Infinity])assert.throws(()=>sampleTimes(duration),RangeError);
  for(const fps of [0,-1,NaN,Infinity])assert.throws(()=>sampleTimes(1,fps),RangeError);
  assert.throws(()=>sampleTimes(Number.MAX_VALUE),RangeError);
  assert.throws(()=>sampleTimes(1,Number.MAX_VALUE),RangeError);
});

test('accepted samples supply a continuous position through the full playback endpoint',()=>{
  const duration=23.347;
  const times=sampleTimes(duration);
  const rows=trajectory(times.map(t=>({t,objects:[{class:'sports ball',score:.9,bbox:[t*10,10,10,10]}]})),.35);
  for(const time of [0,.01,7.47,10,15.05,23.3,videoEnd(duration),duration]) {
    const point=pointAt(rows,time);
    assert(point,`No playback position at ${time}`);
    assert(Math.abs(point.x-(Math.min(time,videoEnd(duration))*10+5))<1e-9);
  }
  assert.equal(pointAt(rows,videoEnd(duration)).kind,'detected');
  assert.equal(pointAt(rows,duration).kind,'held');
  assert.equal(pointAt(rows,duration+.2),null);
});
