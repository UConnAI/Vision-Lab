export const MASK_FILTERS={vertical:[[-1,0,1],[-2,0,2],[-1,0,1]],horizontal:[[-1,-2,-1],[0,0,0],[1,2,1]],outline:[[0,-1,0],[-1,4,-1],[0,-1,0]]};
export function maskStrength(score,kernel){const scale=kernel.flat().reduce((s,w)=>s+Math.abs(w),0);return scale===0?0:Math.abs(score)/scale;}
export function outputPixel(row,column){return {x:column+1,y:row+1};}
export function inspectMaskPatch(image,kernel,row,column){
 if(row<0||column<0||row>image.length-3||column>image[0].length-3)throw Error('The full 3 × 3 patch must fit.');
 const terms=kernel.flatMap((values,dy)=>values.map((weight,dx)=>({pixel:image[row+dy][column+dx],weight,product:image[row+dy][column+dx]*weight})));
 return {terms,score:terms.reduce((s,t)=>s+t.product,0)};
}
