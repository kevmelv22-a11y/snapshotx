# Zoomed crops of the known-flaw combos: python3 zoom.py <outdir> [bandsdir]
import sys,os; sys.argv=[sys.argv[0]]+sys.argv[1:]
import preview as P
from PIL import Image
out=sys.argv[1]; os.makedirs(out,exist_ok=True)
Z=[('a-male-feyenoord+olive','male',dict(top='top-feyenoord-jersey',outerwear='outer-ploeg-olive-jacket',bottom='bottom-blueberry-jeans'),(0.0,0.2,1.0,0.75)),
 ('b-female-feyenoord+denim','female',dict(top='top-feyenoord-jersey',outerwear='outer-basisbes-denim-jacket',bottom='bottom-blueberry-jeans',shoes='shoes-strideon-panda'),(0.0,0.2,1.0,0.65)),
 ('c1-female-trivo-beanie','female',dict(top='top-kast-stripe-longsleeve',bottom='bottom-trivo-shorts',hat='hat-trivo-beanie'),(0.1,0.03,0.9,0.42)),
 ('c2-female-bf-beanie','female',dict(top='top-kast-stripe-longsleeve',bottom='bottom-trivo-shorts',hat='hat-bf-beanie'),(0.1,0.03,0.9,0.42)),
 ('c3-female-bucket','female',dict(top='top-feyenoord-jersey',bottom='bottom-white-cargo',hat='hat-balenciaga-bucket'),(0.1,0.03,0.9,0.42)),
 ('c4-female-fedora','female',dict(top='top-psv-jersey',bottom='bottom-white-cargo',hat='hat-prada-fedora'),(0.1,0.03,0.9,0.42)),
 ('d1-female-ugg','female',dict(top='top-nike-black-tee',bottom='bottom-blueberry-jeans',shoes='shoes-ugg-classic'),(0.1,0.7,0.9,1.0)),
 ('d2-female-bf-shorts','female',dict(top='top-nike-black-tee',bottom='bottom-bf-shorts'),(0.1,0.4,0.9,0.85)),
 ('d3-female-trivo-shorts','female',dict(top='top-nike-black-tee',bottom='bottom-trivo-shorts',shoes='shoes-ugg-classic'),(0.1,0.4,0.95,1.0))]
for n,g,o,(x0,y0,x1,y1) in Z:
    c=P.comp(g,o); W,H=c.size; bg=Image.new('RGB',c.size,(60,60,66)); bg.paste(c,(0,0),c)
    cr=bg.crop((int(x0*W),int(y0*H),int(x1*W),int(y1*H))); cr=cr.resize((cr.width*2,cr.height*2),Image.LANCZOS); cr.save(f'{out}/{n}.png')
print('ok')
