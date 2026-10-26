import {validateBank,promptLevel} from './prompt-bank.mjs';
import {createMatch,finishTurn,nextTurn,matchResult} from './team-game.mjs';
const $=id=>document.getElementById(id);
let bank=null;const cursors={easy:0,medium:0,hard:0};
function choosePrompt(){const level=promptLevel(match.difficulty,Math.floor(match.turn/match.teams));match.level=level;match.prompt=bank[level][cursors[level]++%bank[level].length];}
async function loadBank(){try{const response=await fetch('./prompts.json',{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);bank=validateBank(await response.json());$('bankStatus').textContent=`${Object.values(bank).flat().length} prompts loaded · edit prompts.json to customize.`;}catch(e){bank=null;$('bankStatus').textContent=`Prompt bank could not load: ${e.message}. Fix prompts.json, then Reload prompt bank.`;}render();}

let match=null,timer=null,deadline=0;
export function canPaint(){return !match||match.phase==='playing';}
export function currentTwist(){const choice=match?.twist||$('twist').value;return choice==='mix'?['classic','mirror','vanish'][Math.floor((match?.turn||0)/(match?.teams||1))%3]:choice;}
const twistText={classic:'Classic · draw your way',mirror:'Mirror mischief · left becomes right',vanish:'Vanishing ink · guess before it fades'};
function clearTimer(){clearInterval(timer);timer=null;}
function render(){
  $('scoreboard').replaceChildren();
  if(!match){$('gameCue').textContent='Free drawing · try a twist, or start a game.';$('clock').textContent='—';}
  else {match.scores.forEach((score,i)=>{const card=document.createElement('div');card.className='scoreCard'+(i===match.turn%match.teams&&match.phase!=='complete'?' current':'');card.textContent=`Team ${i+1} · ${score} point${score===1?'':'s'}`;$('scoreboard').append(card);});$('clock').textContent=`${Math.ceil(match.remaining)}s`;$('gameCue').textContent=match.phase==='complete'?matchResult(match):`Team ${match.turn%match.teams+1} · turn ${Math.floor(match.turn/match.teams)+1}/${match.rounds} · ${ {ready:'Artist: check your prompt, then Start turn.',playing:'DRAW! Teammates guess aloud.',paused:'Paused · no drawing. Resume when ready.',finished:match.note+' · move to the next team.'}[match.phase]}`;}
  for(const [id,enabled] of Object.entries({showPrompt:match?.phase==='ready',startTurn:match?.phase==='ready',pauseTurn:['playing','paused'].includes(match?.phase),correct:['playing','paused'].includes(match?.phase),pass:['playing','paused'].includes(match?.phase),nextTeam:match?.phase==='finished'}))$(id).disabled=!enabled;
  $('pauseTurn').textContent=match?.phase==='paused'?'Resume timer':'Pause timer';
  if(match?.teams===1){$('scoreboard').firstChild.textContent=`Whole crew · ${match.scores[0]} / ${Math.ceil(match.rounds*2/3)} goal`;$('gameCue').textContent=$('gameCue').textContent.replace(/Team 1 · turn/,'Whole crew · round').replace('Teammates','Everyone').replace('next team','next artist');}
  $('nextTeam').textContent=match?.teams===1?'Next artist':'Next team';
  $('twistCue').textContent=twistText[currentTwist()]+(match?` · ${match.level} prompt`:'');
  for(const id of ['teamCount','turnCount','turnSeconds','difficulty'])$(id).disabled=!!match&&match.phase!=='complete';
  $('twist').disabled=!!match&&!((match.phase==='ready'&&match.turn%match.teams===0)||match.phase==='complete');
  $('newMatch').disabled=!bank;
  if(!bank){for(const id of ['newMatch','showPrompt','startTurn'])$(id).disabled=true;}
}
function finish(correct,note){if(!match)return;if(match.phase==='playing'&&performance.now()>=deadline){correct=false;note='Time up · 0 points';match.remaining=0;}if(finishTurn(match,correct)){match.note=note||(correct?'Correct! +1 point':'Passed · 0 points');clearTimer();render();}}
function runTimer(){deadline=performance.now()+match.remaining*1000;timer=setInterval(()=>{match.remaining=Math.max(0,(deadline-performance.now())/1000);if(match.remaining===0)finish(false,'Time up · 0 points');else render();},100);}
$('newMatch').onclick=()=>{clearTimer();match=createMatch(Number($('teamCount').value),Number($('turnCount').value));match.twist=$('twist').value;match.difficulty=$('difficulty').value;choosePrompt();match.seconds=Number($('turnSeconds').value);match.remaining=match.seconds;$('clear').click();render();};
$('freeDraw').onclick=()=>{clearTimer();match=null;render();};
$('showPrompt').onclick=()=>{$('secretWord').textContent=match.prompt;$('promptCard').showModal();};
$('hidePrompt').onclick=()=>{$('promptCard').close();$('secretWord').textContent='';};$('promptCard').addEventListener('close',()=>{$('secretWord').textContent='';});
$('startTurn').onclick=()=>{match.phase='playing';runTimer();render();};
$('pauseTurn').onclick=()=>{if(match.phase==='playing'){match.remaining=Math.max(0,(deadline-performance.now())/1000);clearTimer();if(match.remaining===0){finish(false);return;}match.phase='paused';}else{match.phase='playing';runTimer();}render();};
$('correct').onclick=()=>finish(true);$('pass').onclick=()=>finish(false);
$('nextTeam').onclick=()=>{if(nextTurn(match)){if(match.phase!=='complete')choosePrompt();match.remaining=match.seconds;$('clear').click();render();}};
$('partyView').onclick=()=>{const expanded=$('airArt').classList.toggle('partyExpanded');$('partyView').textContent=expanded?'Exit game screen':'Large game screen';};
$('gameSettings').onclick=()=>{const shown=$('airArt').classList.toggle('showSetup');$('gameSettings').setAttribute('aria-expanded',String(shown));$('gameSettings').textContent=shown?'Hide setup':'Game setup';};
$('reloadBank').onclick=()=>{clearTimer();match=null;bank=null;render();loadBank();};
$('twist').onchange=()=>{if(match)match.twist=$('twist').value;$('clear').click();render();};
$('hideCamera').onclick=()=>{const hidden=$('airArt').classList.toggle('cameraHidden');$('hideCamera').textContent=hidden?'Show camera preview':'Hide camera preview';$('hideCamera').setAttribute('aria-pressed',String(hidden));};
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('promptCard').open){$('airArt').classList.remove('partyExpanded');$('partyView').textContent='Large game screen';}});
window.addEventListener('pagehide',clearTimer);render();loadBank();
