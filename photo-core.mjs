export function grayscaleRows(rgba,width,height){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<3||height<3||rgba.length!==width*height*4)throw new Error('Use an image with at least 3 rows and 3 columns.');
  const image=[];
  for(let row=0;row<height;row++){
    const values=[];
    for(let column=0;column<width;column++){
      const index=4*(row*width+column);
      values.push((.299*rgba[index]+.587*rgba[index+1]+.114*rgba[index+2])/255);
    }
    image.push(values);
  }
  return image;
}

export function smoothPhoto(image){
  const height=image.length,width=image[0].length;
  return image.map((row,y)=>row.map((_,x)=>{
    let sum=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)sum+=image[Math.max(0,Math.min(height-1,y+dy))][Math.max(0,Math.min(width-1,x+dx))];
    return sum/9;
  }));
}

export function analyzePhoto(image,kernel,threshold,{smooth=false,relu=true}={}){
  if(!Number.isFinite(threshold))throw new Error('Use a finite match threshold.');
  const input=smooth?smoothPhoto(image):image;
  const height=input.length,width=input[0]?.length;
  if(height<3||width<3||input.some(row=>row.length!==width||row.some(value=>!Number.isFinite(value))))throw new Error('Use a rectangular image of finite pixels at least 3 × 3.');
  if(kernel.length!==3||kernel.some(row=>row.length!==3||row.some(value=>!Number.isFinite(value))))throw new Error('Use nine finite filter weights.');
  const responses=[],matches=[];
  // Validate once, then slide the same nine weights over every complete patch.
  for(let y=0;y<height-2;y++){
    const row=[];
    for(let x=0;x<width-2;x++){
      let score=0;
      for(let dy=0;dy<3;dy++)for(let dx=0;dx<3;dx++)score+=input[y+dy][x+dx]*kernel[dy][dx];
      if(relu)score=Math.max(0,score);
      row.push(score);
      if(score>threshold)matches.push({row:y+1,column:x+1,score});
    }
    responses.push(row);
  }
  return {input,responses,matches};
}

export function nextPhotoPatch(row,column,height,width){
  const columns=width-2,rows=height-2;
  if(columns<1||rows<1)throw new Error('A 3 × 3 patch must fit the image.');
  const index=(row*columns+column+1)%(rows*columns);
  return {row:Math.floor(index/columns),column:index%columns};
}
