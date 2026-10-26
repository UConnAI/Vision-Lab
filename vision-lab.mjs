// Small, inspectable CNN operations: stride 1, no padding, no bias.
export function convolve(image,kernel){
  return Array.from({length:image.length-2},(_,y)=>Array.from({length:image[0].length-2},(_,x)=>kernel.reduce((sum,row,dy)=>sum+row.reduce((s,w,dx)=>s+w*image[y+dy][x+dx],0),0)));
}
export function relu(image){return image.map(row=>row.map(v=>Math.max(0,v)));}
export function pool(image){return Array.from({length:Math.floor(image.length/2)},(_,y)=>Array.from({length:Math.floor(image[0].length/2)},(_,x)=>Math.max(...image.slice(y*2,y*2+2).flatMap(row=>row.slice(x*2,x*2+2)))));}
export function pinchRatio(points){const distance=(a,b)=>Math.hypot(points[a].x-points[b].x,points[a].y-points[b].y);return distance(4,8)/Math.max(distance(5,17),0.001);}
// Hold a confidently recognized palm briefly to avoid erasing while lifting the pen.
export function cameraBrush(gesture,score,pinch,time,palmSince=null){
  if(pinch)return {tool:'pen',down:true,palmSince:null};
  if(gesture==='Open_Palm'&&score>=0.6){const since=palmSince??time;return {tool:'eraser',down:time-since>=350,palmSince:since};}
  return {tool:'pen',down:false,palmSince:null};
}
