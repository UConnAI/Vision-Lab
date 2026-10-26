import {PHOTO_BANK} from './photo-bank.mjs';
import {grayscaleRows,analyzePhoto} from './photo-core.mjs';
import {MASK_FILTERS,maskStrength,outputPixel,inspectMaskPatch} from './mask-core.mjs';
const $=id=>document.getElementById(id);
let input=null,photo=null,kernel=MASK_FILTERS.vertical.map(r=>r.slice()),analysis=null,row=0,column=0,selected=4,frame=null,last=0,loadVersion=0;
const source=document.createElement('canvas'),response=document.createElement('canvas'),overlay=document.createElement('canvas');
function stop(){if(frame!==null)cancelAnimationFrame(frame);frame=null;$('maskScan').textContent='Watch the filter slide';}
function drawViews(){
 if(!input)return;
 const width=input[0].length,height=input.length;
 for(const [id,base] of [['maskOriginal',source],['maskResponse',response],['maskOverlay',overlay]]){
  const canvas=$(id);canvas.width=width*2;canvas.height=height*2;const ctx=canvas.getContext('2d');ctx.drawImage(base,0,0,canvas.width,canvas.height);ctx.scale(2,2);
  ctx.strokeStyle='#fff';ctx.lineWidth=1.6;ctx.strokeRect(column-.5,row-.5,4,4);ctx.strokeStyle='#9c3bff';ctx.lineWidth=.7;ctx.strokeRect(column,row,3,3);
  const x=column+selected%3,y=row+Math.floor(selected/3);ctx.fillStyle='#f5c44dcc';ctx.fillRect(x,y,1,1);
 }
 const trace=inspectMaskPatch(input,kernel,row,column);
 $('maskPatch').replaceChildren(...trace.terms.map((term,index)=>{const cell=document.createElement('button');cell.textContent=term.pixel.toFixed(2);cell.className=index===selected?'selected':'';const gray=Math.round(term.pixel*255);cell.style.background=`rgb(${gray},${gray},${gray})`;cell.style.color=gray<140?'white':'#14373e';cell.setAttribute('aria-label',`Patch row ${Math.floor(index/3)+1}, column ${index%3+1}, brightness ${term.pixel.toFixed(3)}`);cell.onclick=()=>{selected=index;highlightWeights();drawViews();};return cell;}));
 const term=trace.terms[selected],center=outputPixel(row,column);
 $('maskCalculation').textContent=`Selected pixel: ${term.pixel.toFixed(3)} × weight ${term.weight} = ${term.product.toFixed(3)}. Sum of all nine products: ${trace.score.toFixed(3)}. Strength: ${maskStrength(trace.score,kernel).toFixed(3)}. Output (${row}, ${column}) paints original pixel (${center.y}, ${center.x}); coordinates start at zero.`;
}
function highlightWeights(){[...$('maskWeights').children].forEach((el,i)=>el.classList.toggle('selected',i===selected));}
function calculate(){
 if(!input)return;analysis=analyzePhoto(input,kernel,0,{relu:false});
 const width=input[0].length,height=input.length,threshold=Number($('maskThreshold').value),opacity=Number($('maskOpacity').value);
 response.width=overlay.width=width;response.height=overlay.height=height;
 const rc=response.getContext('2d'),oc=overlay.getContext('2d');rc.fillStyle='#101a25';rc.fillRect(0,0,width,height);oc.drawImage(source,0,0);
 let count=0;
 analysis.responses.forEach((values,y)=>values.forEach((score,x)=>{const strength=maskStrength(score,kernel),p=outputPixel(y,x),display=Math.min(1,Math.sqrt(strength)*1.8);rc.fillStyle=`rgb(${Math.round(25+190*display)},${Math.round(18+100*display)},${Math.round(38+217*display)})`;rc.fillRect(p.x,p.y,1,1);if(strength>=threshold){count++;oc.fillStyle=`rgba(166,59,255,${opacity})`;oc.fillRect(p.x,p.y,1,1);}}));
 $('maskThresholdValue').textContent=threshold.toFixed(2);
 $('maskStatus').textContent=`${width} × ${height} working pixels → ${width-2} × ${height-2} responses. ${count.toLocaleString()} positions pass the threshold and appear purple. White/purple square: inspected 3 × 3 window; gold: selected input pixel.`;
 drawViews();
}
function editKernel(){
 $('maskWeights').replaceChildren(...kernel.flat().map((value,index)=>{const field=document.createElement('input');field.type='number';field.min='-8';field.max='8';field.step='1';field.value=String(value);field.setAttribute('aria-label',`Mask weight row ${Math.floor(index/3)+1}, column ${index%3+1}`);field.onfocus=()=>{selected=index;highlightWeights();drawViews();};field.oninput=()=>{const next=Number(field.value);if(!Number.isFinite(next)||Math.abs(next)>8)return;kernel[Math.floor(index/3)][index%3]=next;$('maskPreset').value='custom';$('maskHelp').textContent=explanations.custom;stop();calculate();};return field;}));highlightWeights();
}
async function load(key){
 const version=++loadVersion;stop();$('maskStatus').textContent='Loading photograph…';
 try{const img=new Image();img.src=PHOTO_BANK[key].file;await img.decode();if(version!==loadVersion)return;photo=key;
 const width=320,height=Math.round(img.naturalHeight/img.naturalWidth*width);source.width=width;source.height=height;const ctx=source.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,width,height);input=grayscaleRows(ctx.getImageData(0,0,width,height).data,width,height);row=Math.floor((height-3)/2);column=Math.floor((width-3)/2);
 for(const button of $('maskPhotos').children)button.setAttribute('aria-pressed',String(button.dataset.photo===key));
 const link=document.createElement('a');link.href=PHOTO_BANK[key].source;link.textContent='Photo source';$('maskCredit').replaceChildren(`${PHOTO_BANK[key].credit} · `,link);calculate();
 }catch(error){$('maskStatus').textContent=`Could not load this photo: ${error.message}`;}
}
const explanations={vertical:'Vertical edges compare the left and right sides of each window. Both signs are shown, so either direction of contrast can appear purple.',horizontal:'Horizontal edges compare the top and bottom of each window. Try the cup rim, shoulders, eyelids and background boundaries.',outline:'The Laplacian compares the center with its four neighbors. Fine outlines and texture respond. It does not identify circles or objects.',custom:'Your nine weights are used at every complete image window. Watch the sum and the purple mask as you change one weight.'};
for(const key of ['coffee','cat','astronaut','camera']){const item=PHOTO_BANK[key],button=document.createElement('button');button.dataset.photo=key;const img=document.createElement('img');img.src=item.file;img.alt='';const title=document.createElement('span');title.textContent=item.title;button.append(img,title);button.onclick=()=>void load(key);$('maskPhotos').append(button);}
$('maskPreset').onchange=()=>{const preset=$('maskPreset').value;if(MASK_FILTERS[preset])kernel=MASK_FILTERS[preset].map(r=>r.slice());$('maskHelp').textContent=explanations[preset];stop();editKernel();calculate();};
$('maskThreshold').oninput=calculate;$('maskOpacity').oninput=calculate;
for(const id of ['maskOriginal','maskResponse','maskOverlay'])$(id).onclick=event=>{if(!input)return;stop();const rect=event.currentTarget.getBoundingClientRect();column=Math.max(0,Math.min(input[0].length-3,Math.floor((event.clientX-rect.left)/rect.width*input[0].length)-1));row=Math.max(0,Math.min(input.length-3,Math.floor((event.clientY-rect.top)/rect.height*input.length)-1));drawViews();};
function animate(now){if(now-last>85){last=now;column+=3;if(column>input[0].length-3){column=0;row=(row+3)%(input.length-2);}drawViews();}frame=requestAnimationFrame(animate);}
$('maskScan').onclick=()=>{if(!input)return;if(frame!==null){stop();return;}$('maskScan').textContent='Pause sliding filter';last=0;frame=requestAnimationFrame(animate);};
$('maskFull').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('filter-lab').requestFullscreen();}catch{$('maskStatus').textContent='Full screen is unavailable in this browser. Use browser zoom to enlarge the lab.';}};
document.addEventListener('fullscreenchange',()=>{$('maskFull').textContent=document.fullscreenElement?'Exit full screen':'Full screen';});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);
$('maskHelp').textContent=explanations.vertical;editKernel();void load('coffee');
