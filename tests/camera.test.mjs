import test from 'node:test';
import assert from 'node:assert/strict';
import {requestCamera,cameraError} from '../camera.mjs';
test('camera requested without audio or restrictive resolution',async()=>{
  let asked;
  const stream={getTracks:()=>[]};
  assert.equal(await requestCamera({getUserMedia:async c=>{asked=c;return stream;}}),stream);
  assert.equal(asked.audio,false);assert.equal(asked.video.width.ideal,640);
});
test('permission failures remain specific',async()=>{
  const e=Object.assign(new Error('Permission denied by system'),{name:'NotAllowedError'});
  await assert.rejects(requestCamera({getUserMedia:async()=>{throw e;}}),e);
  assert.match(cameraError(e),/operating system/);assert.match(cameraError(e),/Permission denied by system/);
});
test('selected camera is requested by exact device ID',async()=>{
  let asked;await requestCamera({getUserMedia:async c=>{asked=c;return {}; }},'usb-camera');
  assert.deepEqual(asked.video.deviceId,{exact:'usb-camera'});
});
test('unsupported capture receives actionable recovery',async()=>{
  await assert.rejects(requestCamera(undefined),{name:'UnsupportedError'});
});
test('resolution incompatibility falls back to unrestricted video',async()=>{
  const calls=[];const stream={};
  const media={getUserMedia:async c=>{calls.push(c);if(calls.length===1)throw Object.assign(new Error('constraints'),{name:'OverconstrainedError'});return stream;}};
  assert.equal(await requestCamera(media),stream);assert.deepEqual(calls[1],{video:true,audio:false});
});
test('ignored permission times out and closes late camera stream',async()=>{
  let resolve,stopped=false;
  const media={getUserMedia:()=>new Promise(r=>resolve=r)};
  await assert.rejects(requestCamera(media,'',5),{name:'TimeoutError'});
  resolve({getTracks:()=>[{stop:()=>stopped=true}]});await new Promise(r=>setTimeout(r,0));
  assert.equal(stopped,true);
});
