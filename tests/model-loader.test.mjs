import test from 'node:test';
import assert from 'node:assert/strict';
import {loadVision} from '../model-loader.mjs';

test('a failed module import retries with a distinct local URL',async()=>{
  const seen=[],module={GestureRecognizer:{}};
  const result=await loadVision({baseURL:'http://127.0.0.1:4322/model-loader.mjs',token:314,importer:async url=>{seen.push(url);if(seen.length===1)throw new Error('Failed to fetch dynamically imported module');return module;},fetcher:()=>assert.fail('No diagnostic fetch after recovery')});
  assert.equal(result,module);assert.equal(seen.length,2);assert.notEqual(seen[0],seen[1]);
  assert.equal(new URL(seen[1]).pathname,'/vendor/vision_bundle.mjs');
});
test('missing packaged module reports HTTP error and complete-folder recovery',async()=>{
  await assert.rejects(loadVision({importer:async()=>{throw new Error('fetch failed');},fetcher:async()=>new Response('',{status:404})}),/HTTP 404.*complete workshop folder/);
});
test('unavailable server explains retry and keeping launcher running',async()=>{
  await assert.rejects(loadVision({importer:async()=>{throw new Error('fetch failed');},fetcher:async()=>{throw new Error('connection refused');}}),/Keep the workshop launcher running.*Retry hand tracking/);
});
