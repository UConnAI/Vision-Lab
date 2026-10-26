"""Build reproducible single-filter classroom fixtures (seed 314).

Fits one linear normalized-patch filter per photograph from two positive
samples and hard negatives. These are prepared same-photo teaching filters,
not a trained general-purpose eye detector. Runtime search sees no eye boxes.
"""
import json
from pathlib import Path
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view
from PIL import Image
from sklearn.svm import LinearSVC

ROOT = Path(__file__).resolve().parents[1]
BANK = {
 'astronaut': ('astronaut.png', [(190,91,27,19),(234,93,28,19)]),
 'hopper': ('grace-hopper.jpg', [(190,175,49,27),(281,173,49,27)]),
 'cat': ('chelsea.png', [(139,85,59,62),(291,104,43,55)]),
}
W,H=17,13
result={}
for key,(file,boxes) in BANK.items():
 rgb=np.array(Image.open(ROOT/'assets/photos'/file).convert('RGB'))
 scale=min(1,256/max(rgb.shape[:2])); height=round(rgb.shape[0]*scale);width=round(rgb.shape[1]*scale)
 # Deterministic source-pixel sampling; ship these exact working pixels.
 yy=np.minimum(rgb.shape[0]-1,((np.arange(height)+.5)/scale).astype(int))
 xx=np.minimum(rgb.shape[1]-1,((np.arange(width)+.5)/scale).astype(int))
 gray=np.rint(rgb[yy[:,None],xx[None,:]] @ np.array([.299,.587,.114])).astype(np.uint8)
 patches=sliding_window_view(gray,(H,W)).reshape(-1,H*W).astype(np.float64)
 patches-=patches.mean(axis=1,keepdims=True);norm=np.linalg.norm(patches,axis=1,keepdims=True)
 patches/=np.maximum(norm,1e-10)
 ph,pw=height-H+1,width-W+1
 cy,cx=np.indices((ph,pw)); cx=cx.ravel()+W//2;cy=cy.ravel()+H//2
 refs=[dict(x=x/rgb.shape[1]*width,y=y/rgb.shape[0]*height,width=w/rgb.shape[1]*width,height=h/rgb.shape[0]*height) for x,y,w,h in boxes]
 inside=np.zeros(len(patches),bool)
 for r in refs:inside|=(cx>=r['x'])&(cx<r['x']+r['width'])&(cy>=r['y'])&(cy<r['y']+r['height'])
 positives=[]
 for r in refs:
  x=int(np.rint(r['x']+r['width']/2))-W//2;y=int(np.rint(r['y']+r['height']/2))-H//2
  positives.append(y*pw+x)
 # Include all non-eye patches as negatives, no positive labels for background.
 negative=np.where(~inside)[0]
 rng=np.random.default_rng(314); chosen=rng.choice(negative,min(3000,len(negative)),replace=False)
 for iteration in range(5):
  indices=np.r_[positives,chosen]
  model=LinearSVC(C=10,class_weight={1:100,0:1},random_state=314,tol=1e-7,max_iter=10000,dual='auto').fit(patches[indices],np.r_[np.ones(2),np.zeros(len(chosen))])
  weight=model.coef_[0]; weight-=weight.mean();weight/=np.linalg.norm(weight)
  scores=patches@weight
  hard=negative[np.argsort(scores[negative])[-1500:]];chosen=np.unique(np.r_[chosen,hard])
 # Quantize to teachable integer coefficients.
 weight=np.rint(weight/np.max(np.abs(weight))*32).astype(int)
 normalized=weight-weight.mean();normalized=normalized/np.linalg.norm(normalized)
 scores=patches@normalized
 eye_min=min(scores[i] for i in positives);background_max=max(scores[negative]);threshold=np.ceil((eye_min+background_max)/2*100)/100
 editable=np.argsort(-np.abs(weight))[:6].tolist()
 starter=weight.copy();starter[editable]*=-1
 startnorm=starter-starter.mean();startnorm=startnorm/np.linalg.norm(startnorm)
 start_scores=patches@startnorm
 print(key,'eye scores',scores[positives],'max non-eye',background_max,'threshold',threshold,'gap',eye_min-background_max,'editable',[(i,int(weight[i])) for i in editable], 'starter eye',start_scores[positives],flush=True)
 result[key]=dict(width=width,height=height,pixels=gray.ravel().tolist(),filterWidth=W,filterHeight=H,weights=weight.tolist(),editable=editable,threshold=float(threshold),eyeScores=scores[positives].tolist(),maxBackground=float(background_max),regions=refs)
# Same Collins filter on a separate no-eye control; do not fit this image.
rgb=np.array(Image.open(ROOT/'assets/photos/coffee.png').convert('RGB'))
scale=min(1,256/max(rgb.shape[:2]));height=round(rgb.shape[0]*scale);width=round(rgb.shape[1]*scale)
yy=np.minimum(rgb.shape[0]-1,((np.arange(height)+.5)/scale).astype(int));xx=np.minimum(rgb.shape[1]-1,((np.arange(width)+.5)/scale).astype(int))
gray=np.rint(rgb[yy[:,None],xx[None,:]] @ np.array([.299,.587,.114])).astype(np.uint8)
result['coffee']=dict(width=width,height=height,pixels=gray.ravel().tolist(),filterWidth=W,filterHeight=H,weights=result['astronaut']['weights'].copy(),editable=[],threshold=result['astronaut']['threshold'],regions=[])
(ROOT/'assets/eye-lab.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf-8')
