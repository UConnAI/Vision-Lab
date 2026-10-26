function finite(values){if(!values.every(Number.isFinite))throw new Error('All values must be finite numbers.');}
export function stableSoftmax(logits){finite(logits);if(!logits.length)throw new Error('Supply at least one logit.');const maximum=Math.max(...logits),exp=logits.map(value=>Math.exp(value-maximum)),sum=exp.reduce((a,b)=>a+b,0);return exp.map(value=>value/sum);}
export function classificationTrace(logits,target){
  if(!Number.isInteger(target)||target<0||target>=logits.length)throw new Error('Choose a valid true class.');
  const probabilities=stableSoftmax(logits),maximum=Math.max(...logits),shifted=logits.map(z=>z-maximum),logSum=Math.log(shifted.reduce((sum,z)=>sum+Math.exp(z),0));
  return {shifted,probabilities,loss:logSum-shifted[target],gradient:probabilities.map((p,i)=>p-Number(i===target)),jacobian:probabilities.map((p,i)=>probabilities.map((q,j)=>p*(Number(i===j)-q)))};
}
export function convolutionTrace(image,kernel,bias=0,row=0,column=0,relu=false){
  finite([...image.flat(),...kernel.flat(),bias]);const h=image.length,w=image[0]?.length,k=kernel.length;
  if(!h||!w||!k||image.some(r=>r.length!==w)||kernel.some(r=>r.length!==k)||h<k||w<k)throw new Error('Use a rectangular image and a fitting square kernel.');
  const height=h-k+1,width=w-k+1;if(!Number.isInteger(row)||!Number.isInteger(column)||row<0||column<0||row>=height||column>=width)throw new Error('Selected patch is outside the image.');
  const output=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>{const z=bias+kernel.reduce((sum,line,dy)=>sum+line.reduce((part,weight,dx)=>part+weight*image[y+dy][x+dx],0),0);return relu?Math.max(0,z):z;}));
  const terms=kernel.flatMap((line,dy)=>line.map((weight,dx)=>({dy,dx,pixel:image[row+dy][column+dx],weight,product:weight*image[row+dy][column+dx]}))),sum=terms.reduce((total,term)=>total+term.product,0),z=sum+bias;
  return {output,terms,sum,z,activation:relu?Math.max(0,z):z};
}
