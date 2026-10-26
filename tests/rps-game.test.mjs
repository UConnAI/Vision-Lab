import test from 'node:test';
import assert from 'node:assert/strict';
import {stableGesture,seededMoves} from '../rps-game-core.mjs';
import {counter,outcome} from '../core.mjs';
test('recognition locks only after consecutive fresh samples of the same gesture',()=>{let s=null;for(let t=0;t<=500;t+=100)s=stableGesture(s,'paper',t,500);assert.equal(s.locked,true);assert.equal(stableGesture(s,'rock',550,500).locked,false);assert.equal(stableGesture(s,'unclear',550,500).progress,0);assert.equal(stableGesture(s,'paper',900,500).progress,0);});
test('moves reproduce seed 314 and counter rule beats each gesture',()=>{const a=seededMoves(314),b=seededMoves(314);const draws=Array.from({length:30},()=>a());assert.deepEqual(draws,Array.from({length:30},()=>b()));assert.equal(new Set(draws).size,3);for(const move of ['rock','paper','scissors'])assert.equal(outcome(counter(move),move),'Computer wins');});
