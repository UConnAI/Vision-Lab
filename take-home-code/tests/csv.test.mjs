import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parsePositions} from '../csv-core.mjs';

test('frame zero and out-of-order rows remain keyed observations, including zero coordinates',()=>{
  const rows=parsePositions('Frame,Visibility,X,Y\n9,1,20,30\n0,1,0,0\n3,0,,\n');
  assert.equal(rows.get(0).x,0);assert.equal(rows.get(0).y,0);assert.equal(rows.get(3).visible,false);assert.equal(rows.get(1),undefined);assert.equal(rows.get(9).x,20);
});
test('CSV quotes, BOM, CRLF and provenance fields survive parsing',()=>{
  const rows=parsePositions('\uFEFFFrame,Visibility,X,Y,Source\r\n0,1,20,30,"manual, inspected"\r\n1,0,,,none\r\n');
  assert.equal(rows.get(0).source,'manual, inspected');assert.equal(rows.size,2);
});
test('invalid frame schema, duplicates and nonfinite visible coordinates are rejected',()=>{
  for(const text of ['Frame,Visibility,X\n0,1,10','Frame,Visibility,X,Y\n0,1,10,20\n0,0,,','Frame,Visibility,X,Y\n0,1,NaN,20','Frame,Visibility,X,Y\n1.5,1,10,20','Frame,Visibility,X,Y\n0,2,10,20','Frame,Visibility,X,Y\n0,1,,20'])assert.throws(()=>parsePositions(text));
});
test('supplied coordinate files cover every original frame and state their sources',()=>{
  const soccer=parsePositions(fs.readFileSync(new URL('../data/soccer.csv',import.meta.url),'utf8'));
  const pingpong=parsePositions(fs.readFileSync(new URL('../data/ping-pong.csv',import.meta.url),'utf8'));
  assert.equal(soccer.size,179);assert.equal(pingpong.size,158);
  assert.ok([...soccer.values()].every(row=>['cnn_sample','cnn_interpolated','cnn_brief_hold','none'].includes(row.source)));
  assert.ok([...pingpong.values()].some(row=>row.visible));assert.ok([...pingpong.values()].some(row=>!row.visible));
  assert.ok([...pingpong.values()].every(row=>row.source==='color_component'||row.source==='none'));
});
test('long basketball CSV covers all 424 frames and preserves measured/interpolated sources and gaps',()=>{
  const rows=parsePositions(fs.readFileSync(new URL('../data/basketball.csv',import.meta.url),'utf8'));
  assert.equal(rows.size,424);assert.deepEqual([...rows.keys()],Array.from({length:424},(_,i)=>i));
  assert.equal([...rows.values()].filter(p=>p.visible).length,86);
  assert.ok([...rows.values()].some(p=>p.source==='appearance_sample'));
  assert.ok([...rows.values()].some(p=>p.source==='hybrid_interpolated'));
  for(const row of rows.values())if(row.visible)assert.ok(row.x>=0&&row.x<960&&row.y>=0&&row.y<540);
});
test('recommended juggling clip has all 346 frame keys, source labels and honest missing positions',()=>{
  const rows=parsePositions(fs.readFileSync(new URL('../data/juggling.csv',import.meta.url),'utf8'));
  assert.equal(rows.size,346);assert.equal(rows.get(345).visible!==undefined,true);
  assert.equal([...rows.values()].filter(p=>p.visible).length,297);
  for(const p of rows.values())if(p.visible)assert.ok(p.x>=0&&p.x<960&&p.y>=0&&p.y<540);
  assert.ok([...rows.values()].some(p=>!p.visible));assert.ok([...rows.values()].some(p=>p.source==='cnn_sample'));
});
