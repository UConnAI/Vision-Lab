import test from 'node:test';
import assert from 'node:assert/strict';
import {captureReadings,appendReadings} from '../learning-readings.mjs';
const root = nodes => ({getElementById:id=>nodes[id]});
test('readings preserve mode, selected option labels and actual measured values',()=>{
  const text=captureReadings('playground',root({filter:{tagName:'SELECT',value:'vertical',selectedOptions:[{textContent:'Vertical edge'}]},relu:{type:'checkbox',checked:false},calculation:{textContent:'patch = -1'},status:{textContent:'Mouse / touch mode'}}),'test-time');
  assert.match(text,/test-time/);assert.match(text,/Filter: Vertical edge/);assert.match(text,/ReLU: off/);
  assert.match(text,/Selected patch: patch = -1/);assert.match(text,/Mouse \/ touch mode/);
  assert.match(text,/not an independent accuracy measurement/);
});
test('hidden uncomputed stages and unrelated fields are excluded',()=>{
  const text=captureReadings('deep',root({bpStage:{textContent:'Ready'},bpForward:{hidden:true,textContent:'not calculated yet'},password:{value:'never capture'},video:{textContent:'never capture'}}),'test-time');
  assert.ok(!text.includes('not calculated yet'));assert.ok(!text.includes('never capture'));assert.match(text,/Calculation stage: Ready/);
  assert.match(captureReadings('lecture',root({})) ,/No experiment readings/);
  assert.equal(captureReadings('unknown',root({})), '');
});
test('adding readings never silently truncates or overwrites existing notes',()=>{
  assert.equal(appendReadings('my observation','actual reading'),'my observation\n\nactual reading');
  assert.equal(appendReadings('','actual reading'),'actual reading');
  assert.equal(appendReadings('keep all of this','another reading',20),null);
});

test('camera notes omit simulation controls inside a hidden parent',()=>{
  const text=captureReadings('final',root({
    modeTag:{textContent:'LIVE CAMERA'},
    simLabel:{value:'rock',closest:selector=>selector==='[hidden]'?{}:null},
    lead:{value:'300',closest:()=>null}
  }),'test-time');
  assert.match(text,/Mode: LIVE CAMERA/);
  assert.match(text,/Lock lead: 300/);
  assert.ok(!text.includes('Simulation move'));
});
