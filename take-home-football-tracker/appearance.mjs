// A color/shape measurement complements CNN detections; its score is not a
// class probability. No position is emitted unless matching pixels are present.
function validImage(image,width,height){return image&&Number.isInteger(image.width)&&image.width>0&&Number.isInteger(image.height)&&image.height>0&&image.data?.length===image.width*image.height*4&&Number.isFinite(width)&&width>0&&Number.isFinite(height)&&height>0;}
function hsv(r,g,b){const maximum=Math.max(r,g,b),minimum=Math.min(r,g,b),spread=maximum-minimum;let hue=0;if(spread){if(maximum===r)hue=60*((g-b)/spread%6);else if(maximum===g)hue=60*((b-r)/spread+2);else hue=60*((r-g)/spread+4);}return {h:(hue+360)%360,s:maximum?spread/maximum:0,v:maximum/255};}
const hueDistance=(a,b)=>Math.min(Math.abs(a-b),360-Math.abs(a-b));

export function learnBallAppearance(image,bbox,sourceWidth,sourceHeight){
  if(!validImage(image,sourceWidth,sourceHeight)||!Array.isArray(bbox)||bbox.length!==4||!bbox.every(Number.isFinite)||bbox[2]<=0||bbox[3]<=0)return null;
  const sx=image.width/sourceWidth,sy=image.height/sourceHeight;
  // Center of a CNN box is less likely to include a surrounding paddle or hand.
  const left=Math.max(0,Math.floor((bbox[0]+bbox[2]*.2)*sx)),right=Math.min(image.width,Math.ceil((bbox[0]+bbox[2]*.8)*sx));
  const top=Math.max(0,Math.floor((bbox[1]+bbox[3]*.2)*sy)),bottom=Math.min(image.height,Math.ceil((bbox[1]+bbox[3]*.8)*sy));
  const pixels=[],histogram=Array(36).fill(0);
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){const i=(y*image.width+x)*4;if(!image.data[i+3])continue;const color=hsv(image.data[i],image.data[i+1],image.data[i+2]);if(color.s>=.3&&color.v>=.2){pixels.push(color);histogram[Math.floor(color.h/10)]+=color.s;}}
  if(pixels.length<6||pixels.length<Math.max(1,(right-left)*(bottom-top))*.15)return null;
  const bin=histogram.indexOf(Math.max(...histogram)),dominant=(bin+.5)*10;
  const group=pixels.filter(p=>hueDistance(p.h,dominant)<=25);
  if(group.length<6)return null;
  const angle=Math.atan2(group.reduce((s,p)=>s+Math.sin(p.h*Math.PI/180)*p.s,0),group.reduce((s,p)=>s+Math.cos(p.h*Math.PI/180)*p.s,0));
  const saturation=group.reduce((s,p)=>s+p.s,0)/group.length;
  return {hue:(angle*180/Math.PI+360)%360,saturation,hueTolerance:35,seedTolerance:14,minSaturation:Math.max(.3,saturation*.5),seedSaturation:Math.max(.45,saturation*.65),minValue:.16,width:bbox[2]/sourceWidth,height:bbox[3]/sourceHeight,anchorX:(bbox[0]+bbox[2]/2)/sourceWidth,anchorY:(bbox[1]+bbox[3]/2)/sourceHeight};
}

export function appearanceBall(image,prototype,sourceWidth,sourceHeight){
  if(!validImage(image,sourceWidth,sourceHeight)||!prototype||!Number.isFinite(prototype.hue)||!(prototype.width>0)||!(prototype.height>0))return null;
  const {width,height,data}=image,mask=new Uint8Array(width*height),seeds=new Uint8Array(width*height),similarity=new Float32Array(width*height);
  for(let p=0;p<mask.length;p++){const i=p*4;if(!data[i+3])continue;const color=hsv(data[i],data[i+1],data[i+2]),difference=hueDistance(color.h,prototype.hue);if(color.s>=prototype.minSaturation&&color.v>=prototype.minValue&&difference<=prototype.hueTolerance){mask[p]=1;similarity[p]=1-difference/prototype.hueTolerance;seeds[p]=Number(difference<=prototype.seedTolerance&&color.s>=prototype.seedSaturation);}}
  const expectedWidth=prototype.width*width,expectedHeight=prototype.height*height,expectedArea=expectedWidth*expectedHeight;
  const queue=new Int32Array(mask.length);let best=null,bestRank=-Infinity;
  for(let start=0;start<mask.length;start++){
    if(!mask[start])continue;mask[start]=0;let head=0,tail=1;queue[0]=start;
    let minX=start%width,maxX=minX,minY=Math.floor(start/width),maxY=minY,area=0,colorSum=0,seedCount=0;
    while(head<tail){const p=queue[head++],x=p%width,y=Math.floor(p/width);area++;colorSum+=similarity[p];seedCount+=seeds[p];minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||nx>=width||ny<0||ny>=height)continue;const neighbor=ny*width+nx;if(mask[neighbor]){mask[neighbor]=0;queue[tail++]=neighbor;}}
    }
    const boxWidth=maxX-minX+1,boxHeight=maxY-minY+1,ratio=boxWidth/boxHeight,fill=area/(boxWidth*boxHeight),relativeArea=area/expectedArea;
    if(area<Math.max(6,expectedArea*.04)||relativeArea>3.5||ratio<.45||ratio>2.2||fill<.42||seedCount/area<.25||boxWidth>expectedWidth*2.5||boxHeight>expectedHeight*2.5)continue;
    const colorScore=colorSum/area,roundness=Math.min(boxWidth,boxHeight)/Math.max(boxWidth,boxHeight),sizeScore=Math.exp(-Math.abs(Math.log(Math.max(.001,relativeArea/(Math.PI/4)))));
    const score=Math.max(0,Math.min(1,.55*colorScore+.25*roundness+.2*sizeScore));
    if(score<.45)continue;
    const centerX=(minX+maxX+1)/(2*width),centerY=(minY+maxY+1)/(2*height),distance=Math.hypot(centerX-prototype.anchorX,centerY-prototype.anchorY);
    const rank=score+.025/(1+distance/Math.max(prototype.width,prototype.height));
    if(rank>bestRank){bestRank=rank;best={class:'sports ball',bbox:[minX/width*sourceWidth,minY/height*sourceHeight,boxWidth/width*sourceWidth,boxHeight/height*sourceHeight],score,source:'appearance'};}
  }
  return best;
}
