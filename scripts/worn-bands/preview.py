import json,sys,os
from PIL import Image, ImageDraw
B=os.environ.get("BANDS","/workspace/scripts_tmp/combo/bands2/"); meta=json.load(open(B+"meta.json"))
REF={'male':'top-blueberry-white-tee','female':'top-nike-black-tee'}
def pick(g,o):
    P=meta[g]['pieces']; has=lambda i,b: bool(i) and i in P and b in P[i]
    inner=next((o.get(c) for c in ['dress','top'] if has(o.get(c),'torso')),None)
    outer=o.get('outerwear') if has(o.get('outerwear'),'torso') else None
    lastInner=o.get('torso') and o.get('torso')==inner
    if outer and inner and not lastInner and has(outer,'jacket'): base,jacket=inner,outer
    elif outer and not lastInner: base,jacket=outer,None
    else: base,jacket=(inner or REF[g]),None
    own=jacket or base
    legsrc=own if (P[own]['cat']=='dress' or P[own]['long']) else (base if P[base]['cat']=='dress' else (o['bottom'] if has(o.get('bottom'),'legs') else base))
    feet=o['shoes'] if has(o.get('shoes'),'feet') else None
    head=o['hat'] if has(o.get('hat'),'head') and not (g=='female' and o['hat']=='hat-nike-cap') else own
    L=[] if feet else [(legsrc,'sole')]
    L+=[(legsrc,'legs')]+([(feet,'feet')] if feet else [])+[(base,'under' if jacket and has(base,'under') else 'torso')]+([(jacket,'jacket')] if jacket else [])+[(head,'head')]
    return [x for x in L if has(*x)]
def comp(g,o):
    CW,CH=meta[g]['canvas']; c=Image.new('RGBA',(CW,CH),(0,0,0,0))
    for i,b in pick(g,o):
        x,y,w,h=meta[g]['pieces'][i][b]; im=Image.open(B+f'{g}/{i}-{b}.png'); c.alpha_composite(im,(x,y))
    return c
C={'male':[dict(top='top-feyenoord-jersey',bottom='bottom-adidas-track'),dict(top='top-nike-black-tee',outerwear='outer-carhartt-black',bottom='bottom-bf-shorts',shoes='shoes-crocs-clog',hat='hat-trivo-beanie'),
 dict(top='top-az-jersey',bottom='bottom-bf-shorts'),dict(top='top-psv-jersey',bottom='bottom-white-cargo',hat='hat-nike-cap'),
 dict(top='top-feyenoord-jersey',outerwear='outer-ploeg-olive-jacket',bottom='bottom-blueberry-jeans'),dict(top='top-psv-jersey',outerwear='outer-ploeg-tan-jacket',bottom='bottom-nike-joggers',shoes='shoes-adidas-bw')],
 'female':[dict(top='top-feyenoord-jersey',bottom='bottom-adidas-track'),dict(top='top-nike-black-tee',outerwear='outer-carhartt-black',bottom='bottom-bf-shorts',shoes='shoes-crocs-clog',hat='hat-trivo-beanie'),
 dict(top='top-utrecht-jersey',bottom='bottom-white-cargo',shoes='shoes-blueberry-bunny'),dict(top='top-kast-stripe-longsleeve',bottom='bottom-trivo-shorts',shoes='shoes-adidas-bw',hat='hat-bf-beanie'),
 dict(top='top-feyenoord-jersey',outerwear='outer-basisbes-denim-jacket',bottom='bottom-blueberry-jeans',shoes='shoes-strideon-panda'),dict(top='top-psv-jersey',outerwear='outer-ploeg-olive-jacket',bottom='bottom-white-cargo')]}
if __name__=='__main__':
 out=sys.argv[1]
 for g in C:
  ims=[comp(g,o) for o in C[g]]; W,H=ims[0].size
  S=Image.new('RGB',(W*len(ims),H),(60,60,66))
  for k,im in enumerate(ims): S.paste(im,(k*W,0),im); print(g,k,[p for p in pick(g,C[g][k])])
  S.save(f'{out}-{g}.png')
