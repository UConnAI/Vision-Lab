// Pure normalized sliding correlation: search receives pixels and filters, never answer boxes.
export function weightsToFilter(width,height,raw){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||raw.length!==width*height||Array.from(raw).some(v=>!Number.isFinite(v)))throw new Error('Use one finite number for each filter weight.');
  const mean=Array.from(raw).reduce((a,b)=>a+b,0)/raw.length;
  const energy=Math.sqrt(Array.from(raw).reduce((a,b)=>a+(b-mean)**2,0));
  return {width,height,mean,energy,weights:Array.from(raw,value=>energy<1e-8?0:(value-mean)/energy)};
}

export function starterWeights(fixture,challenge=false){
  const values=fixture.weights.slice();
  if(challenge)for(const index of fixture.editable)values[index]*=-1;
  return values;
}

export function changeWeight(values,index,value,editable=null){
  if(!Number.isInteger(index)||index<0||index>=values.length||!Number.isInteger(value)||Math.abs(value)>64)throw new Error('Use a whole-number weight from −64 to 64.');
  if(editable&&!editable.includes(index))throw new Error('This challenge weight is locked.');
  const next=values.slice();next[index]=value;return next;
}

export function makeTemplate(image,cx,cy,width=13,height=9){
  const x=Math.max(0,Math.min(image.width-width,Math.round(cx)-Math.floor(width/2)));
  const y=Math.max(0,Math.min(image.height-height,Math.round(cy)-Math.floor(height/2)));
  if(width<2||height<2||width>image.width||height>image.height)throw new Error('Template must fit the image.');
  const pixels=Array.from({length:width*height},(_,i)=>image.pixels[(y+Math.floor(i/width))*image.width+x+i%width]);
  const mean=pixels.reduce((a,b)=>a+b,0)/pixels.length;
  const energy=Math.sqrt(pixels.reduce((a,b)=>a+(b-mean)**2,0));
  if(energy<1e-8)throw new Error('A flat patch has no contrast pattern to match.');
  return {width,height,pixels,mean,energy,weights:pixels.map(value=>(value-mean)/energy)};
}

export function traceMatch(image,template,x,y){
  if(x<0||y<0||x+template.width>image.width||y+template.height>image.height)throw new Error('Patch outside image.');
  const pixels=Array.from({length:template.weights.length},(_,i)=>image.pixels[(y+Math.floor(i/template.width))*image.width+x+i%template.width]);
  const mean=pixels.reduce((a,b)=>a+b,0)/pixels.length;
  const energy=Math.sqrt(pixels.reduce((a,b)=>a+(b-mean)**2,0));
  const products=pixels.map((value,i)=>(value-mean)*template.weights[i]);
  const numerator=products.reduce((a,b)=>a+b,0);
  return {pixels,mean,energy,products,numerator,score:energy<1e-8?0:Math.max(-1,Math.min(1,numerator/energy))};
}

export function scanTemplates(image,templates){
  if(!templates.length)throw new Error('Select at least one template.');
  const {width,height,pixels}=image,stride=width+1;
  const sum=new Float64Array((width+1)*(height+1)),square=new Float64Array(sum.length);
  for(let y=0;y<height;y++){
    let a=0,b=0;
    for(let x=0;x<width;x++){const v=pixels[y*width+x];a+=v;b+=v*v;sum[(y+1)*stride+x+1]=sum[y*stride+x+1]+a;square[(y+1)*stride+x+1]=square[y*stride+x+1]+b;}
  }
  const scores=new Float32Array(width*height).fill(-1),winner=new Int16Array(scores.length).fill(-1);
  let scanned=0;
  templates.forEach((template,index)=>{
    const tw=template.width,th=template.height,n=tw*th;
    if(tw>width||th>height)throw new Error('Template must fit the search image.');
    const weightSum=template.weights.reduce((a,b)=>a+b,0);
    for(let y=0;y<=height-th;y++)for(let x=0;x<=width-tw;x++){
      const a=y*stride+x,b=a+tw,c=(y+th)*stride+x,d=c+tw;
      const total=sum[d]-sum[b]-sum[c]+sum[a],mean=total/n;
      const energy=Math.sqrt(Math.max(0,square[d]-square[b]-square[c]+square[a]-total*mean));
      let dot=0;
      if(energy>=1e-8)for(let dy=0;dy<th;dy++)for(let dx=0;dx<tw;dx++)dot+=template.weights[dy*tw+dx]*pixels[(y+dy)*width+x+dx];
      const score=energy<1e-8?0:Math.max(-1,Math.min(1,(dot-weightSum*mean)/energy));
      const center=(y+Math.floor(th/2))*width+x+Math.floor(tw/2);
      if(score>scores[center]){scores[center]=score;winner[center]=index;}
      scanned++;
    }
  });
  return {width,height,scores,winner,scanned,templates};
}

export function matchPeaks(scan,threshold){
  if(!Number.isFinite(threshold)||threshold<0||threshold>1)throw new Error('Threshold must be from 0 to 1.');
  const candidates=[];
  for(let i=0;i<scan.scores.length;i++)if(scan.winner[i]>=0&&scan.scores[i]>=threshold)candidates.push({x:i%scan.width,y:Math.floor(i/scan.width),score:scan.scores[i],template:scan.winner[i]});
  candidates.sort((a,b)=>b.score-a.score||a.y-b.y||a.x-b.x);
  const peaks=[];
  for(const p of candidates){
    const t=scan.templates[p.template];
    if(peaks.some(q=>{const other=scan.templates[q.template];return Math.abs(p.x-q.x)<Math.max(t.width,other.width)*.65&&Math.abs(p.y-q.y)<Math.max(t.height,other.height)*.65;}))continue;
    peaks.push({...p,width:t.width,height:t.height});
  }
  return peaks;
}

// Used after inference, to score detections against the classroom answer only.
export function gradeEyes(peaks,regions){
  const found=new Set();let extra=0;
  for(const p of peaks){const index=regions.findIndex(r=>p.x>=r.x&&p.x<r.x+r.width&&p.y>=r.y&&p.y<r.y+r.height);if(index<0||found.has(index))extra++;else found.add(index);}
  return {found:found.size,expected:regions.length,extra,passed:found.size===regions.length&&extra===0};
}

export function placeScene(image,move=0){
  const margin=20,width=image.width+margin*2,height=image.height+margin*2;
  const dx=[20,32,8][move%3],dy=[20,8,32][move%3],pixels=new Uint8Array(width*height).fill(117);
  for(let y=0;y<image.height;y++)pixels.set(image.pixels.slice(y*image.width,(y+1)*image.width),(y+dy)*width+dx);
  return {width,height,pixels,dx,dy};
}
