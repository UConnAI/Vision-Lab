import test from 'node:test';
import assert from 'node:assert/strict';
import {fingerMovement} from '../core.mjs';
test('partial tracking reports moving fingers without inventing a gesture',()=>{
  const samples=[{t:10,v:[.3,.3,.3,.3]},{t:50,v:[.7,.6,.31,.32]},{t:200,v:[1,1,1,1]}];
  assert.deepEqual(fingerMovement(samples,100),{names:['Index','Middle'],available:true});
});
test('unavailable measurements differ from observed fingers with no clear change',()=>{
  assert.deepEqual(fingerMovement([],100),{names:[],available:false});
  assert.deepEqual(fingerMovement([{t:1,v:[.3,.3,.3,.3]},{t:2,v:[.31,.31,.31,.31]}]),{names:[],available:true});
});
