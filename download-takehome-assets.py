from pathlib import Path
import urllib.request,json,hashlib
root=Path('take-home-football-tracker');records=[]
def get(url,path):
 target=root/path;target.parent.mkdir(parents=True,exist_ok=True)
 if not target.exists():
  request=urllib.request.Request(url,headers={'User-Agent':'AIClubEducationalDemo/1.0'})
  with urllib.request.urlopen(request,timeout=90) as response:target.write_bytes(response.read())
 blob=target.read_bytes();records.append({'path':str(path),'url':url,'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest()});print(str(path),len(blob),flush=True)
get('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',Path('vendor/tf.min.js'))
get('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js',Path('vendor/coco-ssd.min.js'))
base='https://storage.googleapis.com/tfjs-models/savedmodel/ssd_mobilenet_v2/'
get(base+'model.json',Path('vendor/model/model.json'))
m=json.loads((root/'vendor/model/model.json').read_text())
for group in m['weightsManifest']:
 for part in group['paths']:get(base+part,Path('vendor/model')/part)
get('https://upload.wikimedia.org/wikipedia/commons/3/34/Men_kicking_footballs.webm',Path('assets/source.webm'))
(root/'assets/manifest.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
