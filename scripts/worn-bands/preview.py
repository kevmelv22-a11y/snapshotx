import json,sys
from PIL import Image, ImageDraw
B='/workspace/scripts_tmp/combo/bands/'; meta=json.load(open(B+'meta.json'))
REF={'male':'top-blueberry-white-tee','female':'top-nike-black-tee'}
def pick(g,o):
    P=meta[g]['pieces']; has=lambda i: i in P
    base=next((o[c] for c in ['outerwear','dress','top'] if o.get(c) and has(o[c])),REF[g])
    legsrc=base if P[base]['cat']=='dress' or P[base]['long'] else (o['dress'] if o.get('dress') and has(o['dress']) else (o['bottom'] if o.get('bottom') and has(o['bottom']) else base))
    feet=o['shoes'] if o.get('shoes') and has(o['shoes']) and 'feet' in P[o['shoes']] else base
    head=o['hat'] if o.get('hat') and has(o['hat']) else base
    L=([(legsrc,'sole')] if feet==base else [])+[(legsrc,'legs')]+([(feet,'feet')] if feet!=base else [])+[(base,'torso'),(head,'head')]; return L
def comp(g,o):
    CW,CH=meta[g]['canvas']; c=Image.new('RGBA',(CW,CH),(0,0,0,0))
    for i,b in pick(g,o):
        x,y,w,h=meta[g]['pieces'][i][b]; im=Image.open(B+f'{g}/{i}-{b}.png'); c.alpha_composite(im,(x,y))
    return c
C={'male':[dict(top='top-feyenoord-jersey',bottom='bottom-adidas-track'),dict(top='top-nike-black-tee',outerwear='outer-carhartt-black',bottom='bottom-bf-shorts',shoes='shoes-crocs-clog',hat='hat-trivo-beanie'),
 dict(top='top-psv-jersey',bottom='bottom-white-cargo',hat='hat-nike-cap'),dict(outerwear='outer-blueberry-blue-hoodie',bottom='bottom-nike-joggers',shoes='shoes-blueberry-bunny'),
 dict(outerwear='outer-rossano-trench',bottom='bottom-blueberry-jeans',hat='hat-prada-fedora'),dict(top='top-az-jersey',bottom='bottom-trivo-shorts',shoes='shoes-ugg-classic')],
 'female':[dict(top='top-feyenoord-jersey',bottom='bottom-adidas-track'),dict(top='top-nike-black-tee',outerwear='outer-carhartt-black',bottom='bottom-bf-shorts',shoes='shoes-crocs-clog',hat='hat-trivo-beanie'),
 dict(dress='dress-bf-mint-maxi',hat='hat-prada-fedora'),dict(top='top-nike-black-tee',outerwear='outer-lacoste-puffer',bottom='bottom-white-cargo',shoes='shoes-blueberry-bunny'),
 dict(top='top-utrecht-jersey',bottom='bottom-rossano-plaid-skirt',shoes='shoes-adidas-bw',hat='hat-bf-beanie'),dict(outerwear='outer-rossano-trench',bottom='bottom-blueberry-jeans',hat='hat-klompz-bucket')]}
out=sys.argv[1]
for g in C:
    ims=[comp(g,o) for o in C[g]]; W,H=ims[0].size
    S=Image.new('RGB',(W*len(ims),H),(60,60,66))
    for k,im in enumerate(ims): S.paste(im,(k*W,0),im); print(g,k,[p for p in pick(g,C[g][k])])
    S.save(f'{out}-{g}.png')
