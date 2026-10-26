export function drawFinger(ctx,value,history=[]){
  const w=ctx.canvas.width,h=ctx.canvas.height;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#e1f3ed';ctx.fillRect(0,0,w,h);
  if(value===null){ctx.fillStyle='#537077';ctx.font='18px Arial';ctx.textAlign='center';ctx.fillText('No tracking',w/2,95);return;}
  const curl=1-Math.max(0,Math.min(1,(value-.28)/.72));
  let x=w/2-20,y=145;
  ctx.beginPath();ctx.moveTo(x,y);
  [0,curl*1.8,curl*2.6].forEach(angle=>{x+=Math.sin(angle)*34;y-=Math.cos(angle)*34;ctx.lineTo(x,y);});
  ctx.strokeStyle='#b47c52';ctx.lineWidth=25;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();ctx.strokeStyle='#efbf92';ctx.lineWidth=20;ctx.stroke();
  ctx.strokeStyle='#087e80';ctx.lineWidth=3;ctx.beginPath();
  history.forEach((v,i)=>{const px=12+i/Math.max(1,history.length-1)*(w-24),py=h-12-v*30;i?ctx.lineTo(px,py):ctx.moveTo(px,py);});ctx.stroke();
}
