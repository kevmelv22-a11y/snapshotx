# Shoes/socks: register on the lower legs + feet outline (where the shoe band must line up), not the upper body.
import cv2,numpy as np,json
from PIL import Image
W='/workspace/snapshotx/assets/avatar-art/worn/'; reg=json.load(open('reg2.json'))
REF={'male':'top-blueberry-white-tee','female':'top-nike-black-tee'}
def gray(a):
    al=a[...,3:4]/255.; return cv2.cvtColor((a[...,:3]*al+128*(1-al)).astype(np.uint8),cv2.COLOR_RGB2GRAY).astype(np.float32)
for g in reg:
    r=np.array(Image.open(W+f'{g}/{REF[g]}.png').convert('RGBA')); P=90
    Rp=cv2.copyMakeBorder(gray(r),P,P,P,P,cv2.BORDER_CONSTANT,value=128)
    for i,it in reg[g]['items'].items():
        if it['cat'] not in ('shoes','socks') or it['how']=='sift': continue
        a=np.array(Image.open(W+f'{g}/{i}.png').convert('RGBA')); best=None
        for s in np.arange(0.95,1.20,0.005):
            I=cv2.resize(a,(round(a.shape[1]*s),round(a.shape[0]*s)),interpolation=cv2.INTER_AREA); G=gray(I); h=G.shape[0]
            m=np.zeros_like(G); m[int(0.45*h):int(0.88*h)]=1; m=m*(cv2.dilate((I[...,3]>20).astype(np.uint8),np.ones((9,9),np.uint8)))
            res=cv2.matchTemplate(Rp,G,cv2.TM_CCORR_NORMED,mask=m); res[~np.isfinite(res)]=0
            _,v,_,loc=cv2.minMaxLoc(res)
            if best is None or v>best[0]: best=(v,s,loc[0]-P,loc[1]-P)
        v,s,tx,ty=best; print(g,i,round(v,4),round(s,3),tx,ty); it['A']=[[s,0,tx],[0,s,ty]]; it['how']='tmpl-legs'
json.dump(reg,open('reg2.json','w'))
