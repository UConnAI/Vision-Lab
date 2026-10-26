import test from 'node:test';
import assert from 'node:assert/strict';
import {seekDecoded} from '../video-frame.mjs';
class Video extends EventTarget{currentTime=0;readyState=2;requestVideoFrameCallback(){throw new Error('Identical frames need not be presented again.');}}
test('decoded identical frames are sampled after seeked without waiting for a presentation callback',async()=>{
  const video=new Video(),pending=seekDecoded(video,.2);assert.equal(video.currentTime,.2);video.dispatchEvent(new Event('seeked'));await pending;
});
test('same decoded position resolves immediately and invalid seek times fail',async()=>{
  const video=new Video();await seekDecoded(video,0);await assert.rejects(seekDecoded(video,NaN));await assert.rejects(seekDecoded(video,-1));
});
test('missing decoded pixels and decoder errors fail explicitly',async()=>{
  const video=new Video();video.readyState=1;let pending=seekDecoded(video,1);video.dispatchEvent(new Event('seeked'));await assert.rejects(pending,/no decoded pixels/);
  pending=seekDecoded(video,2);video.dispatchEvent(new Event('error'));await assert.rejects(pending,/could not be decoded/);
});
test('a stuck decoder times out rather than leaving analysis busy forever',async()=>{
  await assert.rejects(seekDecoded(new Video(),1,{timeoutMs:5}),/did not decode in time/);
});
