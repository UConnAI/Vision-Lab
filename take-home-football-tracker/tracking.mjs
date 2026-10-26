// The CNN supplies detections. Association and interpolation are application code.
export function chooseBall(objects,previous,threshold=.35){
  const candidates=objects.filter(o=>o.class==='sports ball'&&o.score>=threshold&&o.bbox.every(Number.isFinite)&&o.bbox[2]>0&&o.bbox[3]>0).map(o=>({...o,x:o.bbox[0]+o.bbox[2]/2,y:o.bbox[1]+o.bbox[3]/2,r:Math.max(o.bbox[2],o.bbox[3])*.55}));
  if(!candidates.length)return null;
  // Start at the largest ball; subsequently prefer nearby detections.
  candidates.sort((a,b)=>previous?Math.hypot(a.x-previous.x,a.y-previous.y)-Math.hypot(b.x-previous.x,b.y-previous.y):b.bbox[2]*b.bbox[3]-a.bbox[2]*a.bbox[3]);
  return candidates[0];
}
export function trajectory(rows,threshold,smoothing=0){let previous=null;return rows.map(row=>{const point=chooseBall(row.objects,previous,threshold);if(!point){previous=null;return {t:row.t,point:null};}if(previous&&smoothing){point.x=previous.x*smoothing+point.x*(1-smoothing);point.y=previous.y*smoothing+point.y*(1-smoothing);}previous=point;return {t:row.t,point};});}
export function pointAt(rows,t){
  if(!rows.length)return null;
  const index=rows.findIndex(row=>row.t>t),left=index<0?rows.at(-1):rows[index-1],right=index<0?null:rows[index];
  if(left?.point&&Math.abs(t-left.t)<.0001)return {...left.point,kind:'detected'};
  if(left?.point&&!right&&t>=left.t&&t-left.t<.101)return {...left.point,kind:'held'};
  if(left?.point&&right?.point&&right.t-left.t<=.3&&t>=left.t){const f=(t-left.t)/(right.t-left.t);return {...left.point,x:left.point.x+(right.point.x-left.point.x)*f,y:left.point.y+(right.point.y-left.point.y)*f,r:left.point.r+(right.point.r-left.point.r)*f,kind:'interpolated'};}
  // Never bridge a missing detection or invent a path through an occlusion.
  return null;
}
export function annotationMetrics(labels,rows,diagonal){let detected=0,error=0,falsePositives=0,visible=0;for(const label of labels){const row=rows.find(r=>Math.abs(r.t-label.t)<.025);if(label.visible===false){if(row?.point)falsePositives++;continue;}visible++;if(row?.point){detected++;error+=Math.hypot(label.x-row.point.x,label.y-row.point.y)/diagonal;}}return {labeled:labels.length,detected,missed:visible-detected,falsePositives,meanError:detected?error/detected:null};}
