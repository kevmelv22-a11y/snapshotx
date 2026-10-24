# Arm/hip zooms on the dark app bg: python3 zoom3.py <outdir>  (BANDS env)
import sys,os
import preview as P
from PIL import Image
out=sys.argv[1]; os.makedirs(out,exist_ok=True)
C=[('male','top-feyenoord-jersey','bottom-white-cargo','shoes-strideon-runner'),('male','top-blueberry-white-tee','bottom-white-cargo','shoes-nike-white'),
   ('male','top-nike-black-tee','bottom-kast-cream-joggers','shoes-strideon-runner'),('male','top-psv-jersey','bottom-kast-cream-joggers',None),
   ('female','top-feyenoord-jersey','bottom-white-cargo','shoes-strideon-runner'),('female','top-nike-black-tee','bottom-kast-cream-joggers',None),
   ('female','top-utrecht-jersey','bottom-white-cargo','shoes-strideon-panda'),('female','top-kast-stripe-longsleeve','bottom-kast-cream-joggers','shoes-strideon-runner')]
for g,t,b,s in C:
    o=dict(top=t,bottom=b); 
    if s: o['shoes']=s
    c=P.comp(g,o); W,H=c.size; bg=Image.new('RGB',c.size,(38,38,44)); bg.paste(c,(0,0),c)
    y0=.38 if g=='female' else .48
    cr=bg.crop((int(.1*W),int(y0*H),int(.9*W),int((y0+.27)*H))); cr.resize((cr.width*3,cr.height*3),Image.LANCZOS).save(f'{out}/{g}-{t[4:]}+{b[7:]}.png')
print('ok')
