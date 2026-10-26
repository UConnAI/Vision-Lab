import test from 'node:test';
import assert from 'node:assert/strict';
import {assessEarlyEvidence} from '../early-evidence.mjs';
import {features} from '../core.mjs';
const samples = times => times.map(t=>({t,v:[.3+t/10000,.4,.5,.6]}));
test('accepted evidence uses exactly the existing feature vector and ignores future samples',()=>{
 const rows=samples([0,600,700,800,900,1000,1100]);const result=assessEarlyEvidence(rows,1000,1010,1300);
 assert.deepEqual(result.x,features(rows,1000));assert.equal(result.quality.count,5);assert.equal(result.quality.reason,'ready');
 assert.equal(result.quality.actualLeadMs,290);assert.equal(result.quality.lockDelayMs,10);
});
test('the cutoff still rejects count, freshness, and time-span failures with specific reasons',()=>{
 for(const [times,reason] of [[[900,1000],'too-few-frames'],[[600,650,700,800],'stale-frames'],[[960,970,980,990],'short-window']]) {
  const result=assessEarlyEvidence(samples(times),1000,1010,1300);
  assert.equal(result.x,null);assert.equal(result.quality.reason,reason);assert.equal(features(samples(times),1000),null);
 }
 const empty=assessEarlyEvidence([],1000,1010,1300);assert.equal(empty.quality.ageMs,null);assert.match(empty.message,/Only 0/);
});
test('a late lock is rejected even with enough pre-cutoff frames',()=>{
 const rows=samples([700,800,900,1000]);assert.ok(features(rows,1000));
 for(const time of [1300,1400]){const result=assessEarlyEvidence(rows,1000,time,1300);assert.equal(result.x,null);assert.equal(result.quality.reason,'missed-deadline');assert.equal(result.quality.actualLeadMs,0);}
});
test('boundary windows retain the exact 450ms, 150ms and 100ms rules',()=>{
 for(const times of [[550,650,750,850],[750,780,810,850],[900,930,960,1000]]) {
  const rows=samples(times),result=assessEarlyEvidence(rows,1000,1000,1300);
  assert.deepEqual(result.x,features(rows,1000));assert.equal(result.quality.reason,'ready');
 }
});
