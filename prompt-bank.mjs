export function validateBank(bank){
  for(const level of ['easy','medium','hard']){
    if(!Array.isArray(bank?.[level])||!bank[level].length||bank[level].some(word=>typeof word!=='string'||!word.trim()||word.length>120))throw new Error(`The ${level} bank must contain non-empty text prompts (up to 120 characters each).`);
  }
  return Object.fromEntries(['easy','medium','hard'].map(level=>[level,bank[level].map(word=>word.trim())]));
}
export function promptLevel(choice,round){return choice==='mixed'?['easy','medium','hard'][round%3]:choice;}
