// Safe native MathML for explanatory equations. Code examples stay plain text.
export const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function atom(value){
  const indexed=String(value).match(/^([\p{L}]+)(?:\[([^\]]+)\]|_([\p{L}\p{N},]+))?$/u);
  if(indexed){
    const name=indexed[1],base=name.length===1?`<mi>${escapeHtml(name)}</mi>`:`<mi mathvariant="normal">${escapeHtml(name)}</mi>`;
    return indexed[2]||indexed[3]?`<msub>${base}${expression(indexed[2]||indexed[3])}</msub>`:base;
  }
  if(/^\d+(?:\.\d+)?$/.test(String(value)))return `<mn>${escapeHtml(value)}</mn>`;
  return `<mo>${escapeHtml(value)}</mo>`;
}
function expression(value){
  const tokens=String(value).match(/\d+(?:\.\d+)?|[\p{L}]+(?:\[[^\]\n]*\])?|[^\s]/gu)||[];
  return `<mrow>${tokens.map(atom).join('')}</mrow>`;
}
function math(numerator,denominator,label){
  return `<math class="mathNotation mathFraction" display="inline" aria-label="${escapeHtml(label)}"><mstyle displaystyle="true"><mfrac>${numerator}${denominator}</mfrac></mstyle></math>`;
}
export function fraction(numerator,denominator){
  return math(expression(numerator),expression(denominator),`${numerator} divided by ${denominator}`);
}
export function derivative(variable,numerator='L'){
  return math(`<mrow><mo>∂</mo>${expression(numerator)}</mrow>`,`<mrow><mo>∂</mo>${expression(variable)}</mrow>`,`partial derivative of ${numerator} with respect to ${variable}`);
}

// Match only scalar fractions and derivative notation in prose/formulas.
// The scanner works on raw text, then escapes unmatched spans; generated markup
// is never re-parsed and arbitrary input cannot inject HTML.
const variable=String.raw`[\p{L}](?:\[[^\]\n]+\]|_[\p{L}\p{N},]+)?`;
const scalar=String.raw`(?:${variable}|\d+(?:\.\d+)?)`;
const notation=new RegExp(String.raw`∂(${variable})\s*\/\s*∂(${variable})|(?<![\p{L}\p{N}_:/\\])(${scalar})\s*\/\s*(${scalar})(?![\p{L}\p{N}_/\\])`,'gu');
export function renderMathText(value){
  const text=String(value);let cursor=0,result='';
  for(const match of text.matchAll(notation)){
    result+=escapeHtml(text.slice(cursor,match.index));
    result+=match[1]?derivative(match[2],match[1]):fraction(match[3],match[4]);
    cursor=match.index+match[0].length;
  }
  return result+escapeHtml(text.slice(cursor));
}
