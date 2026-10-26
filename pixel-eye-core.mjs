import {weightsToFilter,scanTemplates,matchPeaks,gradeEyes} from './eye-hunt-core.mjs';
export function patchOrigin(image,cx,cy){
  return {x:Math.max(0,Math.min(image.width-4,Math.floor(cx)-2)),y:Math.max(0,Math.min(image.height-4,Math.floor(cy)-2))};
}
export function weightPixel(origin,index){
  if(!Number.isInteger(index)||index<0||index>15)throw new Error('Select one of the 16 weights.');
  return {x:origin.x+index%4,y:origin.y+Math.floor(index/4)};
}
export function setPixelWeight(weights,index,value,editable){
  if(!editable.includes(index))throw new Error('This test cell is fixed.');
  if(![-1,0,1].includes(value))throw new Error('Use −1, 0 or +1.');
  const next=weights.slice();next[index]=value;return next;
}
export function searchPixelEyes(image,weights,threshold){
  const filter=weightsToFilter(4,4,weights),scan=scanTemplates(image,[filter]);
  const peaks=matchPeaks(scan,threshold);
  return {scan,peaks,grade:gradeEyes(peaks,image.regions)};
}
export function pixelContribution(image,weights,origin,index){
  const point=weightPixel(origin,index),patch=Array.from({length:16},(_,i)=>{const p=weightPixel(origin,i);return image.pixels[p.y*image.width+p.x];});
  const pixel=patch[index],pixelMean=patch.reduce((a,b)=>a+b,0)/16,weightMean=weights.reduce((a,b)=>a+b,0)/16;
  return {point,pixel,pixelMean,weight:weights[index],weightMean,product:(weights[index]-weightMean)*(pixel-pixelMean),patch};
}

// Controlled lighting/position checks reuse photographed pixels, not new subjects.
export function catTestViews(source){
  const moved=(name,dx,scale,offset)=>{
    const width=source.width+6,height=source.height+4,dy=2;
    const pixels=Array(width*height).fill(90);
    for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)
      pixels[(y+dy)*width+x+dx]=source.pixels[y*source.width+x]*scale+offset;
    return {...source,name,width,height,pixels,
      regions:source.regions.map(r=>({...r,x:r.x+dx,y:r.y+dy})),
      inspect:source.inspect.map(([x,y])=>[x+dx,y+dy])};
  };
  return [{...source,name:'Original'},moved('Moved + dimmer',1,.65,25),moved('Moved + brighter',3,.8,45)];
}
export function testCatKernel(source,weights,threshold){
  return catTestViews(source).map(view=>({name:view.name,...searchPixelEyes(view,weights,threshold).grade}));
}
