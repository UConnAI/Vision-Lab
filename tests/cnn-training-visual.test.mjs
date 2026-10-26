import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {TRAINING_NODES,TRAINING_STEPS,trainingProgress,trainingSnapshot,createEpochHistory} from '../cnn-training-visual-core.mjs';
import {createToyModel,makeSplits,PARAMETER_COUNT} from '../cnn-lab-core.mjs';
const require=createRequire(import.meta.url),tf=require('../take-home-football-tracker/vendor/tf.min.js');

test('diagram parameter counts and backward order match the implemented symbol CNN',()=>{
  assert.equal(TRAINING_NODES.reduce((sum,node)=>sum+node.parameters,0),PARAMETER_COUNT);
  assert.deepEqual(TRAINING_STEPS.filter(step=>step.direction==='backward').map(step=>step.node),['scores','flatten','conv2','pool1','conv1','input']);
  assert.equal(TRAINING_STEPS.filter(step=>step.direction==='update').length,1);
  assert.ok(TRAINING_STEPS.findIndex(step=>step.direction==='update')>TRAINING_STEPS.findLastIndex(step=>step.direction==='backward'));
});

test('measured progress counts 144 actual batch updates across 12 epochs',()=>{
  assert.deepEqual(trainingProgress(0),{completed:0,total:144,epoch:1,percent:0});
  assert.equal(trainingProgress(12).epoch,2);
  assert.deepEqual(trainingProgress(144),{completed:144,total:144,epoch:12,percent:100});
  assert.equal(trainingProgress(145).completed,144);
});

test('actual snapshots preserve model state, capture real optimizer changes, and leak no tensors',async()=>{
  await tf.setBackend('cpu');await tf.ready();
  const model=createToyModel(tf),image=makeSplits({train:6,validation:3,test:3}).train[0].pixels;
  const beforeCount=tf.memory().numTensors,before=trainingSnapshot(tf,model,image);
  assert.equal(before.weights.length,72);assert.equal(before.activations.length,16*16*8);
  assert.ok(before.weights.every(Number.isFinite));assert.ok(before.activations.every(value=>value>=0));
  assert.deepEqual(trainingSnapshot(tf,model,image),before);
  assert.equal(tf.memory().numTensors,beforeCount);
  const input=tf.tensor4d(image,[1,16,16,1]),target=tf.tensor2d([[1,0,0]]);
  await model.trainOnBatch(input,target);
  const afterCount=tf.memory().numTensors,after=trainingSnapshot(tf,model,image);
  assert.ok(after.weights.some((weight,index)=>weight!==before.weights[index]));
  const history=createEpochHistory();history.record(0,before);history.record(1,after);history.select(0);
  assert.deepEqual(history.state().entry.snapshot.weights,before.weights);
  assert.deepEqual(trainingSnapshot(tf,model,image).weights,after.weights);
  assert.equal(tf.memory().numTensors,afterCount);
  input.dispose();target.dispose();model.optimizer.dispose();model.dispose();
});

const example=value=>({weights:[value],activations:Array.from({length:16},(_,index)=>index%8===0?value:0),input:[.5]});

test('scrubbing pins a historical epoch while new epochs arrive, and live resumes following',()=>{
  const history=createEpochHistory();history.record(0,example(1));history.record(1,example(2),{loss:.8});
  history.select(0);history.record(2,example(3),{loss:.5});
  assert.equal(history.state().entry.epoch,0);assert.equal(history.state().latest,2);assert.equal(history.state().following,false);
  history.select(1);assert.equal(history.state().previous.epoch,0);assert.equal(history.state().entry.metrics.loss,.8);
  history.live();assert.equal(history.state().entry.epoch,2);assert.equal(history.state().following,true);
  history.record(3,example(4));assert.equal(history.state().entry.epoch,3);
});

test('history copies arrays and uses one feature-map scale across saved epochs',()=>{
  const history=createEpochHistory(),source=example(1);history.record(0,source);source.weights[0]=99;source.activations[0]=99;
  history.record(1,example(3));history.select(0);
  assert.equal(history.state().entry.snapshot.weights[0],1);assert.equal(history.activationScale(0),3);assert.equal(history.activationScale(1),0);
  history.select(12);assert.equal(history.state().entry.epoch,1);
  assert.throws(()=>history.select(NaN));
});

test('retraining clears snapshots and canceled runs expose only completed epochs',()=>{
  const history=createEpochHistory();assert.equal(history.state().entry,null);
  for(let epoch=0;epoch<=12;epoch++)history.record(epoch,example(epoch));
  assert.equal(history.state().count,13);assert.equal(history.state().entry.epoch,12);
  history.clear();assert.equal(history.state().count,0);assert.equal(history.state().following,true);
  history.record(0,example(0));history.record(1,example(1));history.select(12);
  assert.equal(history.state().entry.epoch,1);assert.throws(()=>history.record(3,example(3)));
});
