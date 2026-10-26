const box=(x,y,width,height,sourceWidth,sourceHeight)=>({x:x/sourceWidth,y:y/sourceHeight,width:width/sourceWidth,height:height/sourceHeight});
export const PHOTO_BANK={
  astronaut:{title:'Eileen Collins',description:'Portrait · clear eyes',file:'assets/photos/astronaut.png',credit:'NASA / Eileen Collins · public domain',source:'https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.astronaut',crop:box(150,55,140,120,512,512),eyes:[box(190,91,27,19,512,512),box(234,93,28,19,512,512)]},
  hopper:{title:'Grace Hopper',description:'Portrait · glasses challenge',file:'assets/photos/grace-hopper.jpg',credit:'James S. Davis / U.S. Navy · public domain',source:'https://commons.wikimedia.org/wiki/File:Grace_Hopper.jpg',crop:box(155,130,215,135,512,600),eyes:[box(190,175,49,27,512,600),box(281,173,49,27,512,600)]},
  cat:{title:'Chelsea the cat',description:'Animal eyes · try transferring',file:'assets/photos/chelsea.png',credit:'Stefan van der Walt · CC0',source:'https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.cat',crop:box(110,55,250,135,451,300),eyes:[box(139,85,59,62,451,300),box(291,104,43,55,451,300)]},
  camera:{title:'The photographer',description:'Partial face · occlusion',file:'assets/photos/camera.png',credit:'Lav Varshney · CC0',source:'https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.camera',crop:box(175,85,120,110,512,512),eyes:null},
  coffee:{title:'Coffee cup',description:'No eyes · find false matches',file:'assets/photos/coffee.png',credit:'Rachel Michetti · CC0',source:'https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.coffee',crop:{x:0,y:0,width:1,height:1},eyes:[]}
};
export function pixelBox(box,width,height){return {x:box.x*width,y:box.y*height,width:box.width*width,height:box.height*height};}
const inside=(point,box)=>point.x>=box.x&&point.x<box.x+box.width&&point.y>=box.y&&point.y<box.y+box.height;
export function eyeEvidence(matches,picks,eyes,crop,width,height){
  const area=pixelBox(crop,width,height),regions=eyes?.map(box=>pixelBox(box,width,height));
  const visible=matches.filter(match=>inside({x:match.column,y:match.row},area));
  if(!regions)return {referenceAvailable:false,totalMatches:visible.length};
  const covered=regions.filter(region=>visible.some(match=>inside({x:match.column,y:match.row},region))).length;
  const marked=new Set(picks.flatMap(point=>regions.flatMap((region,index)=>inside(point,region)?[index]:[])));
  return {referenceAvailable:true,expected:regions.length,marked:marked.size,eyeRegionsWithMatches:covered,totalMatches:visible.length,outsideEyeMatches:visible.filter(match=>!regions.some(region=>inside({x:match.column,y:match.row},region))).length,incorrectMarks:picks.filter(point=>!regions.some(region=>inside(point,region))).length};
}
