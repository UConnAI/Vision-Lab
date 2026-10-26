export const LABELS = ['rock', 'paper', 'scissors'];
export function fingerMovement(samples,cutoff=Infinity){
  const observed=samples.filter(s=>s.t<=cutoff);
  if(observed.length<2)return {names:[],available:false};
  const names=['Index','Middle','Ring','Little'].filter((_,i)=>{
    const values=observed.map(s=>s.v[i]);return Math.max(...values)-Math.min(...values)>=.12;
  });
  return {names,available:true};
}
export function pretrainedGesture(category){return category?.score>=0.5?({Closed_Fist:'rock',Open_Palm:'paper',Victory:'scissors'}[category.categoryName]||'unclear'):'unclear';}
export function demoRows(lead=300,movementMs=null){
  const duration=movementMs===null?3000:600+movementMs;
  return LABELS.flatMap(label=>[0,1,2].map(i=>({source:'simulation',label,x:features(Array.from({length:Math.floor(duration/16)+1},(_,j)=>({t:j*16,v:movementMs===null?simulated(j*16,label,false,i):pacedMotion(j*16,label,false,i,movementMs)})),duration-lead),lead,movementMs,example:true})));
}
export function pacedMotion(t,label,late=false,variation=0,movementMs=700){
  return simulated(t<600?0:2050+(t-600)*950/movementMs,label,late,variation);
}
export const counter = x => ({rock:'paper', paper:'scissors', scissors:'rock'})[x];
export const outcome = (bot, human) => bot === human ? 'Tie' : counter(human) === bot ? 'Computer wins' : 'You win';
export function currentGesture(v) {
  const open=v.map(x=>x>=0.8), curled=v.map(x=>x<0.65);
  if(curled.every(Boolean))return 'rock';
  if(open.every(Boolean))return 'paper';
  if(open[0]&&open[1]&&curled[2]&&curled[3])return 'scissors';
  return 'unclear';
}
export function openness(p) {
  // Straightness: endpoint distance / length of the three finger segments.
  const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));
  return [5,9,13,17].map(i => {
    const length = dist(p[i],p[i+1])+dist(p[i+1],p[i+2])+dist(p[i+2],p[i+3]);
    return length > 0 ? Math.max(0,Math.min(1,dist(p[i],p[i+3])/length)) : 0;
  });
}
export function features(samples, cutoff) {
  const s = samples.filter(x => x.t <= cutoff && x.t >= cutoff-450);
  if (s.length < 4 || cutoff-s.at(-1).t > 150 || s.at(-1).t-s[0].t < 100) return null;
  const a=s[0], b=s.at(-1), dt=(b.t-a.t)/1000;
  return [...b.v, ...b.v.map((v,i) => (v-a.v[i])/dt)];
}
export function train(rows) {
  if (LABELS.some(l => rows.filter(r=>r.label===l).length < 3)) return null;
  const mean=Array(8).fill(0), scale=Array(8).fill(0);
  rows.forEach(r=>r.x.forEach((v,i)=>mean[i]+=v/rows.length));
  rows.forEach(r=>r.x.forEach((v,i)=>scale[i]+=(v-mean[i])**2/rows.length));
  scale.forEach((v,i)=>scale[i]=Math.max(Math.sqrt(v),0.05));
  const centers=LABELS.map(label => {
    const group=rows.filter(r=>r.label===label);
    return mean.map((_,i)=>group.reduce((sum,r)=>sum+(r.x[i]-mean[i])/scale[i],0)/group.length);
  });
  const counts=LABELS.map(l=>rows.filter(r=>r.label===l).length);
  return {mean,scale,centers, majority:LABELS[counts.indexOf(Math.max(...counts))],count:rows.length};
}
export function predict(model,x) {
  if(!model || !x) return null;
  const z=x.map((v,i)=>(v-model.mean[i])/model.scale[i]);
  const d=model.centers.map(c=>c.reduce((s,v,i)=>s+(v-z[i])**2,0));
  return {label:LABELS[d.indexOf(Math.min(...d))], distances:d};
}
export function evaluate(rows) {
  const valid=rows.filter(r=>r.guess);
  const matrix=LABELS.map(a=>LABELS.map(p=>valid.filter(r=>r.label===a && r.guess===p).length));
  return {n:valid.length, correct:valid.filter(r=>r.guess===r.label).length,
    baseline:valid.filter(r=>r.baseline===r.label).length, matrix};
}
// Deliberately simple artificial motion, for workflow teaching only.
export function simulated(t,label,late=false,variation=0) {
  const target={rock:[0.27,0.29,0.28,0.3],paper:[1,1,1,1],scissors:[1,1,0.28,0.3]}[label];
  const progress=Math.max(0,Math.min(1,(t-(late?2920:2050))/(late?80:850)));
  return target.map((v,i)=>Math.max(0,Math.min(1,0.28+(v-0.28)*progress+0.012*Math.sin(t/180+i+variation))));
}
