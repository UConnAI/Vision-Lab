import test from 'node:test';
import assert from 'node:assert/strict';
import {initialParameters,sgdStep} from '../math-backprop-core.mjs';
import {FLOW_STAGES,parameterRows,flowSnapshot} from '../math-backprop-visual.mjs';
test('all fifteen visual parameter proposals use one unchanged gradient snapshot',()=>{
  const parameters=initialParameters(),original=JSON.stringify(parameters),step=sgdStep(parameters,1,.1),rows=parameterRows(parameters,step.gradients,.1);
  assert.equal(rows.length,15);assert.equal(new Set(rows.map(row=>row.name)).size,15);
  const expected=[...step.updated.kernel.flat(),step.updated.convBias,...step.updated.dense.flat(),...step.updated.denseBias];
  rows.forEach((row,i)=>{assert.ok(Math.abs(row.next-expected[i])<1e-12);assert.ok(Math.abs(row.delta+.1*row.gradient)<1e-12);});
  assert.equal(JSON.stringify(parameters),original);
});
test('visual preview, simultaneous commit and fresh-forward stages preserve the training boundary',()=>{
  const parameters=initialParameters(),before=JSON.stringify(parameters);
  for(let phase=10;phase<=24;phase++){const state=flowSnapshot(parameters,1,.1,phase);assert.equal(state.parameters,parameters);assert.equal(state.steps,0);}
  const committed=flowSnapshot(parameters,1,.1,25),fresh=flowSnapshot(parameters,1,.1,26);
  assert.equal(FLOW_STAGES.length,28);assert.equal(committed.steps,1);assert.equal(fresh.stage,3);assert.deepEqual(committed.parameters,fresh.candidate.updated);assert.ok(fresh.candidate.after.loss<fresh.forward.loss);assert.equal(JSON.stringify(parameters),before);
});
