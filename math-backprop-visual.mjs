import {IMAGE,initialParameters,sgdStep} from './math-backprop-core.mjs';
import {derivative,renderMathText} from './math-notation.mjs';

export const FLOW_STAGES=['Ready','Convolve the image','Apply the activation function','Compute dense scores','Turn scores into probabilities','Compare with the true label','Start the backward pass','Differentiate the dense weights','Differentiate the activation','Add all shared-filter uses',...Array.from({length:15},(_,i)=>`Inspect parameter ${i+1} of 15`),'Apply all fifteen updates together','Run forward with the new weights','Compare, then repeat'];
export function parameterRows(parameters,gradients,rate){
  const rows=[];
  for(let u=0;u<2;u++)for(let v=0;v<2;v++)rows.push({name:`K[${u},${v}]`,value:parameters.kernel[u][v],gradient:gradients.kernel[u][v],kind:'kernel',u,v});
  rows.push({name:'b',value:parameters.convBias,gradient:gradients.convBias,kind:'bias'});
  for(let k=0;k<2;k++)for(let j=0;j<4;j++)rows.push({name:`W[${k},${j}]`,value:parameters.dense[k][j],gradient:gradients.dense[k][j],kind:'dense',k,j});
  for(let k=0;k<2;k++)rows.push({name:`c[${k}]`,value:parameters.denseBias[k],gradient:gradients.denseBias[k],kind:'bias'});
  return rows.map(row=>({...row,delta:-rate*row.gradient,next:row.value-rate*row.gradient}));
}
export function flowSnapshot(base,target,rate,phase=0,cycle=0){
  const candidate=sgdStep(base,target,rate),committed=phase>=25;
  return {base,target,rate,phase,cycle,candidate,forward:candidate.gradients.forward,gradients:candidate.gradients,rows:parameterRows(base,candidate.gradients,rate),parameters:committed?candidate.updated:base,steps:cycle+Number(committed),stage:phase===0?0:phase<6?1:phase<25?2:3};
}
const number=value=>Math.abs(value)<.0000005?'0':value.toFixed(6).replace(/0+$/,'').replace(/\.$/,''),short=value=>Math.abs(value)<.0005?'0':value.toFixed(3).replace(/0+$/,'').replace(/\.$/,''),signed=value=>(value>0?'+':'')+number(value),vector=values=>'['+values.map(short).join(', ')+']';
const compactGradient=value=>Math.abs(value)<.005?(value===0?'0':'≈0'):(value>0?'+':'−')+Number(Math.abs(value).toPrecision(2)).toString().replace(/^0\./,'.');
const tone=value=>value>0?'positive':value<0?'negative':'zero';
function cells(values,gradient=false,signOnly=false){const flat=values.flat(),max=Math.max(...flat.map(Math.abs),.001);return `<div class="bpvCells" style="--columns:${Array.isArray(values[0])?values[0].length:2}">${flat.map(value=>`<span class="${gradient?(signOnly&&Math.abs(value)<1e-12?'zero':tone(value)):'activation'}" title="${gradient?'Gradient '+String(value):number(value)}" aria-label="${gradient?'Gradient '+String(value):number(value)}" style="--strength:${.12+.32*Math.abs(value)/max}">${signOnly?(value===0?'0':Math.abs(value)<1e-12?'≈0':value>0?'+':'−'):gradient?compactGradient(value):short(value)}</span>`).join('')}</div>`;}

function featureVector(values,gradient=false){
  const max=Math.max(...values.map(Math.abs),.001);
  return `<div class="bpvFeatureVector" role="group" aria-label="${gradient?'Feature gradient':'Flattened feature'} vector, four rows and one column"><div class="bpvFeatureIndices" aria-hidden="true">${values.map((_,j)=>`<span>h<sub>${j}</sub></span>`).join('')}</div><div class="bpvCells bpvColumnVector" style="--columns:1">${values.map((value,j)=>`<span class="${gradient?tone(value):'activation'}" title="${String(value)}" aria-label="${gradient?'Gradient for ':''}h${j} = ${String(value)}" style="--strength:${.12+.32*Math.abs(value)/max}">${gradient?compactGradient(value):short(value)}</span>`).join('')}</div></div>`;
}

// Derivations use the same saved forward pass as the animated network.
function scoreFormula(parameters,forward){
  return `<div class="bpvEquationLine">s = Wh + c; &nbsp; s<sub>k</sub> = ∑<sub>j=0</sub><sup>3</sup> W<sub>k,j</sub>h<sub>j</sub> + c<sub>k</sub></div>`+
    parameters.dense.map((row,k)=>`<div class="bpvEquationLine">s<sub>${k?'B':'A'}</sub> = ${row.map((w,j)=>`(${number(w)}) × ${number(forward.flat[j])}`).join(' + ')} + (${number(parameters.denseBias[k])}) = ${number(forward.logits[k])}</div>`).join('');
}
function softmaxFormula(parameters,forward){
  const m=Math.max(...forward.logits),shifted=forward.logits.map(s=>s-m),exps=shifted.map(Math.exp),sum=exps.reduce((a,b)=>a+b,0);
  const exp=value=>`<msup><mi>e</mi><mrow><mn>${number(value)}</mn></mrow></msup>`;
  const ratio=(top,bottom,label)=>`<math class="mathNotation" aria-label="${label}"><mstyle displaystyle="true"><mfrac><mrow>${top}</mrow><mrow>${bottom}</mrow></mfrac></mstyle></math>`;
  return scoreFormula(parameters,forward)+
    `<div class="bpvEquationLine">p<sub>k</sub> = ${ratio('<msup><mi>e</mi><msub><mi>s</mi><mi>k</mi></msub></msup>','<msup><mi>e</mi><msub><mi>s</mi><mi>A</mi></msub></msup><mo>+</mo><msup><mi>e</mi><msub><mi>s</mi><mi>B</mi></msub></msup>','exponential of score k divided by the sum of both exponentials')}</div>`+
    forward.logits.map((s,k)=>`<div class="bpvEquationLine">p<sub>${k?'B':'A'}</sub> = ${ratio(exp(s),exp(forward.logits[0])+'<mo>+</mo>'+exp(forward.logits[1]),'softmax probability for class '+(k?'B':'A'))} ≈ ${number(forward.probabilities[k])}</div>`).join('')+
    `<details class="bpvSoftmaxStable"><summary>How the code computes the same result safely</summary><p>Subtract the largest score from both scores before exponentiating. The common factor cancels, so the probabilities stay the same. Numbers below are rounded for display.</p><div class="bpvEquationLine">m = max(s<sub>A</sub>, s<sub>B</sub>) = ${number(m)}</div>`+
    exps.map((e,k)=>`<div class="bpvEquationLine">p<sub>${k?'B':'A'}</sub> = ${ratio(exp(shifted[k]),exp(shifted[0])+'<mo>+</mo>'+exp(shifted[1]),'shifted softmax probability')} ≈ ${ratio('<mn>'+number(e)+'</mn>','<mn>'+number(sum)+'</mn>','shifted exponential divided by their sum')} ≈ ${number(forward.probabilities[k])}</div>`).join('')+'</details>';
}

export function createTrainingVisual(mount,onChange){
  let base=initialParameters(),target=1,rate=.1,phase=0,cycle=0,selected=0,playing=false,timer=null,delay=1300,invalidMessage=null;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  mount.innerHTML=`<section class="bpv" aria-label="Animated CNN training loop"><div class="bpvIntro"><span class="bpvEyebrow">FOLLOW ONE TRAINING EXAMPLE</span><div class="bpvViewControls"><button id="bpvLarge" type="button">Large presentation view</button><button id="bpvFullscreen" type="button">Fullscreen</button><button id="bpvExit" type="button" hidden>Exit large view</button></div><h3 id="bpvDialogTitle">Values travel forward. Gradients travel backward.</h3><p>This is a feed-forward CNN inside an optimizer training loop. The moving arrows show the direction of a calculation. Their speed is a teaching control, not measured model latency.</p></div><div class="bpvControls"><button id="bpvPlay" type="button">Play training loop</button><button id="bpvPrevious" type="button">Previous step</button><button id="bpvNext" type="button">Next step</button><button id="bpvPresentationReset" type="button" hidden>Reset example</button><label>Step duration <input id="bpvSpeed" type="range" min="400" max="3000" value="1300" step="100"><output id="bpvSpeedValue">1.3 s</output></label><label id="bpvTextSizeLabel" hidden>Projector text <input id="bpvTextSize" aria-label="Projector text size" type="range" min="100" max="160" value="100" step="10"><output id="bpvTextSizeValue">100%</output></label><button id="bpvFocus" type="button" aria-pressed="false" hidden>Focus calculation</button></div><div class="bpvKernelReference" role="group" aria-label="Current kernel and dense weights and biases"><div class="bpvKernelBlock"><div class="bpvKernelHeading"><strong>Current kernel K · 2 × 2</strong><span id="bpvKernelState"></span><div class="bpvKernelBias">Bias b <strong id="bpvKernelBias"></strong></div></div><table class="bpvKernelMatrix" aria-label="Current two by two kernel"><tbody id="bpvKernelValues"></tbody></table></div><div class="bpvDenseBlock"><strong class="bpvDenseHeading">Current dense weights W · 2 × 4, and class biases c</strong><div class="bpvDenseTableWrap"><table class="bpvDenseMatrix" aria-label="Weights to class A and class B, with class biases"><thead><tr><th scope="col">Class</th><th scope="col">h0</th><th scope="col">h1</th><th scope="col">h2</th><th scope="col">h3</th><th scope="col">c (bias)</th></tr></thead><tbody id="bpvDenseValues"></tbody></table></div></div></div><div class="bpvProgress"><progress id="bpvProgress" max="27" value="0" aria-label="Training cycle progress"></progress><span id="bpvCounter"></span></div><p id="bpvViewStatus" class="bpvViewStatus" role="status" hidden></p><p id="bpvPanHint" class="bpvPanHint" hidden>Pan sideways to follow all six layers, or choose Focus calculation for one large equation and weight update.</p><div class="bpvPresenterBody" tabindex="0" aria-label="Network and calculation details"><div class="bpvPresenterNetwork"><div class="bpvDirection" id="bpvDirection"></div><div class="bpvNetworkScroll" tabindex="0" aria-label="Network diagram; scroll horizontally on a narrow screen"><div class="bpvNetwork" id="bpvNetwork"></div></div><p class="bpvLegend">Gradient: <span class="positive">+ positive</span> increases loss when the variable increases; <span class="negative">− negative</span> decreases loss. The input-gradient heatmap shows signs (+/−/0). Nonzero input gradients smaller than 10⁻¹² appear as ≈0 because floating-point cancellation can leave tiny residuals; exact zeros remain 0. Hover for the full computed value; the detailed table below gives rounded values. Other network gradients use about two significant digits (tiny rounded values appear ≈0). Hover a cell or inspect the six-decimal details below. Cell shading is scaled within each displayed group; exact zeros are labeled 0.</p></div><div class="bpvPresenterAside"><div class="bpvStory" role="status" aria-live="polite"><span id="bpvStep"></span><h4 id="bpvTitle"></h4><p id="bpvExplanation"></p><div class="bpvFormula" id="bpvFormula"></div></div><div id="bpvWeights" class="bpvWeights"></div><div class="bpvFeedback" id="bpvFeedback"></div></div></div><p class="bpvMotionNote">${reduced.matches?'Reduced motion is enabled: arrows stay still; the highlighted stage and numeric steps remain available.':'Pause at any point, or use Next step to inspect each calculation.'}</p></section>`;
  const $=id=>mount.querySelector('#'+id);
  const panel=mount.querySelector('.bpv'),dialog=document.createElement('dialog');
  dialog.id='bpvPresentationDialog';dialog.className='bpvDialog';dialog.setAttribute('aria-labelledby','bpvDialogTitle');mount.append(dialog);
  $('bpvLarge').setAttribute('aria-haspopup','dialog');$('bpvLarge').setAttribute('aria-controls',dialog.id);
  let presentation=false,returnFocus=null,placeholder=null,scrollBefore=null,overflowBefore=null,calculationFocus=false;
  function syncPresentation(){
    const native=document.fullscreenElement===panel;
    $('bpvFullscreen').textContent=native?'Exit fullscreen':'Fullscreen';
    $('bpvFullscreen').setAttribute('aria-pressed',String(native));
    $('bpvLarge').setAttribute('aria-expanded',String(presentation));
    $('bpvLarge').hidden=presentation;$('bpvExit').hidden=!presentation;$('bpvPresentationReset').hidden=!presentation;
    $('bpvTextSizeLabel').hidden=!presentation;$('bpvFocus').hidden=!presentation;$('bpvPanHint').hidden=!presentation||calculationFocus;
  }
  function enterPresentation(){
    if(presentation)return;
    returnFocus=document.activeElement;scrollBefore=[window.scrollX,window.scrollY];
    overflowBefore=[document.documentElement.style.overflow,document.body.style.overflow];
    document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';
    placeholder=document.createComment('Network presentation returns here');panel.before(placeholder);dialog.append(panel);
    presentation=true;panel.classList.add('bpvPresenting');dialog.showModal();
    $('bpvViewStatus').hidden=false;$('bpvViewStatus').textContent='Large view. Escape or Exit large view returns to the lecture.';
    syncPresentation();$('bpvExit').focus({preventScroll:true});
  }
  function restorePresentation(){
    if(!presentation)return;
    presentation=false;panel.classList.remove('bpvPresenting');placeholder.replaceWith(panel);placeholder=null;
    document.documentElement.style.overflow=overflowBefore[0];document.body.style.overflow=overflowBefore[1];
    $('bpvViewStatus').hidden=true;syncPresentation();
    returnFocus?.focus({preventScroll:true});window.scrollTo(...scrollBefore);
  }
  async function exitPresentation(){
    if(document.fullscreenElement===panel){try{await document.exitFullscreen();}catch{}}
    if(dialog.open)dialog.close();restorePresentation();
  }
  async function fullscreen(){
    if(document.fullscreenElement===panel){try{await document.exitFullscreen();}catch{}syncPresentation();return;}
    enterPresentation();
    if(!panel.requestFullscreen){$('bpvViewStatus').textContent='Fullscreen is unavailable in this browser. Large presentation view is ready.';return;}
    try{await panel.requestFullscreen();$('bpvViewStatus').textContent='Fullscreen. Escape returns to large view; Exit large view returns to the lecture.';}
    catch{$('bpvViewStatus').textContent='Browser fullscreen is unavailable. Continue in this large presentation view, or use your browser’s fullscreen control.';}
    syncPresentation();
  }
  $('bpvLarge').onclick=enterPresentation;$('bpvFullscreen').onclick=fullscreen;$('bpvExit').onclick=exitPresentation;
  $('bpvPresentationReset').onclick=()=>document.getElementById('bpReset')?.click();
  $('bpvTextSize').oninput=event=>{
    const percent=Number(event.target.value);panel.style.setProperty('--bpvProjectorScale',String(percent/100));
    panel.classList.toggle('bpvExtraLarge',percent>=160);panel.classList.toggle('bpvWideParameters',percent>=130);
    $('bpvTextSizeValue').textContent=percent+'%';
  };
  $('bpvFocus').onclick=()=>{
    calculationFocus=!calculationFocus;panel.classList.toggle('bpvCalculationFocus',calculationFocus);
    $('bpvFocus').textContent=calculationFocus?'Show full network':'Focus calculation';
    $('bpvFocus').setAttribute('aria-pressed',String(calculationFocus));syncPresentation();
    panel.querySelector('.bpvPresenterBody').scrollTop=0;
    $('bpvViewStatus').textContent=calculationFocus?'Calculation focus: current equation and selected weight. Show full network restores the overview.':'Full network overview. Use Focus calculation to show the equation and weight changes at extra-large size.';
  };

  dialog.addEventListener('cancel',event=>{event.preventDefault();exitPresentation();});
  dialog.addEventListener('close',restorePresentation);
  document.addEventListener('fullscreenchange',()=>{syncPresentation();if(presentation&&!document.fullscreenElement)$('bpvViewStatus').textContent='Large view. Escape or Exit large view returns to the lecture.';});

  function snapshot(){return flowSnapshot(base,target,rate,phase,cycle);}
  function pause(){playing=false;clearTimeout(timer);timer=null;$('bpvPlay').textContent='Play training loop';}
  function schedule(){clearTimeout(timer);if(playing)timer=setTimeout(()=>{advance();schedule();},delay);}
  function advance(){if(phase===27){base=snapshot().candidate.updated;cycle++;phase=1;selected=0;}else phase++;if(phase>=10&&phase<=24)selected=phase-10;render();}
  function go(next){pause();phase=Math.max(0,Math.min(27,next));if(phase>=10&&phase<=24)selected=phase-10;render();}
  function render(){
    const weightsOpen=$('bpvWeights').querySelector('details')?.open??false;
    const state=snapshot(),{forward:f,gradients:g,candidate:update,rows}=state,newForward=phase>=26,shown=newForward?update.after:f,back=phase>=6&&phase<=9,active=phase<=5?Math.max(0,phase):phase===6?4:phase===7?3:phase===8?2:phase===9?1:phase>=10&&phase<=24?(selected<5?1:3):-1;
    const current=state.parameters;
    $('bpvKernelValues').innerHTML=current.kernel.map((line,u)=>'<tr>'+line.map((value,v)=>`<td aria-label="K[${u},${v}] = ${number(value)}" title="K[${u},${v}] = ${value}">${number(value)}</td>`).join('')+'</tr>').join('');
    $('bpvKernelBias').textContent=number(current.convBias);
    $('bpvDenseValues').innerHTML=current.dense.map((line,k)=>`<tr><th scope="row" title="Weights to class ${k?'B':'A'}">To ${k?'B':'A'}</th>${line.map((value,j)=>`<td data-dense-row="${k}" data-dense-column="${j}" aria-label="W[${k?'B':'A'},${j}] = ${number(value)}" title="W[${k?'B':'A'},${j}] = ${value}">${number(value)}</td>`).join('')}<td class="bpvClassBias" data-bias="${k}" aria-label="c${k?'B':'A'} = ${number(current.denseBias[k])}" title="Class ${k?'B':'A'} bias = ${current.denseBias[k]}">${number(current.denseBias[k])}</td></tr>`).join('');
    $('bpvKernelState').textContent=phase>=25?'Updated together · these weights feed the next forward pass':phase>=10?'Update preview · weights stay fixed until commit':'Weights used for this forward and backward pass';
    mount.dataset.phase=phase;mount.dataset.steps=state.steps;
    $('bpvProgress').value=phase;$('bpvCounter').textContent=`Step ${phase+1} / 28 · update ${cycle+1}`;$('bpvPrevious').disabled=phase===0;
    $('bpvPlay').textContent=playing?'Pause animation':'Play training loop';
    $('bpvDirection').className='bpvDirection '+(back?'backward':phase>=10&&phase<=25?'update':'forward');
    $('bpvDirection').textContent=back?'← BACKWARD: sensitivity flows from loss toward earlier layers':phase>=10&&phase<=24?'UPDATE PREVIEW: inspect −η × gradient; weights have not changed':phase===25?'OPTIMIZER: commit all fifteen saved-gradient proposals together':phase>=26?'↻ TRAINING LOOP: updated weights → new prediction → new loss':'FORWARD: image → features → scores → probabilities → loss →';
    const labels=['Image X','Convolution','ReLU / flatten','Dense classifier','Softmax','Loss L'],symbols=['3 × 3 input','Z = K ⋆ X + b','h = vec(max(0,Z))','s = Wh + c','p = softmax(s)','L = −log p[true]'];
    const content=[cells(IMAGE),phase>=1?`<b class="bpvOutputLabel">${phase===25?'Saved output Z':'Output Z'}</b>${cells(shown.z)}`:'<p class="bpvWaiting">Waiting for patch sums</p>',phase>=2?`<b class="bpvOutputLabel">Feature vector h · 4 × 1</b>${featureVector(shown.flat)}`:'<p class="bpvWaiting">Waiting for activation</p>',phase>=3?`<b class="bpvOutputLabel">${phase===25?'Saved logits s':'Output logits s'}</b>${cells(shown.logits)}`:'<p class="bpvWaiting">Waiting for scores</p>',phase>=4?shown.probabilities.map((p,k)=>`<label class="bpvProb">${k?'B':'A'} ${short(p*100)}%${k===target?' · true':''}<meter min="0" max="1" value="${p}"></meter></label>`).join(''):'<p class="bpvWaiting">Waiting for probabilities</p>',phase>=5?`<strong class="bpvLoss">${number(shown.loss)}</strong><p>True class ${target?'B':'A'}</p>`:'<p class="bpvWaiting">Waiting for loss</p>'];
    const gradients=[phase>=9?['∂L/∂X sign map',cells(g.input,true,true)]:null,phase>=9?['∂L/∂K',cells(g.kernel,true)]:null,phase>=8?['∂L/∂Z',cells(g.dZ,true)]:null,phase>=7?['∂L/∂h',featureVector(g.dFlat,true)]:null,phase>=6?['∂L/∂s = p − y',cells(g.dLogits,true)]:null,phase>=6?['∂L/∂L = 1','<strong>Start here: 1</strong>']:null];
    $('bpvNetwork').className=`bpvNetwork ${back?'isBackward':'isForward'} ${playing&&!reduced.matches&&(phase<=9||phase===26)?'isMoving':''}`;
    $('bpvNetwork').innerHTML=labels.map((label,i)=>`<article class="bpvNode ${i===active?'isActive':''} ${phase>=25?'isUpdated':''}"><h4>${label}</h4><p class="bpvDesignChoice">${['Input choice','Convolution choice','Activation choice','Score function choice','Output function choice','Loss function choice'][i]}<br><span>${['A 3 × 3 grayscale image here; other models can use larger images, color or video.','One 2 × 2 filter, stride 1, no padding here; filter sizes, counts and layers can vary.','ReLU here; other networks may use different activations. Flatten only rearranges values.','Linear scores Wh + c here; other models can use a different scoring head.','Softmax here for one of two classes; independent labels often use sigmoid.','Cross-entropy here; choose a loss suited to the task and output.'][i]}</span></p><div class="bpvSymbol">${symbols[i]}</div><div class="bpvValues">${content[i]}</div>${gradients[i]&&phase<=25?`<div class="bpvGradient"><b>${renderMathText(gradients[i][0])}</b>${gradients[i][1]}</div>`:''}${i<5?`<span class="bpvEdge ${back?'edgeBack':''}" aria-hidden="true">${back?'←':'→'}</span>`:''}</article>`).join('');
    const stories=[
      ['Start with fixed weights','Follow the default labeled example, or change the label and learning rate in the detailed calculation. Nothing changes until we finish the backward pass and apply an update.','Forward → loss → backward → simultaneous update → fresh forward'],
      ['One filter, four patches','The same four kernel weights are used at all four output positions. Save these input values for their gradients later.',`Z[0,0] = ${short(base.convBias)} + ${short(base.kernel[0][0])}×1 + ${short(base.kernel[0][1])}×0 + ${short(base.kernel[1][0])}×0 + ${short(base.kernel[1][1])}×3 = ${number(f.z[0][0])}`],
      ['ReLU keeps positive values','Each positive pre-activation passes through. A nonpositive value becomes zero; that gate will block its backward gradient. Flatten only changes the arrangement.',`h = ${vector(f.flat)}`],
      ['Every feature contributes to each score','Rows of W are output classes; columns are input features. Each score is a dot product plus its bias.',`s = Wh + c = ${vector(f.logits)}`],
      ['Softmax compares the scores','Exponentiate shifted scores, then divide by their sum. The two probabilities add to one.',`p = ${vector(f.probabilities)}`],
      ['The label turns a prediction into a loss','The loss penalizes low probability for the true class. All forward values are now saved for differentiation.',`L = −log(${number(f.probabilities[target])}) = ${number(f.loss)}`],
      ['Begin at the loss and move backward','Softmax plus cross-entropy gives a particularly simple score gradient. Positive means increasing that score would increase this loss.',`∂L/∂s = p − y = ${vector(g.dLogits)}`],
      ['Split the gradient at the dense layer','One branch computes weight/bias gradients. Another passes sensitivity back to the input features. Use the unchanged forward-pass weights.',`∂L/∂W[k,j] = (∂L/∂s[k]) h[j];   ∂L/∂h = Wᵀ(∂L/∂s) = ${vector(g.dFlat)}`],
      ['Pass backward through each ReLU gate','Reshape the feature gradient to 2 × 2. Multiply by 1 for a positive saved Z and by 0 otherwise. No weight has changed yet.',`∂L/∂Z = reshape(∂L/∂h) ⊙ 1[Z > 0]`],
      ['Add the four uses of a shared weight','K[0,0] was used in four patches. Add every local gradient × input contribution. Overlapping input gradients also add.',`∂L/∂K[0,0] = ${g.contributions[0][0].map(signed).join(' + ')} = ${number(g.kernel[0][0])}`]
    ];
    let story=stories[phase];
    if(phase>=10&&phase<=24){const row=rows[selected];story=[`Inspect ${row.name}: ${row.gradient>0?'decrease':row.gradient<0?'increase':'keep'} this parameter`,'This is a preview of one parameter’s proposed update. Every proposal uses the same saved forward pass. All fifteen proposals will be committed together.',`${row.name}: ${number(row.value)} − ${number(rate)} × (${signed(row.gradient)}) = ${number(row.next)}`];}
    if(phase===25)story=['Commit all fifteen updates together','Now replace all weights and biases with their proposed values. The gradients were all computed before any weight changed.','θ⁽ᵗ⁺¹⁾ = θ⁽ᵗ⁾ − η ∇θL(θ⁽ᵗ⁾)'];
    if(phase===26)story=['Send the same image forward again','The diagram now shows a fresh forward pass using updated weights. The image and true label stay the same; the prediction and loss can change.',`L before ${number(update.beforeLoss)} → L after ${number(update.afterLoss)}`];
    if(phase===27)story=['Close the learning loop','The next step starts a new forward/backward cycle from these updated weights. This repeats the same teaching image; it is not a test of accuracy on new images.',`Update ${cycle+1}: ${number(update.beforeLoss)} → ${number(update.afterLoss)}`];
    $('bpvStep').textContent=phase<=5?'FORWARD PASS':phase<=9?'BACKWARD PASS':phase<=24?'PARAMETER UPDATE PREVIEW':phase===25?'OPTIMIZER STEP':'FRESH FORWARD / FEEDBACK';
    $('bpvTitle').textContent=story[0];$('bpvExplanation').textContent=story[1];$('bpvFormula').innerHTML=phase===3?scoreFormula(base,f):phase===4?softmaxFormula(base,f):renderMathText(story[2]);
    $('bpvWeights').hidden=phase<7;
    if(phase>=7){const row=rows[selected];$('bpvWeights').innerHTML=`<div class="bpvWeightHeader"><h4>Follow one weight</h4><label>Parameter <select id="bpvParameter">${rows.map((r,i)=>`<option value="${i}" ${i===selected?'selected':''}>${r.name}</option>`).join('')}</select></label></div><div class="bpvWeightFocus"><div><span>Saved value</span><strong>${number(row.value)}</strong></div><div class="${tone(row.gradient)}"><span class="bpvWeightGradientLabel">Loss gradient ${derivative(row.name)}</span><strong>${signed(row.gradient)}</strong><span>Δ = −ηg = ${signed(row.delta)}</span></div><div><span>${phase>=25?'Committed value':'Proposed value'}</span><strong>${number(row.next)}</strong></div></div>${row.kind==='kernel'?`<div class="bpvContributions"><p>${row.name} is shared across four output positions. Add gradient × the input read at each use:</p><div class="bpvUses">${g.contributions[row.u][row.v].map((value,i)=>{const r=Math.floor(i/2),c=i%2;return `<div><b>Output (${r},${c})</b><span>${signed(g.dZ[r][c])} × ${number(IMAGE[r+row.u][c+row.v])}</span><strong class="${tone(value)}">= ${signed(value)}</strong></div>`;}).join('')}</div><strong>Sum ${derivative(row.name)} = ${signed(row.gradient)}</strong></div>`:''}<details><summary>All 15 parameters: saved value, gradient, change and next value</summary><div class="bpvTableScroll"><table><thead><tr><th>Parameter</th><th>Saved</th><th>Gradient</th><th>Δ = −ηg</th><th>${phase>=25?'Committed':'Proposed'}</th></tr></thead><tbody>${rows.map((r,i)=>`<tr ${selected===i?'class="isSelected"':''}><th><button type="button" data-weight="${i}" aria-pressed="${selected===i}">${r.name}</button></th><td>${number(r.value)}</td><td class="${tone(r.gradient)}">${signed(r.gradient)}</td><td class="${tone(r.delta)}">${signed(r.delta)}</td><td>${number(r.next)}</td></tr>`).join('')}</tbody></table></div></details>`;
      $('bpvWeights').querySelector('details').open=weightsOpen;
      $('bpvParameter').onchange=event=>{selected=Number(event.target.value);if(phase>=10&&phase<=24)phase=10+selected;render();};
      $('bpvWeights').querySelectorAll('[data-weight]').forEach(button=>button.onclick=()=>{selected=Number(button.dataset.weight);if(phase>=10&&phase<=24)phase=10+selected;render();});
    }
    $('bpvFeedback').hidden=phase<26;
    if(phase>=26)$('bpvFeedback').innerHTML=`<h4>What the next forward pass sees</h4><div class="bpvCompare"><div><span>Before update</span><strong>Loss ${number(update.beforeLoss)}</strong><p>True-class probability ${(f.probabilities[target]*100).toFixed(2)}%</p></div><span class="bpvLoopArrow" aria-hidden="true">↻</span><div><span>After update · same image</span><strong>Loss ${number(update.afterLoss)}</strong><p>True-class probability ${(update.after.probabilities[target]*100).toFixed(2)}%</p></div></div><p>${update.afterLoss<update.beforeLoss?'This step lowered this example’s loss.':'This step did not lower the loss; the step size may overshoot.'} A fresh backward pass must use the new activations and weights.</p>`;
    $('bpvPlay').disabled=Boolean(invalidMessage);$('bpvNext').disabled=Boolean(invalidMessage);$('bpvPrevious').disabled=phase===0||Boolean(invalidMessage);
    onChange?.(state);
  }
  $('bpvPlay').onclick=()=>{if(playing)pause();else{playing=true;schedule();}render();};
  $('bpvNext').onclick=()=>{pause();advance();};$('bpvPrevious').onclick=()=>go(phase-1);
  $('bpvSpeed').oninput=event=>{delay=Number(event.target.value);$('bpvSpeedValue').textContent=(delay/1000).toFixed(1)+' s';schedule();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing){pause();render();}});
  return {start(){render();},snapshot,setInvalid(message){pause();invalidMessage=message;$('bpvPlay').disabled=$('bpvNext').disabled=$('bpvPrevious').disabled=true;$('bpvNetwork').classList.remove('isMoving');$('bpvTitle').textContent='Fix the control value to continue';$('bpvExplanation').textContent=message;$('bpvFormula').textContent='The diagram is paused at the last valid inputs.';},reset(parameters=initialParameters(),newTarget=1,newRate=.1){pause();invalidMessage=null;base=parameters;target=newTarget;rate=newRate;phase=0;cycle=0;selected=0;render();},configure(parameters,newTarget,newRate){pause();invalidMessage=null;cycle=snapshot().steps;base=parameters;target=newTarget;rate=newRate;phase=0;selected=0;render();},forward(){go(phase>=25?27:5);if(phase===27){advance();go(5);}},backward(){go(9);},update(){go(25);},pause};
}
