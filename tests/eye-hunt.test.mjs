import test from 'node:test';
import assert from 'node:assert/strict';
import {makeTemplate,traceMatch,scanTemplates,matchPeaks,gradeEyes,placeScene} from '../eye-hunt-core.mjs';

function fixture(){
  let seed=314;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed>>>24;};
  const image={width:50,height:38,pixels:Uint8Array.from({length:50*38},random)};
  const centers=[{x:13,y:12},{x:35,y:13}];
  const templates=centers.map(p=>makeTemplate(image,p.x,p.y,9,7));
  return {image,templates,centers};
}

test('centered template weights sum to zero, have unit energy and trace the same score as the full search',()=>{
  const {image,templates,centers}=fixture(),scan=scanTemplates(image,templates);
  templates.forEach((t,i)=>{
    assert.ok(Math.abs(t.weights.reduce((a,b)=>a+b,0))<1e-12);
    assert.ok(Math.abs(t.weights.reduce((a,b)=>a+b*b,0)-1)<1e-12);
    const p=centers[i],trace=traceMatch(image,t,p.x-4,p.y-3);
    assert.ok(Math.abs(trace.score-1)<1e-12);
    assert.ok(Math.abs(scan.scores[p.y*image.width+p.x]-trace.score)<1e-6);
  });
  assert.equal(scan.scanned,2*(50-9+1)*(38-7+1));
});

test('verified threshold returns exactly two true matches without forcing a top-two result',()=>{
  const {image,templates,centers}=fixture(),scan=scanTemplates(image,templates);
  const regions=centers.map(p=>({x:p.x-2,y:p.y-2,width:5,height:5}));
  assert.deepEqual(gradeEyes(matchPeaks(scan,.99),regions),{found:2,expected:2,extra:0,passed:true});
  assert.ok(matchPeaks(scan,.1).length>2);
  assert.equal(gradeEyes(matchPeaks(scan,.1),regions).passed,false);
  // Duplicate filters must not count the same eye twice.
  assert.equal(matchPeaks(scanTemplates(image,[templates[0],templates[0]]),.99).length,1);
});

test('search follows translations with unchanged filters and no reference coordinates supplied',()=>{
  const {image,templates,centers}=fixture();
  for(let move=0;move<3;move++){
    const scene=placeScene(image,move),peaks=matchPeaks(scanTemplates(scene,templates),.99);
    const expected=centers.map(p=>({x:p.x+scene.dx,y:p.y+scene.dy}));
    assert.equal(peaks.length,2);
    for(const p of expected)assert.ok(peaks.some(q=>q.x===p.x&&q.y===p.y));
  }
});

test('normalized matching preserves positive brightness/contrast changes and rejects flat patches',()=>{
  const {image,templates}=fixture();
  const changed={...image,pixels:Float64Array.from(image.pixels,v=>v*.5+25)};
  const original=scanTemplates(image,templates),updated=scanTemplates(changed,templates);
  for(let i=0;i<original.scores.length;i++)assert.ok(Math.abs(original.scores[i]-updated.scores[i])<1e-6);
  const flat={width:50,height:38,pixels:new Uint8Array(1900).fill(100)};
  assert.throws(()=>makeTemplate(flat,10,10),/flat patch/);
  assert.equal(matchPeaks(scanTemplates(flat,templates),.99).length,0);
  assert.ok(scanTemplates(flat,templates).scores.every(Number.isFinite));
});

test('grading requires all targets and no extras, and does not change search outputs',()=>{
  const {image,templates}=fixture(),scan=scanTemplates(image,templates),before=scan.scores.slice();
  const peaks=matchPeaks(scan,.99);
  assert.equal(gradeEyes(peaks,[]).passed,false);
  assert.equal(gradeEyes([],[]).passed,true);
  assert.deepEqual(scan.scores,before);
  assert.throws(()=>matchPeaks(scan,1.1),/Threshold/);
  assert.throws(()=>scanTemplates(image,[]),/at least one/);
});
