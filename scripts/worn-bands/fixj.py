import cv2,numpy as np,json
from PIL import Image
W='/workspace/snapshotx/assets/avatar-art/worn/'; reg=json.load(open('reg2.json'))
def gray(a):
    al=a[...,3:4]/255.; return cv2.cvtColor((a[...,:3]*al+128*(1-al)).astype(np.uint8),cv2.COLOR_RGB2GRAY).astype(np.float32)
g='male'; r=np.array(Image.open(W+'male/top-blueberry-white-tee.png').convert('RGBA')); P=90
Rp=cv2.copyMakeBorder(gray(r),P,P,P,P,cv2.BORDER_CONSTANT,value=128)
for i in ['top-az-jersey','top-feyenoord-jersey','top-psv-jersey','top-twente-jersey','top-utrecht-jersey']:
    a=np.array(Image.open(W+f'male/{i}.png').convert('RGBA')); best=None
    for s in np.arange(0.92,1.12,0.005):
        I=cv2.resize(a,(round(a.shape[1]*s),round(a.shape[0]*s)),interpolation=cv2.INTER_AREA); G=gray(I); h=G.shape[0]
        m=np.zeros_like(G); m[:int(0.2*h)]=1; m[int(0.86*h):]=1; m=m*(I[...,3]>20)
        res=cv2.matchTemplate(Rp,G,cv2.TM_CCOEFF_NORMED,mask=m); res[~np.isfinite(res)]=-1
        _,v,_,loc=cv2.minMaxLoc(res)
        if best is None or v>best[0]: best=(v,s,loc[0]-P,loc[1]-P)
    v,s,tx,ty=best; print(i,best); reg[g]['items'][i]['A']=[[s,0,tx],[0,s,ty]]
json.dump(reg,open('reg2.json','w'))
