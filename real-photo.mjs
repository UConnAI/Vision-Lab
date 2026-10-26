import {KERNELS,kernelResponse} from './opening.mjs';
import {grayscaleRows,analyzePhoto,nextPhotoPatch} from './photo-core.mjs';
import {PHOTO_BANK} from './photo-bank.mjs';

function initPhoto(){
  const $=id=>document.getElementById(id);
  const working=document.createElement('canvas'),grayCanvas=document.createElement('canvas');
  let image=null,selection={row:0,column:0},version=0;
  let photoKey='astronaut';
  const sourceGray=document.createElement('canvas');
  const currentPhoto=()=>PHOTO_BANK[photoKey]||{title:'Your photograph',crop:{x:0,y:0,width:1,height:1},eyes:null};
  for(const [key,photo] of Object.entries(PHOTO_BANK)){
    const button=document.createElement('button');button.className='photoChoice';button.dataset.photo=key;button.setAttribute('aria-pressed',String(key===photoKey));
    const thumbnail=document.createElement('img');thumbnail.src=photo.file;thumbnail.alt='';const name=document.createElement('strong');name.textContent=photo.title;const detail=document.createElement('span');detail.textContent=photo.description;button.append(thumbnail,name,detail);
    button.onclick=()=>{$('photoUpload').value='';void load(null,key);};$('photoChoices').append(button);
  }
  let kernel=KERNELS.vertical.map(row=>row.slice());
  let phase=0,timer=null,cachedKey=null,cachedResult=null;
  const help={
    vertical:'Vertical edges: the left column is subtracted from the right column. Flat regions cancel; a dark-to-bright boundary gives a positive response. Try Reverse the signs, or turn ReLU off to see both directions.',
    horizontal:'Horizontal edges: subtract the top row from the bottom row. Look along the eyes, shoulders and horizontal background lines. Reverse the signs to detect the opposite direction.',
    eyebrow:'Bright above, dark below: add the top row and subtract the bottom row. Look at changes around the eyebrows and hairline, but compare other edges too: this is a contrast rule, not an eye detector.',
    bridge:'Bright vertical strip: double the center column and subtract both sides. Look for narrow bright ridges. Try changing the center weights from 2 to 1 and compare the responses.',
    mean:'Mean / blur: all nine weights are 1/9, so the output is their average brightness. Turn ReLU off; it makes no difference for these positive pixels. Lower the threshold to see more locations.',
    sharpen:'Sharpen: give the center pixel weight 5 and subtract its four neighbors. Contrast is emphasized; values can exceed 1 or become negative. Turn ReLU off to inspect the signed output.',
    custom:'Your filter: change one weight at a time. Positive weights add that pixel, negative weights subtract it, and zero ignores it. Watch the products and running sum below to explain the change.'
  };
  function stopWalk(){if(timer!==null)clearInterval(timer);timer=null;$('photoWalkPlay').textContent='Play walkthrough';}
  function restartWalk(){stopWalk();phase=0;}
  function advanceWalk(){if(!image)return;if(phase===11){selection=nextPhotoPatch(selection.row,selection.column,image.length,image[0].length);phase=0;}else phase++;render();}
  function startWalk(){if(!image)return;$('photoWalkPlay').textContent='Pause walkthrough';timer=setInterval(advanceWalk,Number($('photoWalkSpeed').value));}
  function filterChanged(){restartWalk();render();}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopWalk();});
  window.addEventListener('pagehide',stopWalk);
  const weightInputs=[];
  function syncWeights(){
    weightInputs.forEach((input,index)=>{input.value=kernel[Math.floor(index/3)][index%3];input.removeAttribute('aria-invalid');});
    $('photoWeightStatus').textContent='Choose a preset or edit any weight from −10 to 10. Decimal weights work too.';
  }
  function restoreFilter(){kernel=KERNELS.vertical.map(row=>row.slice());$('photoKernel').value='vertical';syncWeights();filterChanged();}
  for(let row=0;row<3;row++)for(let column=0;column<3;column++){
    const input=document.createElement('input');input.type='number';input.min='-10';input.max='10';input.step='0.1';input.value=kernel[row][column];
    input.setAttribute('aria-label',`Photo filter row ${row+1}, column ${column+1}`);
    input.oninput=()=>{
      const value=input.valueAsNumber;
      if(!Number.isFinite(value)||value < -10||value > 10){input.setAttribute('aria-invalid','true');$('photoWeightStatus').textContent='Enter a number from −10 to 10. The last valid filter stays on screen until you finish.';return;}
      input.removeAttribute('aria-invalid');kernel[row][column]=value;$('photoKernel').value='custom';
      $('photoWeightStatus').textContent='Your edited filter is applied to every complete 3 × 3 patch.';filterChanged();
    };
    input.onblur=()=>{if(input.getAttribute('aria-invalid')){input.value=kernel[row][column];input.removeAttribute('aria-invalid');$('photoWeightStatus').textContent='Restored this box to its last valid weight.';}};
    weightInputs.push(input);$('photoWeights').append(input);
  }
  const format=value=>Number(value.toFixed(3)).toString();
  function displaySize(canvas){const scale=Math.min(360/canvas.width,400/canvas.height);canvas.style.width=`${canvas.width*scale}px`;canvas.style.height='auto';}
  function grayscaleCanvas(rows){
    grayCanvas.width=rows[0].length;grayCanvas.height=rows.length;
    const context=grayCanvas.getContext('2d'),pixels=context.createImageData(grayCanvas.width,grayCanvas.height);
    rows.forEach((row,y)=>row.forEach((value,x)=>{const i=4*(y*grayCanvas.width+x);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=Math.round(255*value);pixels.data[i+3]=255;}));
    context.putImageData(pixels,0,0);
  }
  function render(){
    if(!image)return;
    const threshold=Number($('photoThreshold').value);
    const key=JSON.stringify([version,kernel,threshold,$('photoSmooth').checked,$('photoRelu').checked]);
    if(key!==cachedKey){cachedResult=analyzePhoto(image,kernel,threshold,{smooth:$('photoSmooth').checked,relu:$('photoRelu').checked});cachedKey=key;}
    const result=cachedResult;
    $('photoFilterHelp').textContent=help[$('photoKernel').value];
    const height=image.length,width=image[0].length,outputHeight=height-2,outputWidth=width-2;
    selection.row=Math.min(selection.row,outputHeight-1);selection.column=Math.min(selection.column,outputWidth-1);
    grayscaleCanvas(result.input);
    for(const id of ['photoInput','photoOverlay']){const canvas=$(id);canvas.width=width;canvas.height=height;displaySize(canvas);canvas.getContext('2d').drawImage(grayCanvas,0,0);}
    const input=$('photoInput').getContext('2d');input.strokeStyle='#8a36dc';input.lineWidth=1;input.strokeRect(selection.column-.5,selection.row-.5,4,4);
    input.beginPath();input.moveTo(selection.column-8,selection.row+1);input.lineTo(selection.column-2,selection.row+1);input.moveTo(selection.column+5,selection.row+1);input.lineTo(selection.column+11,selection.row+1);input.stroke();
    const output=$('photoResponse');output.width=outputWidth;output.height=outputHeight;
    displaySize(output);
    const heat=output.getContext('2d'),pixels=heat.createImageData(outputWidth,outputHeight),scale=result.responses.reduce((maximum,row)=>row.reduce((m,value)=>Math.max(m,Math.abs(value)),maximum),.001);
    result.responses.forEach((row,y)=>row.forEach((value,x)=>{const i=4*(y*outputWidth+x),a=Math.abs(value)/scale,color=value>=0?[234,125,35]:[49,112,217];for(let c=0;c<3;c++)pixels.data[i+c]=Math.round(244*(1-a)+color[c]*a);pixels.data[i+3]=255;}));
    heat.putImageData(pixels,0,0);heat.strokeStyle=phase===11?'#07896b':'#8a36dc';heat.lineWidth=1;heat.strokeRect(selection.column-1,selection.row-1,3,3);
    const overlay=$('photoOverlay').getContext('2d');overlay.fillStyle='#e82c94aa';
    for(const match of result.matches)overlay.fillRect(match.column,match.row,1,1);
    $('photoThresholdValue').textContent=threshold.toFixed(2);
    $('photoDimensions').textContent=`Input ${width} × ${height} grayscale pixels · response ${outputWidth} × ${outputHeight} · 3 × 3 filter · no padding.`;
    $('photoResult').textContent=`${result.matches.length} local responses above ${threshold.toFixed(2)}. Pink pixels mark their centers. They can occur on eyebrows, hair, cheeks or other edges; these are not eye or face detections.`;
    const trace=kernelResponse(result.input,kernel,selection.row,selection.column,$('photoRelu').checked);
    $('photoPatch').textContent=`Selected patch: row ${selection.row}, column ${selection.column} (counting from 0). Sum = ${format(trace.raw)}. After ${$('photoRelu').checked?'ReLU':'leaving the sign unchanged'}: ${format(trace.output)}.`;
    for(const [id,source,x,y] of [['photoWalkLocation',grayCanvas,selection.column+1,selection.row+1],['photoWalkMap',output,selection.column,selection.row]]){
      const canvas=$(id);canvas.width=source.width;canvas.height=source.height;const context=canvas.getContext('2d');context.drawImage(source,0,0);
      context.strokeStyle=id==='photoWalkMap'&&phase===11?'#07896b':'#8a36dc';context.lineWidth=2;context.strokeRect(Math.max(0,x-6),Math.max(0,y-6),12,12);
    }
    renderWalk(trace,threshold);
    $('photoProducts').replaceChildren();for(const term of trace.terms){const row=document.createElement('tr');for(const text of [`(${term.dy}, ${term.dx})`,format(term.pixel),format(term.weight),format(term.product)]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}$('photoProducts').append(row);}
  }
  function renderWalk(trace,threshold){
    const active=phase>=1&&phase<=9?phase-1:-1;
    for(const [id,field] of [['photoWalkPixels','pixel'],['photoWalkWeights','weight'],['photoWalkProducts','product']]){
      $(id).replaceChildren();
      trace.terms.forEach((term,index)=>{
        const cell=document.createElement('span');cell.textContent=field==='product'&&index>=phase?'?':format(term[field]);
        if(field==='pixel'){const brightness=Math.round(term.pixel*255);cell.style.background=`rgb(${brightness},${brightness},${brightness})`;cell.style.color=brightness>135?'#15353b':'white';}
        if(index===active)cell.classList.add('active');
        if(field==='product'&&index<phase)cell.classList.add('counted');
        $(id).append(cell);
      });
    }
    const count=Math.min(9,phase),sum=trace.terms.slice(0,count).reduce((value,term)=>value+term.product,0);
    if(phase===0)$('photoWalkStage').textContent='Step 1 · Select a patch. Press Step calculation or Play walkthrough to follow the nine multiplications.';
    else if(phase<=9){const term=trace.terms[active];$('photoWalkStage').textContent=`Multiply ${phase} of 9 · ${format(term.pixel)} × ${format(term.weight)} ≈ ${format(term.product)}. Add this product to the running sum.`;}
    else if(phase===10)$('photoWalkStage').textContent=`Add · All nine products give ${format(trace.raw)}. Each weight was paired with the pixel in the same position.`;
    else $('photoWalkStage').textContent=`Write one output · ${$('photoRelu').checked?'ReLU replaces a negative sum with zero.':'ReLU is off: keep the signed sum.'} The green square marks this output location. The next step slides one pixel right (then starts the next row).`;
    $('photoWalkSum').textContent=`Running sum (${count}/9 products): ${count?trace.terms.slice(0,count).map(term=>`(${format(term.product)})`).join(' + '):'0'} ≈ ${format(sum)}`;
    $('photoWalkOutput').textContent=phase===11?`Output = ${format(trace.output)} · ${trace.output>threshold?'above':'at or below'} threshold ${threshold.toFixed(2)} · ${trace.output>threshold?'mark this center in pink':'no pink mark for this center'}.`:'Output cell: waiting for all nine products, their sum and the optional ReLU step.';
  }
  async function load(file=null,key=photoKey){
    restartWalk();const token=++version,url=file?URL.createObjectURL(file):PHOTO_BANK[key==='upload'?'astronaut':key].file;
    try{
      const loaded=new Image();await new Promise((resolve,reject)=>{loaded.onload=resolve;loaded.onerror=()=>reject(new Error('This image could not be decoded. Try PNG, JPEG or WebP.'));loaded.src=url;});
      if(token!==version)return false;
      const ratio=Math.min(1,256/Math.max(loaded.naturalWidth,loaded.naturalHeight));
      working.width=Math.max(3,Math.round(loaded.naturalWidth*ratio));working.height=Math.max(3,Math.round(loaded.naturalHeight*ratio));
      const context=working.getContext('2d',{willReadFrequently:true});context.fillStyle='white';context.fillRect(0,0,working.width,working.height);
      context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(loaded,0,0,working.width,working.height);
      const sourceScale=Math.min(1,1024/Math.max(loaded.naturalWidth,loaded.naturalHeight));sourceGray.width=Math.round(loaded.naturalWidth*sourceScale);sourceGray.height=Math.round(loaded.naturalHeight*sourceScale);const sourceContext=sourceGray.getContext('2d',{willReadFrequently:true});sourceContext.fillStyle='white';sourceContext.fillRect(0,0,sourceGray.width,sourceGray.height);sourceContext.drawImage(loaded,0,0,sourceGray.width,sourceGray.height);const sourcePixels=sourceContext.getImageData(0,0,sourceGray.width,sourceGray.height);for(let i=0;i<sourcePixels.data.length;i+=4){const value=Math.round(.299*sourcePixels.data[i]+.587*sourcePixels.data[i+1]+.114*sourcePixels.data[i+2]);sourcePixels.data[i]=sourcePixels.data[i+1]=sourcePixels.data[i+2]=value;}sourceContext.putImageData(sourcePixels,0,0);
      photoKey=file?'upload':key;
      for(const button of $('photoChoices').children)button.setAttribute('aria-pressed',String(button.dataset.photo===photoKey));
      const credit=$('photoCredit');credit.replaceChildren();if(file)credit.textContent='Your photograph stays in this browser.';else{const photo=currentPhoto(),link=document.createElement('a');link.href=photo.source;link.textContent='Photo source';credit.append(`${photo.credit} · `,link);}
      image=grayscaleRows(context.getImageData(0,0,working.width,working.height).data,working.width,working.height);
      selection={row:Math.min(working.height-3,Math.floor(working.height*.27)),column:Math.min(working.width-3,Math.floor(working.width*.4))};$('photoImageName').textContent=`${currentPhoto().title} · ${loaded.naturalWidth} × ${loaded.naturalHeight} source · ${working.width} × ${working.height} grayscale working pixels`;render();return true;
    }catch(error){if(token===version)$('photoResult').textContent=error.message;return false;}
    finally{if(file)URL.revokeObjectURL(url);}
  }
  for(const id of ['photoThreshold','photoSmooth','photoRelu'])$(id).oninput=filterChanged;
  $('photoKernel').onchange=()=>{const preset=KERNELS[$('photoKernel').value];if(preset){kernel=preset.map(row=>row.slice());syncWeights();}filterChanged();};
  $('photoFlip').onclick=()=>{kernel=kernel.map(row=>row.map(value=>-value));$('photoKernel').value='custom';syncWeights();filterChanged();};
  $('photoZero').onclick=()=>{kernel=kernel.map(row=>row.map(()=>0));$('photoKernel').value='custom';syncWeights();filterChanged();};
  $('photoFilterReset').onclick=restoreFilter;
  $('photoUpload').onchange=()=>{const file=$('photoUpload').files[0];if(file)void load(file);};
  $('photoNext').onclick=()=>{if(!image)return;restartWalk();selection=nextPhotoPatch(selection.row,selection.column,image.length,image[0].length);render();};
  $('photoWalkStep').onclick=()=>{stopWalk();advanceWalk();};
  $('photoWalkRestart').onclick=()=>{restartWalk();render();};
  $('photoWalkPlay').onclick=()=>{if(timer!==null)stopWalk();else startWalk();};
  $('photoWalkSpeed').onchange=()=>{if(timer!==null){stopWalk();startWalk();}};
  $('photoReset').onclick=()=>{$('photoUpload').value='';kernel=KERNELS.vertical.map(row=>row.slice());$('photoKernel').value='vertical';syncWeights();$('photoThreshold').value='.15';$('photoSmooth').checked=false;$('photoRelu').checked=true;void load(null,'astronaut');};
  for(const id of ['photoInput','photoResponse'])$(id).onclick=event=>{
    if(!image)return;const rect=event.currentTarget.getBoundingClientRect(),canvas=event.currentTarget;
    let column=Math.floor((event.clientX-rect.left)/rect.width*canvas.width),row=Math.floor((event.clientY-rect.top)/rect.height*canvas.height);
    if(id==='photoInput'){row--;column--;}
    restartWalk();selection={row:Math.max(0,Math.min(image.length-3,row)),column:Math.max(0,Math.min(image[0].length-3,column))};render();
  };
  void load();
}
if(typeof document!=='undefined'&&document.getElementById('real-photo'))initPhoto();
