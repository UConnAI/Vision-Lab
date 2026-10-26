// Vector artwork driven by the same artificial finger values as the predictor.
export function cartoonPoints(v){
  const p=Array.from({length:21},()=>({x:0.5,y:0.7,z:0}));
  const set=(i,x,y)=>p[i]={x:x/640,y:y/480,z:0};
  set(0,320,420);[[235,380],[210,337],[230,318],[255,335]].forEach(([x,y],i)=>set(i+1,x,y));
  const bases=[263,313,363,409],lengths=[0.9,1,0.88,0.72];
  [5,9,13,17].forEach((n,i)=>{
    const open=Math.max(0,Math.min(1,(v[i]-0.28)/0.72)),x=bases[i],l=lengths[i];
    set(n,x,275);set(n+1,x+(1-open)*8,275-l*(32+75*open));
    set(n+2,x+(1-open)*17,275+l*(5-165*open));set(n+3,x+(1-open)*5,275+l*(32-232*open));
  });return p;
}
export function drawCartoon(ctx,v,annotate=false,title=null){
  const p=cartoonPoints(v), xy=n=>[p[n].x*640,p[n].y*480];
  ctx.clearRect(0,0,640,480);ctx.fillStyle='#142d32';ctx.fillRect(0,0,640,480);
  ctx.fillStyle='#e7b890';ctx.strokeStyle='#9a6246';ctx.lineWidth=4;
  ctx.beginPath();ctx.roundRect(271,357,102,97,22);ctx.fill();ctx.stroke();
  ctx.fillStyle='#a9a3ed';ctx.fillRect(268,426,108,29);
  ctx.fillStyle='#e7b890';ctx.beginPath();ctx.roundRect(233,245,205,150,[32,35,55,55]);ctx.fill();ctx.stroke();
  [[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]].forEach(chain=>{
    ctx.lineCap='round';ctx.lineJoin='round';
    for(const [color,width] of [['#9a6246',39],['#e7b890',32]]){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();chain.forEach((n,i)=>i?ctx.lineTo(...xy(n)):ctx.moveTo(...xy(n)));ctx.stroke();}
    ctx.strokeStyle='#bf8865';ctx.lineWidth=3;
    chain.slice(1,3).forEach(n=>{const [x,y]=xy(n);ctx.beginPath();ctx.moveTo(x-8,y);ctx.lineTo(x+8,y);ctx.stroke();});
  });
  ctx.strokeStyle='#bf8865';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(263,335);ctx.quadraticCurveTo(315,310,389,333);ctx.stroke();
  if(annotate){
    ctx.strokeStyle='#96e3cb';ctx.lineWidth=3;
    [[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]].forEach(chain=>{ctx.beginPath();chain.forEach((n,i)=>i?ctx.lineTo(...xy(n)):ctx.moveTo(...xy(n)));ctx.stroke();});
    ctx.fillStyle='white';p.forEach((_,n)=>{ctx.beginPath();ctx.arc(...xy(n),4,0,Math.PI*2);ctx.fill();});
  }
  ctx.fillStyle='#d9f2e9';ctx.font='bold 18px Arial';ctx.textAlign='center';ctx.fillText(title||(annotate?'ARTIFICIAL HAND + LANDMARKS':'CARTOON PLAYER · artificial movement'),320,32);ctx.textAlign='left';
}
