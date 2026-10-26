export function seededMoves(seed=314){let state=seed>>>0;return()=>{state=(1664525*state+1013904223)>>>0;return ['rock','paper','scissors'][Math.floor(state/4294967296*3)];};}
export function stableGesture(previous,move,time,holdMs){
 if(!['rock','paper','scissors'].includes(move))return {move:null,since:time,last:time,progress:0,locked:false};
 const since=previous?.move===move&&time-previous.last<=200?previous.since:time;
 const progress=Math.min(1,(time-since)/holdMs);
 return {move,since,last:time,progress,locked:progress>=1};
}
