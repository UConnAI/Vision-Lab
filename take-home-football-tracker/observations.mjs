// Keep CNN confidence filtering separate from the appearance tracker's quality.
export function observationRows(rows,threshold,useAppearance=true){
  return rows.map(row=>{
    const cnn=row.objects.filter(object=>object.class==='sports ball'&&object.score>=threshold&&Array.isArray(object.bbox)&&object.bbox.length===4&&object.bbox.every(Number.isFinite)&&object.bbox[2]>0&&object.bbox[3]>0).map(object=>({...object,source:'cnn'}));
    const objects=cnn.length?cnn:useAppearance&&row.appearance?[row.appearance]:[];
    return {t:row.t,objects};
  });
}
export function coverageCounts(track){
  const cnn=track.filter(row=>row.point?.source==='cnn').length,appearance=track.filter(row=>row.point?.source==='appearance').length;
  return {cnn,appearance,missing:track.length-cnn-appearance,total:track.length};
}
