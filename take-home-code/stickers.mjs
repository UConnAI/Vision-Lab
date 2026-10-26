export function stickerGeometry(width,height,radius,fit='contain'){
  if(![width,height,radius].every(value=>Number.isFinite(value)&&value>0))throw new Error('Use positive image dimensions and sticker size.');
  if(fit==='cover'){
    const side=Math.min(width,height);
    return {sx:(width-side)/2,sy:(height-side)/2,sw:side,sh:side,x:-radius,y:-radius,width:2*radius,height:2*radius};
  }
  if(fit!=='contain')throw new Error('Choose contain or cover.');
  const scale=2*radius/Math.max(width,height);
  return {sx:0,sy:0,sw:width,sh:height,x:-width*scale/2,y:-height*scale/2,width:width*scale,height:height*scale};
}

export function drawSticker(context,image,point,radius,fit='contain'){
  if(!image||!point)return false;
  const box=stickerGeometry(image.naturalWidth,image.naturalHeight,radius,fit);
  context.drawImage(image,box.sx,box.sy,box.sw,box.sh,point.x+box.x,point.y+box.y,box.width,box.height);
  return true;
}

export function setupSticker(onChange){
  const $=id=>document.getElementById(id);
  let image=null,url=null,version=0;
  const option=$('effect').querySelector('[value="custom"]');
  $('stickerUpload').onchange=async()=>{
    const file=$('stickerUpload').files[0];if(!file)return;
    const token=++version,candidateURL=URL.createObjectURL(file);
    $('stickerStatus').textContent='Loading your image…';
    try{
      const candidate=new Image();
      await new Promise((resolve,reject)=>{candidate.onload=resolve;candidate.onerror=()=>reject(new Error('This file could not be read as an image. Try PNG, JPEG, WebP or SVG.'));candidate.src=candidateURL;});
      if(token!==version){URL.revokeObjectURL(candidateURL);return;}
      if(url)URL.revokeObjectURL(url);url=candidateURL;image=candidate;
      $('stickerPreview').src=url;$('stickerPreview').hidden=false;$('stickerPlaceholder').hidden=true;
      $('stickerClear').disabled=false;option.disabled=false;$('effect').value='custom';
      $('stickerStatus').textContent=`${file.name} · ${image.naturalWidth} × ${image.naturalHeight}. Your image now follows the selected position source.`;
      onChange();
    }catch(error){URL.revokeObjectURL(candidateURL);if(token===version)$('stickerStatus').textContent=error.message+(image?' Your previous sticker is still selected.':'');}
  };
  $('stickerFit').onchange=onChange;
  $('stickerClear').onclick=()=>{
    version++;if(url)URL.revokeObjectURL(url);url=null;image=null;
    $('stickerUpload').value='';$('stickerPreview').removeAttribute('src');$('stickerPreview').hidden=true;$('stickerPlaceholder').hidden=false;
    $('stickerClear').disabled=true;option.disabled=true;if($('effect').value==='custom')$('effect').value='rock';
    $('stickerStatus').textContent='Choose an image to use your own sticker. Transparent PNG keeps the background visible.';onChange();
  };
  window.addEventListener('pagehide',()=>{version++;if(url)URL.revokeObjectURL(url);});
  return {draw:(context,point,radius)=>drawSticker(context,image,point,radius,$('stickerFit').value)};
}
