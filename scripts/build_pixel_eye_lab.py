"""Small photographic eye-search fixtures with hand-designed 4x4 filters.
No learned weights: box averaging makes each input pixel easy to inspect.
"""
from pathlib import Path
import json
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
human=[1,1,1,1,-1,-1,-1,1,1,1,1,1,1,1,1,1]
cat=[1,1,1,1,1,-1,-1,1,1,-1,-1,1,1,1,1,1]
specs={
 'astronaut':('astronaut.png',(150,55,290,175),24,[(190,91,27,19),(234,93,28,19)],human,.60),
 'hopper':('grace-hopper.jpg',(155,130,370,265),24,[(190,175,49,27),(281,173,49,27)],human,.60),
 'cat':('chelsea.png',(110,55,360,190),28,[(139,85,59,62),(291,104,43,55)],cat,.65)
}
result={}
for key,(file,crop,width,eyes,solution,threshold) in specs.items():
 source=Image.open(ROOT/'assets/photos'/file).convert('L').crop(crop)
 height=round(width*source.height/source.width)
 image=source.resize((width,height),Image.Resampling.BOX)
 regions=[dict(x=(x-crop[0])*width/source.width,y=(y-crop[1])*height/source.height,width=w*width/source.width,height=h*height/source.height)for x,y,w,h in eyes]
 inspect={'astronaut':[(10,8),(18,9)],'hopper':[(8,7),(18,7)],'cat':[(7,7),(23,9)]}[key]
 result[key]=dict(inspect=inspect,width=width,height=height,pixels=list(image.getdata()),regions=regions,weights=solution,threshold=threshold,sourceCrop=list(crop),sourceFile='assets/photos/'+file,editable=[4,9,10,15] if key=='cat' else list(range(16)),starter=human if key=='cat' else [0]*16)
(ROOT/'assets/eye-pixel-lab.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf-8')
print('Prepared 3 small grayscale crops with explicit hand-designed 4x4 solutions.')
