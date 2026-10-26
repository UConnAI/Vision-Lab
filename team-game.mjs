export function createMatch(teams=2,rounds=3){return {teams,rounds,turn:0,scores:Array(teams).fill(0),phase:'ready',remaining:60,awarded:false};}
export function finishTurn(match,correct){
  if(!['playing','paused'].includes(match.phase))return false;
  if(correct&&!match.awarded){match.scores[match.turn%match.teams]++;match.awarded=true;}
  match.phase='finished';return true;
}
export function nextTurn(match){
  if(match.phase!=='finished')return false;
  match.turn++;match.phase=match.turn>=match.teams*match.rounds?'complete':'ready';match.awarded=false;return true;
}
export function matchResult(match){if(match.teams===1){const goal=Math.ceil(match.rounds*2/3);return `Together: ${match.scores[0]}/${match.rounds} guessed · ${match.scores[0]>=goal?'crew goal reached!':`try again to reach ${goal}!`}`;}const top=Math.max(...match.scores);const leaders=match.scores.flatMap((s,i)=>s===top?[`Team ${i+1}`]:[]);return `${leaders.join(' + ')} ${leaders.length>1?'tie':'wins'} with ${top} point${top===1?'':'s'}.`;}
