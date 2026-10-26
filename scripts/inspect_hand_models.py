"""Inspect the actual bundled TFLite graphs and build static participant-facing HTML.
Run from any folder: python vision-lab-cnn/scripts/inspect_hand_models.py
Requires TensorFlow's generated TFLite schema, numpy and flatbuffers; no inference.
"""
from pathlib import Path
import importlib.util, io, zipfile, json, hashlib, html
from collections import Counter
ROOT=Path(__file__).resolve().parents[1]
# Load just the generated schema, avoiding TensorFlow runtime initialization.
tf=importlib.util.find_spec('tensorflow')
spec=importlib.util.spec_from_file_location('tflite_schema',Path(tf.origin).parent/'lite/python/schema_py_generated.py')
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
NAMES={v:k for k,v in vars(s.BuiltinOperator).items() if isinstance(v,int)}
ACTS={v:k for k,v in vars(s.ActivationFunctionType).items() if isinstance(v,int)}
models=[]
def walk(data,prefix=''):
 with zipfile.ZipFile(io.BytesIO(data)) as bundle:
  for name in bundle.namelist():
   raw=bundle.read(name)
   if name.endswith('.task'):walk(raw,prefix+name+'/')
   elif name.endswith('.tflite'):
    model=s.Model.GetRootAsModel(raw,0);g=model.Subgraphs(0)
    def tensor(j):
     t=g.Tensors(int(j));return {'id':int(j),'shape':[int(n) for n in t.ShapeAsNumpy()]}
    ops=[]
    for i in range(g.OperatorsLength()):
     op=g.Operators(i);kind=NAMES.get(model.OperatorCodes(op.OpcodeIndex()).BuiltinCode(),'CUSTOM')
     item={'index':i,'kind':kind,'inputs':[tensor(j) for j in op.InputsAsNumpy() if j>=0],'outputs':[tensor(j) for j in op.OutputsAsNumpy() if j>=0]}
     cls={'CONV_2D':s.Conv2DOptions,'DEPTHWISE_CONV_2D':s.DepthwiseConv2DOptions,'FULLY_CONNECTED':s.FullyConnectedOptions}.get(kind)
     if cls:
      table=op.BuiltinOptions();opts=cls();opts.Init(table.Bytes,table.Pos);item['activation']=ACTS[opts.FusedActivationFunction()]
      if kind!='FULLY_CONNECTED':item['stride']=[opts.StrideH(),opts.StrideW()]
     ops.append(item)
    models.append({'file':prefix+name,'sha256':hashlib.sha256(raw).hexdigest(),'inputs':[tensor(j) for j in g.InputsAsNumpy()],'outputs':[tensor(j) for j in g.OutputsAsNumpy()],'counts':dict(Counter(o['kind'] for o in ops)),'operations':ops})
raw=(ROOT/'vendor/gesture_recognizer.task').read_bytes();walk(raw)
report={'bundle_sha256':hashlib.sha256(raw).hexdigest(),'models':models}
(ROOT/'model-structure.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
e=html.escape
shape=lambda t:' × '.join(str(n) for n in t['shape']) or 'scalar'
shapes=lambda ts:'; '.join(shape(t) for t in ts)
titles=['Palm detector','Hand landmark model','Gesture embedding model','Gesture classifier']
intro='''<section class="modelLayers" aria-labelledby="modelLayersTitle"><h4 id="modelLayersTitle">Inside the models: compare the actual layers</h4><p>Our lecture CNN has <b>one convolution, ReLU, flatten and one dense classifier</b>, followed by softmax. It has 15 learned weights and biases. The camera uses the much larger graphs below.</p><p class="small">Counts and tensor shapes are read directly from the model bundle shipped with this workshop. These are <b>exported TFLite graph operations</b>, not a count of conceptual layers: activations may be fused into convolution/dense operations, while weight conversion appears as DEQUANTIZE. The graphs also branch; the operation list is execution order, not one unbranched chain.</p><div class="modelComparisonScroll"><table class="modelComparison"><thead><tr><th>Model</th><th>Standard conv</th><th>Depthwise conv</th><th>Dense</th><th>Other structure</th></tr></thead><tbody><tr><th>Lecture miniature</th><td>1</td><td>0</td><td>1</td><td>ReLU → flatten → scores → softmax</td></tr>'''
parts=[intro]
for title,m in zip(titles,models):
 c=m['counts'];other=', '.join(f"{n} {k}" for k,n in c.items() if k not in ['CONV_2D','DEPTHWISE_CONV_2D','FULLY_CONNECTED','DEQUANTIZE'])
 parts.append(f'<tr><th>{title}</th><td>{c.get("CONV_2D",0)}</td><td>{c.get("DEPTHWISE_CONV_2D",0)}</td><td>{c.get("FULLY_CONNECTED",0)}</td><td>{e(other)}</td></tr>')
parts.append('''</tbody></table></div><p><b>Standard convolution</b> mixes spatial patterns and channels. <b>Depthwise convolution</b> filters channels separately. <b>ADD</b> operations can merge branches; the tensor IDs below reveal the actual connections. <b>Dense</b> layers mix feature values. The gesture models consume hand geometry/features, so they are not image CNNs.</p>''')
for title,m in zip(titles,models):
 ops=m['operations'];conversion=m['counts'].get('DEQUANTIZE',0)
 parts.append(f'<details class="modelLayerDetail"><summary>{title} · {len(ops)-conversion} operations excluding {conversion} weight-conversion operations</summary><p><b>Inputs:</b> {e(shapes(m["inputs"]))}<br><b>Outputs:</b> {e(shapes(m["outputs"]))}</p><p class="small">Image tensors use batch × height × width × channels. Tensor IDs connect outputs to later inputs. Filter and bias tensors appear among the operation inputs. Fused activation NONE means the operation itself has no fused activation; a separate operation may follow.</p><div class="layerSequence" aria-label="Operation overview">')
 for o in ops:
  if o['kind']=='DEQUANTIZE':continue
  label=o['kind']+(' + '+o['activation'] if o.get('activation','NONE')!='NONE' else '')
  parts.append(f'<span>{o["index"]}: {e(label)}</span>')
 parts.append('</div><details><summary>Every operation, shape and connection</summary><div class="modelLayerTableScroll"><table><thead><tr><th>Op</th><th>Type</th><th>Input tensor IDs: shapes</th><th>Output tensor IDs: shapes</th><th>Fused activation / stride</th></tr></thead><tbody>')
 for o in ops:
  describe=lambda ts:'<br>'.join(f'#{t["id"]}: {e(shape(t))}' for t in ts)
  parts.append(f'<tr><td>{o["index"]}</td><td>{o["kind"]}</td><td>{describe(o["inputs"])}</td><td>{describe(o["outputs"])}</td><td>{e(o.get("activation","—"))}'+(f'; stride {o["stride"][0]} × {o["stride"][1]}' if 'stride' in o else '')+'</td></tr>')
 parts.append('</tbody></table></div></details></details>')
parts.append('<p class="small">Inspection source: bundled gesture_recognizer.task; SHA-256 <code>'+report['bundle_sha256'][:16]+'…</code>. <a href="model-structure.json">Full graph inspection data</a>. This describes the inference graphs; training losses and backward graphs are not included in these model files.</p></section>')
page=ROOT/'explore.html';text=page.read_text(encoding='utf-8');start='<!-- MODEL_LAYERS_START -->';end='<!-- MODEL_LAYERS_END -->'
fragment=start+''.join(parts)+end
if start in text:text=text[:text.index(start)]+fragment+text[text.index(end)+len(end):]
else:
 anchor='</div></aside></section>'
 assert anchor in text
 text=text.replace(anchor,'</div>'+fragment+'</aside></section>',1)
page.write_text(text,encoding='utf-8')
print(json.dumps({m['file']:m['counts'] for m in models},indent=2))
