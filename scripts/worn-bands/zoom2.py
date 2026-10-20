# Hip->feet crops of every bottom with several tops/shoes on the app's dark bg: python3 zoom2.py <outdir>  (BANDS env = bands dir)
import sys,os
import preview as P
from PIL import Image, ImageDraw
out=sys.argv[1]; os.makedirs(out,exist_ok=True)
T={'male':['top-feyenoord-jersey','top-blueberry-white-tee','top-nike-black-tee'],'female':['top-feyenoord-jersey','top-nike-black-tee','top-kast-stripe-longsleeve']}
S={'male':['shoes-strideon-runner','shoes-nike-white','shoes-ugg-classic',None],'female':['shoes-strideon-runner','shoes-strideon-panda','shoes-ugg-classic',None]}
for g in T:
    bots=sorted(k for k,v in P.meta[g]['pieces'].items() if v['cat']=='bottom')
    for b in bots:
        ims=[]
        for k,(t,s) in enumerate(zip(T[g]*2,S[g])):
            o=dict(top=t,bottom=b); 
            if s: o['shoes']=s
            c=P.comp(g,o); W,H=c.size; bg=Image.new('RGB',c.size,(38,38,44)); bg.paste(c,(0,0),c)
            ims.append(bg.crop((int(.12*W),int(.5*H),int(.95*W),int(.99*H))))
        w,h=ims[0].size; sh=Image.new('RGB',(w*len(ims),h)); [sh.paste(x,(i*w,0)) for i,x in enumerate(ims)]
        sh=sh.resize((sh.width*3//2,sh.height*3//2),Image.LANCZOS); sh.save(f'{out}/{g}-{b}.png')
print('ok')
