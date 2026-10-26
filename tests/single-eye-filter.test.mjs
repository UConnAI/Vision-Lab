import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {weightsToFilter,starterWeights,changeWeight,scanTemplates,matchPeaks,gradeEyes,placeScene,traceMatch} from '../eye-hunt-core.mjs';
const fixtures=JSON.parse(readFileSync(new URL('../assets/eye-lab.json',import.meta.url),'utf8'));
function search(fixture,weights,move=0){
  const scene=placeScene({...fixture,pixels:Uint8Array.from(fixture.pixels)},move);
  const filter=weightsToFilter(17,13,weights),scan=scanTemplates(scene,[filter]),peaks=matchPeaks(scan,fixture.threshold);
  const regions=fixture.regions.map(r=>({...r,x:r.x+scene.dx,y:r.y+scene.dy}));
  return {grade:gradeEyes(peaks,regions),scene,filter,scan,peaks};
}
test('one actual 17 by 13 filter finds both eyes in every real portrait at all three scene positions',()=>{
  for(const key of ['astronaut','hopper','cat'])for(let move=0;move<3;move++){
    const d=fixtures[key],result=search(d,d.weights,move);
    assert.equal(result.scan.templates.length,1);
    assert.deepEqual(result.grade,{found:2,expected:2,extra:0,passed:true},`${key}, move ${move}`);
    assert.equal(result.peaks.length,2);
    assert.equal(result.scan.scanned,(result.scene.width-16)*(result.scene.height-12));
    for(const peak of result.peaks){const trace=traceMatch(result.scene,result.filter,peak.x-8,peak.y-6);assert.ok(Math.abs(trace.score-peak.score)<1e-6);}
  }
});
test('unchanged Collins filter returns no detections in the coffee control',()=>{
  assert.deepEqual(fixtures.coffee.weights,fixtures.astronaut.weights);
  assert.deepEqual(search(fixtures.coffee,fixtures.coffee.weights).grade,{found:0,expected:0,extra:0,passed:true});
});
test('cat starter fails and can be solved by changing only six cells while all 215 locked weights remain fixed',()=>{
  const d=fixtures.cat,initial=starterWeights(d,true),locked=initial.map((v,i)=>i).filter(i=>!d.editable.includes(i));
  assert.equal(initial.length,221);assert.equal(d.editable.length,6);assert.equal(locked.length,215);
  assert.equal(search(d,initial).grade.passed,false);
  let edited=initial;
  for(const index of d.editable)edited=changeWeight(edited,index,d.weights[index],d.editable);
  assert.equal(search(d,edited).grade.passed,true);
  locked.forEach(i=>assert.equal(edited[i],initial[i]));
  assert.throws(()=>changeWeight(initial,locked[0],1,d.editable),/locked/);
  assert.notDeepEqual(initial,edited);
});
test('manual edits affect detections, normalization is finite and the prepared arrays remain immutable',()=>{
  const d=fixtures.astronaut,original=d.weights.slice(),edited=starterWeights(d).map(v=>-v);
  assert.equal(search(d,edited).grade.passed,false);
  assert.deepEqual(d.weights,original);
  const filter=weightsToFilter(17,13,d.weights);
  assert.ok(Math.abs(filter.weights.reduce((a,b)=>a+b,0))<1e-12);
  assert.ok(Math.abs(filter.weights.reduce((a,b)=>a+b*b,0)-1)<1e-12);
  assert.ok(weightsToFilter(17,13,new Array(221).fill(0)).weights.every(v=>v===0));
  assert.throws(()=>weightsToFilter(17,13,[1]),/finite number/);
  assert.throws(()=>changeWeight(original,0,Infinity),/weight/);
});
