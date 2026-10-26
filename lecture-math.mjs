export function convolutionShape(n, kernel, stride, padding, inputChannels, filters) {
  if (![n,kernel,stride,inputChannels,filters].every(v=>Number.isInteger(v)&&v>0)||!Number.isInteger(padding)||padding<0) throw new Error('Use positive whole sizes and nonnegative padding.');
  const output = Math.floor((n+2*padding-kernel)/stride)+1;
  if(output<1) throw new Error('The kernel does not fit this padded image.');
  return {output,parameters:(kernel*kernel*inputChannels+1)*filters,activations:output*output*filters};
}
export function smoothPositions(values,alpha) {
  if(!Number.isFinite(alpha)||alpha<0||alpha>=1)throw new Error('Smoothing must be between 0 and 1.');
  let previous=null;
  return values.map(value=>previous=previous===null?value:alpha*previous+(1-alpha)*value);
}
export function intersectionOverUnion(a,b) {
  if([...a,...b].some(v=>!Number.isFinite(v))||a[2]<=0||a[3]<=0||b[2]<=0||b[3]<=0)return 0;
  const intersection=Math.max(0,Math.min(a[0]+a[2],b[0]+b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[1]+a[3],b[1]+b[3])-Math.max(a[1],b[1]));
  return intersection/(a[2]*a[3]+b[2]*b[3]-intersection);
}
