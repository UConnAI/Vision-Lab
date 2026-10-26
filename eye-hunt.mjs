import {PHOTO_BANK} from './photo-bank.mjs';
import {patchOrigin,weightPixel,setPixelWeight,searchPixelEyes,pixelContribution,catTestViews,testCatKernel} from './pixel-eye-core.mjs';
const $=id=>document.getElementById(id);
const titles={astronaut:'Clear eyes · build',hopper:'Glasses · transfer',cat:'Cat eyes · adapt your filter'};
const fixtures=fetch('assets/eye-pixel-lab.json').then(response=>{if(!response.ok)throw new Error('Pixel examples could not load.');return response.json();});
let bank,key=null,image=null,weights=[],selected=0,origin={x:0,y:0},result=null,carry=null,expert=false,hints=0,attempts=0,submitted=null,assisted=false;
function paint(canvas,data){canvas.width=data.width;canvas.height=data.height;const context=canvas.getContext('2d'),rgba=context.createImageData(data.width,data.height);data.pixels.forEach((v,i)=>{rgba.data[i*4]=rgba.data[i*4+1]=rgba.data[i*4+2]=v;rgba.data[i*4+3]=255;});context.putImageData(rgba,0,0);return context;}
function drawPhoto(){
  const sample=document.createElement('canvas');paint(sample,image);const canvas=$('pixelPhoto');canvas.width=image.width*20;canvas.height=image.height*20;const context=canvas.getContext('2d');context.imageSmoothingEnabled=false;context.drawImage(sample,0,0,canvas.width,canvas.height);context.scale(20,20);context.lineWidth=.08;
  context.strokeStyle='#ffffff25';for(let x=0;x<=image.width;x++){context.beginPath();context.moveTo(x,0);context.lineTo(x,image.height);context.stroke();}for(let y=0;y<=image.height;y++){context.beginPath();context.moveTo(0,y);context.lineTo(image.width,y);context.stroke();}
  for(const peak of result.peaks){context.strokeStyle='#00e7cc';context.lineWidth=.16;context.strokeRect(peak.x-2,peak.y-2,4,4);}
  context.strokeStyle='#b164ff';context.lineWidth=.17;context.setLineDash([.25,.18]);context.strokeRect(origin.x,origin.y,4,4);context.setLineDash([]);
  const point=weightPixel(origin,selected);context.fillStyle='#b454ff88';context.fillRect(point.x,point.y,1,1);context.strokeStyle='white';context.lineWidth=.13;context.strokeRect(point.x+.06,point.y+.06,.88,.88);
  $('pixelPhoto').setAttribute('aria-label',`${titles[key]}. ${result.peaks.length} detections. Highlighted pixel at column ${point.x+1}, row ${point.y+1}, matches selected weight row ${Math.floor(selected/4)+1}, column ${selected%4+1}.`);
}
function invalidateSubmission(){
  if(key==='cat'&&submitted){submitted=null;$('catTestStatus').textContent='Detector changed. Test again to earn your result.';$('catTestResults').replaceChildren();}
}
function activeEditable(){return key==='cat'&&expert?Array.from({length:16},(_,i)=>i):image.editable;}
function render(){
  if(!image)return;
  result=searchPixelEyes(image,weights,Number($('pixelThreshold').value));
  const grid=$('pixelWeights');grid.replaceChildren();
  weights.forEach((value,index)=>{
    const editable=activeEditable().includes(index),button=document.createElement('button');button.type='button';button.dataset.weight=String(index);button.textContent=(value>0?'+1':String(value).replace('-','−'))+(key==='cat'&&!editable?' ·':'');button.className=`pixelWeight ${value<0?'negative':value>0?'positive':'zero'} ${editable?'':'locked'}`;button.setAttribute('aria-pressed',String(index===selected));button.setAttribute('aria-label',`Weight row ${Math.floor(index/4)+1}, column ${index%4+1}, value ${value}${editable?'':', fixed'}`);button.onclick=()=>{selected=index;render();$('pixelWeights').children[index].focus({preventScroll:true});};grid.append(button);
  });
  $('pixelPatch').replaceChildren();
  const contribution=pixelContribution(image,weights,origin,selected);
  contribution.patch.forEach((v,index)=>{const cell=document.createElement('button');cell.type='button';cell.textContent=String(Number(v.toFixed(1)));cell.dataset.pixel=String(index);cell.className=`patchPixel ${index===selected?'selected':''}`;cell.style.background=`rgb(${v},${v},${v})`;cell.style.color=v>140?'#17343a':'white';cell.setAttribute('aria-label',`Patch row ${Math.floor(index/4)+1}, column ${index%4+1}, brightness ${v}`);cell.onclick=()=>{selected=index;render();};$('pixelPatch').append(cell);});
  const editable=activeEditable().includes(selected);
  for(const value of [-1,0,1])$('pixelSet'+(value<0?'Minus':value>0?'Plus':'Zero')).disabled=!editable;
  $('pixelSelected').textContent=`Row ${Math.floor(selected/4)+1}, column ${selected%4+1}: weight ${weights[selected]} ↔ pixel ${Number(contribution.pixel.toFixed(1))}${editable?'':' · fixed test cell'}`;
  $('pixelContribution').textContent=`The highlighted pixel has brightness ${Number(contribution.pixel.toFixed(1))} out of 255: ${contribution.pixel<contribution.pixelMean?'darker than':contribution.pixel>contribution.pixelMean?'brighter than':'equal to'} this patch’s average (${contribution.pixelMean.toFixed(1)}). With your current kernel, this cell ${contribution.product>0?'adds evidence for the pattern':contribution.product<0?'subtracts evidence for the pattern':'contributes zero'}.`;
  $('pixelContributionCalculation').textContent=`Centered weight × centered pixel = (${weights[selected]} − ${contribution.weightMean.toFixed(3)}) × (${contribution.pixel} − ${contribution.pixelMean.toFixed(3)}) = ${contribution.product.toFixed(3)}. The final pattern score adds all sixteen products and divides by the kernel and patch contrast lengths.`;
  $('pixelThresholdValue').textContent=Number($('pixelThreshold').value).toFixed(2);
  $('pixelResult').dataset.state=result.grade.passed?'passed':'retry';
  $('pixelResult').textContent=`${result.grade.passed?'Solved!':'Build your filter.'} ONE 4 × 4 kernel · ${result.grade.found}/2 eyes found · ${result.grade.extra} extra detections. ${weights.every(v=>v===0)?'The blank filter cannot match anything yet.':result.grade.passed?'Your pattern works on this pixel view.':'Change a weight or adjust the threshold, then compare the cyan detections.'}`;
  $('pixelDetections').replaceChildren();
  result.peaks.forEach((peak,index)=>{const button=document.createElement('button');button.textContent=`Inspect match ${index+1} · ${peak.score.toFixed(3)}`;button.onclick=()=>{origin=patchOrigin(image,peak.x,peak.y);render();};$('pixelDetections').append(button);});
  if(result.grade.passed&&key!=='cat')carry=weights.slice();
  $('pixelWorkStatus').textContent=`${image.width} × ${image.height} averaged grayscale pixels · 16 weights · ${result.scan.scanned} complete patches searched. Click the photo to inspect a different 4 × 4 window.`;
  drawPhoto();
}
function openExercise(next){
  key=next;image=bank[key];weights=key==='cat'?image.starter.slice():(carry?carry.slice():image.starter.slice());selected=key==='cat'?image.editable[0]:0;origin=patchOrigin(image,...image.inspect[0]);
  expert=false;hints=0;attempts=0;submitted=null;assisted=false;$('catLevel').value='repair';$('catView').value='0';$('catMission').hidden=true;$('pixelRevealInside').hidden=key!=='cat';$('catTestStatus').textContent='No submission yet. Inspect, build, then test.';$('catTestResults').replaceChildren();$('catHintText').textContent='';
  $('pixelTitle').textContent=titles[key];$('pixelThreshold').value=String(image.threshold);
  $('pixelInstructions').textContent=key==='cat'?'Adapt the human-eye filter for darker, larger pupils. Four colored cells can change; dotted cells are fixed. An editable cell is already selected: use −1, 0 or +1 above it. Inspect the two patches and adapt the dark band into a pupil pattern. Find both eyes with zero extras.':key==='hopper'&&carry?'Your successful filter is loaded unchanged. Test the same dark-band rule through glasses. Inspect the matching pixels before changing any weights.':'Start from sixteen zeros. Fill the surround with +1, then use −1 where the small eye patch has a dark band. Inspect a weight’s matching pixel before you change it.';
  $('pixelFill').hidden=key==='cat';$('pixelBlank').hidden=key==='cat';$('pixelPracticeAnswer').hidden=key==='cat';$('pixelPracticeAnswer').open=false;$('pixelCatSolution').hidden=true;
  const credit=$('pixelCredit'),link=document.createElement('a');link.href=PHOTO_BANK[key].source;link.textContent='Photo source';credit.replaceChildren(`${PHOTO_BANK[key].credit} · averaged face crop · `,link);
  if(!$('eyeExerciseDialog').open)$('eyeExerciseDialog').showModal();
  render();$('pixelTitle').focus({preventScroll:true});
}
async function setup(){
  bank=await fixtures;
  for(const card of document.querySelectorAll('[data-open-pixel]')){
    const next=card.dataset.openPixel;paint(card.querySelector('canvas'),bank[next]);card.onclick=()=>openExercise(next);
  }
  $('pixelClose').onclick=()=>$('eyeExerciseDialog').close();
  for(const [suffix,value] of [['Minus',-1],['Zero',0],['Plus',1]])$('pixelSet'+suffix).onclick=()=>{weights=setPixelWeight(weights,selected,value,activeEditable());invalidateSubmission();render();};
  $('pixelFill').onclick=()=>{weights=Array(16).fill(1);render();};$('pixelBlank').onclick=()=>{weights=Array(16).fill(0);render();};
  $('pixelInspectLeft').onclick=()=>{origin=patchOrigin(image,...image.inspect[0]);render();};$('pixelInspectRight').onclick=()=>{origin=patchOrigin(image,...image.inspect[1]);render();};
  $('pixelReset').onclick=()=>{assisted=false;hints=0;attempts=0;$('catHintText').textContent='';weights=image.starter.slice();$('pixelThreshold').value=String(image.threshold);origin=patchOrigin(image,...image.inspect[0]);selected=key==='cat'?(expert?0:image.editable[0]):0;if(expert)weights=Array(16).fill(0);invalidateSubmission();render();};$('pixelThreshold').oninput=()=>{invalidateSubmission();render();};
  $('pixelPhoto').onclick=event=>{const rect=event.currentTarget.getBoundingClientRect(),x=Math.floor((event.clientX-rect.left)/rect.width*image.width),y=Math.floor((event.clientY-rect.top)/rect.height*image.height);origin=patchOrigin(image,x,y);render();};
  $('pixelWeights').onkeydown=event=>{
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();selected=Math.max(0,Math.min(15,selected+({ArrowLeft:-1,ArrowRight:1,ArrowUp:-4,ArrowDown:4}[event.key])));render();$('pixelWeights').children[selected].focus();}
  };
  $('pixelApplyPractice').onclick=()=>{if(key==='cat')return;weights=image.weights.slice();$('pixelThreshold').value=String(image.threshold);render();};
  $('pixelNextPractice').onclick=()=>openExercise(key==='astronaut'?'cat':'astronaut');

  $('catLevel').onchange=()=>{
    expert=$('catLevel').value==='expert';assisted=false;hints=0;attempts=0;$('catHintText').textContent='';weights=expert?Array(16).fill(0):bank.cat.starter.slice();selected=expert?0:bank.cat.editable[0];
    invalidateSubmission();$('pixelInstructions').textContent=expert?'Invent your own detector: all 16 cells are editable and start at zero. Inspect both eye patches, build a contrast pattern, then test it across all three views.':'Repair the human filter. Four colored cells are editable; dotted cells are fixed. Select a colored cell, then set −1, 0 or +1.';render();
  };
  $('catView').onchange=()=>{image=catTestViews(bank.cat)[Number($('catView').value)];origin=patchOrigin(image,...image.inspect[0]);render();};
  $('catTest').onclick=()=>{
    attempts++;submitted=testCatKernel(bank.cat,weights,Number($('pixelThreshold').value));
    const passed=submitted.filter(r=>r.passed).length;
    $('catTestStatus').textContent=`${passed===3?(assisted?'Worked solution verified.':expert?'Detector inventor!':'Cat-eye detective!'):'Keep experimenting.'} ${passed}/3 checks passed · attempt ${attempts} · ${hints} clues used. ${passed===3?'One kernel found all six eye instances with zero extras.':'Inspect a failing view. Missing eyes: relax the threshold or improve the pattern. Extras: tighten the threshold or refine the pattern.'}`;
    $('catTestResults').replaceChildren(...submitted.map((r,index)=>{const button=document.createElement('button');button.textContent=`${r.passed?'✓':'○'} ${r.name}: ${r.found}/2 eyes · ${r.extra} extras`;button.onclick=()=>{$('catView').value=String(index);image=catTestViews(bank.cat)[index];origin=patchOrigin(image,...image.inspect[0]);render();};return button;}));
  };
  const clues=['Compare the two eye patches. Which pixels stay dark in both? A negative weight can reward that shared darkness.','The human filter favors a thin dark band. The cat pupils need darkness across two middle rows. Keep a bright surround.','Try a negative middle 2 × 2 block with a positive outside ring. Then tune the threshold between unwanted matches and the weaker eye.'];
  $('catHint').onclick=()=>{$('catHintText').textContent=clues[Math.min(hints++,clues.length-1)];};
  const reveal=()=>{if(key!=='cat'||!$('eyeExerciseDialog').open)openExercise('cat');$('pixelCatSolution').hidden=!$('pixelCatSolution').hidden;};
  if($('catRevealSecret'))$('catRevealSecret').onclick=reveal;$('pixelRevealInside').onclick=()=>{reveal();$('pixelCatSolution').scrollIntoView({block:'nearest',behavior:'smooth'});};
  document.addEventListener('keydown',event=>{if(event.altKey&&event.shiftKey&&event.code==='KeyK'){event.preventDefault();reveal();}});
  $('pixelApplyCat').onclick=()=>{if(key!=='cat')return;assisted=true;weights=bank.cat.weights.slice();$('pixelThreshold').value=String(bank.cat.threshold);invalidateSubmission();render();$('pixelCatSolution').hidden=true;};
}
if($('eyeExerciseDialog'))void setup().catch(error=>{$('pixelLoadStatus').textContent=error.message;});
