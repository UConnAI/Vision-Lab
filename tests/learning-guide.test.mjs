import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {cleanProgress, readProgress, writeProgress, notesText} from '../learning-guide.mjs';
import {learningPaths} from '../learning-paths.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const pages = {lecture:'lecture.html', deep:'lecture.html', playground:'explore.html', final:'index.html', home:'take-home-code/index.html'};
test('damaged saved progress cannot create invalid steps or truthy completions', () => {
  assert.deepEqual(cleanProgress(null, 4), {step:0,done:[false,false,false,false],notes:''});
  assert.deepEqual(cleanProgress({step:99,done:[true,'true',1],notes:42},4), {step:3,done:[true,false,false,false],notes:''});
  assert.equal(cleanProgress({step:-4, notes:'x'.repeat(13000)},4).notes.length,12000);
  assert.equal(cleanProgress({step:1.5},4).step,0);
});
test('storage failure and corrupt JSON fall back without breaking the guide', () => {
  const unavailable = {getItem(){throw Error('blocked');}, setItem(){throw Error('quota');}};
  assert.equal(readProgress(unavailable,'lecture',4).step,0);
  assert.equal(writeProgress(unavailable,'lecture',{}),false);
  assert.equal(readProgress({getItem:()=>'{broken'},'lecture',4).step,0);
  assert.equal(readProgress(undefined,'lecture',4).step,0);
});
test('progress is isolated by route and notes are preserved as literal text', () => {
  const data=new Map(), storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  const value={step:2,done:[true,false,true,false],notes:'<script>not executable</script>\nSecond line'};
  assert.equal(writeProgress(storage,'lecture',value),true);
  assert.deepEqual(readProgress(storage,'lecture',4),value);
  assert.equal(readProgress(storage,'deep',4).notes,'');
  const exported=notesText(learningPaths.lecture,value);
  assert.match(exported,/Self-reported/);
  assert.ok(exported.includes(value.notes));
  assert.equal(exported.match(/\[x\]/g).length,2);
});
test('active guided activities resolve; lecture and simple RPS do not load retired guides', () => {
  for(const [key,path] of Object.entries(learningPaths)) {
    const source=resolve(root,pages[key]), html=readFileSync(source,'utf8');
    if(key === 'lecture' || key === 'deep' || key === 'final') {
      assert.ok(!html.includes(`data-learning-guide="${key}"`),`${key} should have no guided panel`);
      continue;
    }
    assert.ok(html.includes(`data-learning-guide="${key}"`),key);
    for(const href of [...path.steps.map(s=>s.href),path.next[0]]) {
      const [page,hash]=href.split('#'), target=page?resolve(dirname(source),page):source;
      assert.ok(existsSync(target),`${key}: ${href}`);
      if(hash) assert.ok(readFileSync(target,'utf8').includes(`id="${hash}"`),`${key}: missing ${href}`);
    }
  }
});
test('later pages preserve six-tab links and unique static IDs; first tab does not import guides', () => {
  for(const page of new Set(Object.values(pages))) {
    const html=readFileSync(resolve(root,page),'utf8');
    const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
    assert.equal(new Set(ids).size,ids.length,`Duplicate id in ${page}`);
    for(const stage of ['start','lecture','playground','deep','final','home']) assert.ok(html.includes(`data-stage="${stage}"`));
    if(page === 'lecture.html' || page === 'index.html') assert.ok(!html.includes('learning-guide.mjs'));
    else assert.ok(html.includes('learning-guide.mjs'));
  }
  assert.ok(!readFileSync(resolve(root,'start.html'),'utf8').includes('learning-guide'));
});

test('final challenge uses the current committed-move RPS game rather than retired training guides',()=>{
  const html=readFileSync(resolve(root,'index.html'),'utf8');
  assert.ok(html.includes('rps-game.mjs'));
  for(const id of ['challengeSetup','gameControls','strategy','hold'])assert.ok(html.includes(`id="${id}"`));
  assert.ok(html.includes('value="classic"'));assert.ok(html.includes('value="counter"'));
});
