import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {PHOTO_BANK,eyeEvidence} from '../photo-bank.mjs';

test('built-in photos exist and reference regions fit each image and challenge crop',()=>{
  assert.equal(Object.keys(PHOTO_BANK).length,5);
  for(const photo of Object.values(PHOTO_BANK)){
    assert.ok(existsSync(new URL('../'+photo.file,import.meta.url)));
    for(const box of [photo.crop,...(photo.eyes||[])]){
      assert.ok(box.x>=0&&box.y>=0&&box.width>0&&box.height>0);
      assert.ok(box.x+box.width<=1&&box.y+box.height<=1);
    }
    for(const box of photo.eyes||[]){
      assert.ok(box.x>=photo.crop.x&&box.y>=photo.crop.y);
      assert.ok(box.x+box.width<=photo.crop.x+photo.crop.width);
      assert.ok(box.y+box.height<=photo.crop.y+photo.crop.height);
    }
  }
});

test('eye feedback separates manual picks, eye-region responses, and unrelated matches',()=>{
  const crop={x:0,y:0,width:1,height:1},eyes=[{x:.1,y:.1,width:.1,height:.1},{x:.6,y:.1,width:.1,height:.1}];
  const matches=[{column:15,row:15},{column:65,row:15},{column:40,row:70}];
  const result=eyeEvidence(matches,[{x:15,y:15},{x:65,y:15}],eyes,crop,100,100);
  assert.deepEqual(result,{referenceAvailable:true,expected:2,marked:2,eyeRegionsWithMatches:2,totalMatches:3,outsideEyeMatches:1,incorrectMarks:0});
  assert.equal(eyeEvidence(matches,[{x:15,y:15},{x:16,y:15}],eyes,crop,100,100).marked,1);
  assert.equal(eyeEvidence([],[],eyes,crop,100,100).eyeRegionsWithMatches,0);
  assert.equal(eyeEvidence(matches,[{x:90,y:90}],[],crop,100,100).incorrectMarks,1);
  assert.deepEqual(eyeEvidence(matches,[],null,crop,100,100),{referenceAvailable:false,totalMatches:3});
});

test('eye evidence excludes responses outside the enlarged challenge crop',()=>{
  const crop={x:.1,y:.1,width:.2,height:.2};
  const result=eyeEvidence([{column:15,row:15},{column:35,row:15}],[],[],crop,100,100);
  assert.equal(result.totalMatches,1);assert.equal(result.outsideEyeMatches,1);
});
