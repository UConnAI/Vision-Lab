import {convolutionShape,smoothPositions,intersectionOverUnion} from './lecture-math.mjs';
const $=id=>document.getElementById(id);
function updateStageNavigation(){
  let id='';try{id=decodeURIComponent(location.hash.slice(1));}catch{}
  const target=document.getElementById(id),deep=Boolean(target?.closest('#formulaDive,#reviewRoadmap,#technicalReference'));
  for(const link of document.querySelectorAll('header [data-stage]')){
    const selected=link.dataset.stage===(deep?'deep':'lecture');link.classList.toggle('active',selected);
    if(selected)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  }
}
window.addEventListener('hashchange',updateStageNavigation);updateStageNavigation();
function openLectureAnchor(){
  let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}
  if(!id)return;const target=$(id);if(!target)return;
  for(let parent=target;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
  requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));
}
document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[href^="#"]');if(!link)return;
  let target;try{target=$(decodeURIComponent(link.hash.slice(1)));}catch{return;}
  for(let parent=target;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
});
window.addEventListener('hashchange',openLectureAnchor);window.addEventListener('load',openLectureAnchor,{once:true});openLectureAnchor();
if($('showDerivations'))$('showDerivations').onclick=()=>{
  for(let parent=$('derivationReview');parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
  $('readingMode').textContent='Worked derivations and implementation review.';$('derivationReview').scrollIntoView({block:'start'});
};
$('showMath').onclick=()=>{$('formulaDive').open=true;$('readingMode').textContent='Formula reference: follow the numerical calculations and inspect the Python functions.';$('formulaDive').scrollIntoView({block:'start'});};
$('showDetails').onclick=()=>{for(const box of document.querySelectorAll('details'))if(!box.closest('.learningGuide'))box.open=true;$('readingMode').textContent='Full technical view: equations, worked examples and Python functions are open.';};
$('hideDetails').onclick=()=>{for(const box of document.querySelectorAll('details'))if(!box.closest('.learningGuide'))box.open=false;$('readingMode').textContent='Worked examples and demo explanations are collapsed.';$('topic-foundations')?.scrollIntoView({block:'start'});};
function tensorCalculation(){try{const get=id=>Number($(id).value),r=convolutionShape(get('shapeN'),get('shapeK'),get('shapeS'),get('shapeP'),get('shapeC'),get('shapeF'));$('shapeResult').textContent=`Output: ${r.output} × ${r.output} × ${get('shapeF')} · ${r.parameters.toLocaleString()} learned parameters including bias · ${r.activations.toLocaleString()} output values per image.`;}catch(e){$('shapeResult').textContent=e.message;}}
for(const id of ['shapeN','shapeK','shapeS','shapeP','shapeC','shapeF'])$(id).oninput=tensorCalculation;
tensorCalculation();
function smoothingDemo(){const alpha=Number($('lagAlpha').value),target=Array.from({length:45},(_,i)=>60+(i<23?i:46-i)*11),filtered=smoothPositions(target,alpha),canvas=$('lagCanvas'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#f4f7f6';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.font='15px Arial';ctx.fillStyle='#142d32';ctx.fillText('Position (pixels)',12,22);ctx.fillText('Time (45 samples at 10 Hz)',340,194);for(const [values,color]of [[target,'#087e80'],[filtered,'#ea6852']]){ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();values.forEach((v,i)=>ctx[i?'lineTo':'moveTo'](35+i*12,175-v*.4));ctx.stroke();}const lag=Math.max(...target.map((v,i)=>Math.abs(v-filtered[i])));$('lagValue').textContent=alpha.toFixed(1);$('lagResult').textContent=`Maximum position difference: ${lag.toFixed(1)} px. Teal = measured path. Coral = smoothed path. This is a calculated trajectory, not a CNN measurement.`;}
$('lagAlpha').oninput=smoothingDemo;smoothingDemo();
function overlapDemo(){const shift=Number($('iouShift').value),canvas=$('iouCanvas'),ctx=canvas.getContext('2d'),truth=[60,45,100,100],prediction=[60+shift,45,100,100];ctx.clearRect(0,0,canvas.width,canvas.height);for(const [box,color]of [[truth,'#087e80'],[prediction,'#ea6852']]){ctx.strokeStyle=color;ctx.lineWidth=4;ctx.strokeRect(...box);}ctx.fillStyle='#142d32';ctx.font='15px Arial';ctx.fillText('Teal: human box. Coral: detector box.',15,180);$('iouResult').textContent=`Horizontal shift ${shift} px · IoU ${intersectionOverUnion(truth,prediction).toFixed(3)}. A confidence score alone cannot tell you how well these boxes overlap.`;}
$('iouShift').oninput=overlapDemo;overlapDemo();
// Copy exactly the visible code, without executing or modifying it.
for(const button of document.querySelectorAll('[data-copy]'))button.onclick=async()=>{try{await navigator.clipboard.writeText($(button.dataset.copy).textContent);button.textContent='Copied';}catch{button.textContent='Select the code to copy';}};
