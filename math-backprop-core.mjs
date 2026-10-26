// A deliberately tiny CNN: shared 2x2 convolution, ReLU, flatten, dense softmax.
// All constants are explicit. No random draw or external model is involved.
export const IMAGE=[[1,0,2],[0,3,1],[2,1,0]];
export function initialParameters(){return {kernel:[[.2,-.1],[.1,.3]],convBias:.1,dense:[[.3,-.2,.1,.4],[-.1,.2,.3,-.2]],denseBias:[.05,-.05]};}
const copy=value=>JSON.parse(JSON.stringify(value));
function validate(parameters,target){
  if(!Number.isInteger(target)||target<0||target>1)throw new Error('Choose class A or B.');
  if(parameters.kernel?.length!==2||parameters.kernel.some(row=>row.length!==2)||parameters.dense?.length!==2||parameters.dense.some(row=>row.length!==4)||parameters.denseBias?.length!==2)throw new Error('The teaching network needs a 2x2 kernel and 2x4 dense matrix.');
  const values=[...parameters.kernel.flat(),parameters.convBias,...parameters.dense.flat(),...parameters.denseBias];
  if(values.some(value=>!Number.isFinite(value)||Math.abs(value)>1e6))throw new Error('Weights must be finite and have magnitude at most one million.');
}
export function stableSoftmax(logits){
  if(!logits.length||logits.some(value=>!Number.isFinite(value)))throw new Error('Logits must be finite.');
  const maximum=Math.max(...logits),exponentials=logits.map(value=>Math.exp(value-maximum)),sum=exponentials.reduce((a,b)=>a+b,0);
  return exponentials.map(value=>value/sum);
}
export function forwardPass(parameters=initialParameters(),target=1){
  validate(parameters,target);
  const z=Array.from({length:2},(_,row)=>Array.from({length:2},(_,column)=>parameters.convBias+parameters.kernel.reduce((sum,line,u)=>sum+line.reduce((s,weight,v)=>s+weight*IMAGE[row+u][column+v],0),0)));
  const activations=z.map(row=>row.map(value=>Math.max(0,value))),flat=activations.flat();
  const logits=parameters.dense.map((weights,k)=>parameters.denseBias[k]+weights.reduce((sum,weight,j)=>sum+weight*flat[j],0));
  const probabilities=stableSoftmax(logits),maximum=Math.max(...logits);
  // log-sum-exp avoids log(0) when a very small softmax score underflows.
  const loss=maximum+Math.log(logits.reduce((sum,value)=>sum+Math.exp(value-maximum),0))-logits[target];
  return {z,activations,flat,logits,probabilities,loss,target};
}
export function backwardPass(parameters=initialParameters(),target=1){
  const forward=forwardPass(parameters,target);
  const dLogits=forward.probabilities.map((value,k)=>value-Number(k===target));
  const dense=parameters.dense.map((_,k)=>forward.flat.map(value=>dLogits[k]*value));
  const dFlat=forward.flat.map((_,j)=>parameters.dense.reduce((sum,weights,k)=>sum+weights[j]*dLogits[k],0));
  // ReLU's derivative convention at exactly zero is 0.
  const dZ=forward.z.map((row,r)=>row.map((value,c)=>value>0?dFlat[r*2+c]:0));
  const contributions=parameters.kernel.map((row,u)=>row.map((_,v)=>dZ.flatMap((line,r)=>line.map((gradient,c)=>gradient*IMAGE[r+u][c+v]))));
  const kernel=contributions.map(row=>row.map(terms=>terms.reduce((sum,value)=>sum+value,0)));
  const input=IMAGE.map(row=>row.map(()=>0));
  for(let r=0;r<2;r++)for(let c=0;c<2;c++)for(let u=0;u<2;u++)for(let v=0;v<2;v++)input[r+u][c+v]+=dZ[r][c]*parameters.kernel[u][v];
  return {forward,dLogits,dense,denseBias:[...dLogits],dFlat,dZ,kernel,convBias:dZ.flat().reduce((sum,value)=>sum+value,0),contributions,input};
}
export function sgdStep(parameters,target,learningRate){
  if(!Number.isFinite(learningRate)||learningRate<=0||learningRate>1)throw new Error('Choose a learning rate greater than 0 and at most 1.');
  const gradients=backwardPass(parameters,target),updated={
    kernel:parameters.kernel.map((row,u)=>row.map((value,v)=>value-learningRate*gradients.kernel[u][v])),
    convBias:parameters.convBias-learningRate*gradients.convBias,
    dense:parameters.dense.map((row,k)=>row.map((value,j)=>value-learningRate*gradients.dense[k][j])),
    denseBias:parameters.denseBias.map((value,k)=>value-learningRate*gradients.denseBias[k])
  };
  const after=forwardPass(updated,target);
  return {before:copy(parameters),updated,gradients,beforeLoss:gradients.forward.loss,afterLoss:after.loss,after,learningRate};
}
export function gradientCheck(parameters=initialParameters(),target=1,epsilon=1e-5){
  if(!Number.isFinite(epsilon)||epsilon<=0||epsilon>.01)throw new Error('Use a small positive gradient-check step.');
  const analytical=backwardPass(parameters,target),entries=[];
  function check(name,path,gradient){
    const plus=copy(parameters),minus=copy(parameters);
    function change(object,delta){let owner=object;for(const key of path.slice(0,-1))owner=owner[key];owner[path.at(-1)]+=delta;}
    change(plus,epsilon);change(minus,-epsilon);
    const numerical=(forwardPass(plus,target).loss-forwardPass(minus,target).loss)/(2*epsilon);
    entries.push({name,analytical:gradient,numerical,absoluteError:Math.abs(gradient-numerical),scaledError:Math.abs(gradient-numerical)/Math.max(1,Math.abs(gradient),Math.abs(numerical))});
  }
  for(let u=0;u<2;u++)for(let v=0;v<2;v++)check(`K[${u},${v}]`,['kernel',u,v],analytical.kernel[u][v]);
  check('conv bias',['convBias'],analytical.convBias);
  for(let k=0;k<2;k++)for(let j=0;j<4;j++)check(`W[${k},${j}]`,['dense',k,j],analytical.dense[k][j]);
  for(let k=0;k<2;k++)check(`dense bias[${k}]`,['denseBias',k],analytical.denseBias[k]);
  return {entries,maxAbsoluteError:Math.max(...entries.map(row=>row.absoluteError)),nearReluKink:analytical.forward.z.flat().some(value=>Math.abs(value)<epsilon*20)};
}
