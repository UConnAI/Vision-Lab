import test from 'node:test';
import assert from 'node:assert/strict';
import {derivative,renderMathText} from '../math-notation.mjs';

test('displayed indexed derivatives and scalar division use native stacked fractions',()=>{
  const html=renderMathText('∂p[i]/∂s[j] = −y[i]/p[i]; ∂L/∂K[0,0]');
  assert.equal((html.match(/<mfrac>/g)||[]).length,3);
  assert.match(html,/<msub>/);
  assert.match(html,/partial derivative of L with respect to K\[0,0\]/);
  assert.doesNotMatch(html,/∂L\/∂K/);
});
test('formula text stays escaped and URLs remain literal',()=>{
  const text=renderMathText('<img src=x onerror=alert(1)> https://example.com/path ∂L/∂W[k,j]');
  assert.match(text,/&lt;img/);assert.doesNotMatch(text,/<img/);
  assert.match(text,/https:\/\/example.com\/path/);
  assert.doesNotMatch(derivative('<script>'),/<script>/);
});
