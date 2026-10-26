import test from 'node:test';
import assert from 'node:assert/strict';
import {stickerGeometry,drawSticker} from '../stickers.mjs';
test('keeping a rectangular sticker preserves its whole image and aspect ratio',()=>{
  const g=stickerGeometry(300,100,60);assert.equal(g.width,120);assert.equal(g.height,40);assert.equal(g.x,-60);assert.equal(g.y,-20);assert.equal(g.sw,300);
});
test('cover mode crops the source center and fills the requested square',()=>{
  assert.deepEqual(stickerGeometry(300,100,60,'cover'),{sx:100,sy:0,sw:100,sh:100,x:-60,y:-60,width:120,height:120});
  assert.throws(()=>stickerGeometry(0,100,60));assert.throws(()=>stickerGeometry(100,100,60,'stretch'));
});
test('draw uses the supplied center, and a missing position never draws a sticker',()=>{
  const calls=[],ctx={drawImage:(...args)=>calls.push(args)},image={naturalWidth:80,naturalHeight:40};
  assert.equal(drawSticker(ctx,image,null,20),false);assert.equal(calls.length,0);
  drawSticker(ctx,image,{x:70,y:90},20);assert.deepEqual(calls[0].slice(1),[0,0,80,40,50,80,40,20]);
});
