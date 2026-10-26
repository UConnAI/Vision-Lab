import {renderMathText} from './math-notation.mjs';

// Typeset explanatory text after a dynamic panel renders. Source code stays literal.
export function typesetMath(root){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
    if(node.parentElement?.closest('math,pre,code,script,style,button,option'))continue;
    const formatted=renderMathText(node.textContent);
    if(!formatted.includes('<math'))continue;
    const template=document.createElement('template');template.innerHTML=formatted;
    node.replaceWith(template.content);
  }
}
