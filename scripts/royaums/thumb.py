import numpy as np,cv2,sys
from PIL import Image
sys.path.insert(0,'/workspace/scripts_tmp/roy'); from make import stud
src=Image.open('/workspace/sx-jerseys/assets/avatar-art/items/shoes-nike-white.png').convert('RGBA')
a=np.array(src); al=a[...,3]>128; h,w=al.shape
V=cv2.cvtColor(a[...,:3],cv2.COLOR_RGB2HSV)[...,2].astype(np.float32)
n,cl,st,_=cv2.connectedComponentsWithStats(al.astype(np.uint8),8)
print([tuple(st[k]) for k in range(1,n) if st[k,4]>200])
ys,xs=np.where(al); Y0,Y1=ys.min(),ys.max(); X0,X1=xs.min(),xs.max()
bot=np.full(w,-1)
for x in range(w):
    c=np.where(al[:,x])[0]
    if len(c): bot[x]=c.max()
# sole: bottom band per column, thickness from local height
sole=np.zeros_like(al); T=0.17*(Y1-Y0)
for x in range(w):
    if bot[x]>=0: sole[int(bot[x]-T):bot[x]+1,x]=True
sole&=al
# the sole on the rear shoe is also visible behind -> also treat very bright, low-detail lower pixels? keep simple
up=al&~sole
def make(design):
    img=a.astype(np.float32); shade=np.clip(V/235,0,1.15)
    xx=np.arange(w)[None,:]; yy=np.arange(h)[:,None]
    if design!='luisa-white':
        base=np.array([26,26,29.]) if design=='kilian-black' else np.array([96,98,102.])
        hl=np.array([80,80,86.]) if design=='kilian-black' else np.array([160,162,166.])
        col=base*shade[...,None]+hl*np.clip(shade-0.9,0,1)[...,None]*3
        img[...,:3]=np.where(up[...,None],col,img[...,:3])
    def ell(cx,cy,rx,ry): return (((xx-cx)/rx)**2+((yy-cy)/ry)**2<=1)&up
    toes=ell(165,232,48,22)|ell(52,208,30,22)
    heels=ell(322,158,26,42)
    if design!='luisa-white':
        pc=np.array([10,10,12.])*shade[...,None]+np.array([150,150,160.])*np.clip(shade-0.95,0,1)[...,None]*5
        tf=cv2.GaussianBlur(toes.astype(np.float32),(9,9),0)[...,None]*up[...,None]
        img[...,:3]=img[...,:3]*(1-tf)+pc*tf
        scol=(200,202,208) if design=='kilian-black' else (28,28,32); shi=(255,255,255) if design=='kilian-black' else (140,140,150)
        for row,y in enumerate(np.arange(60,260,9.0)):
            for x in np.arange((row%2)*4.5,384,9.0):
                if heels[int(y),int(x)]: stud(img,x,y,3.0,scol,shi)
    else:
        for row,y in enumerate(np.arange(150,260,8.0)):
            for x in np.arange((row%2)*4,384,8.0):
                if toes[int(y),int(x)] and ell(165,232,42,17)[int(y),int(x)] | ell(52,208,25,17)[int(y),int(x)]:
                    # small triangle stud
                    pts=np.array([[x,y-3],[x-3,y+2.5],[x+3,y+2.5]],np.int32)
                    tmp=np.zeros((h,w),np.uint8); cv2.fillConvexPoly(tmp,pts,1)
                    img[tmp>0,:3]=img[tmp>0,:3]*0.45+np.array([150,150,158.])*0.55
                    img[int(y-2):int(y),int(x-1):int(x+1),:3]=255
    for (cx,cy) in ((242,146),(132,110)):
        d=np.hypot(xx-cx,yy-cy); img[(d<=5)&al,:3]=(196,24,34); img[(d<=2.2)&al,:3]=(40,30,30)
        img[(d<=5)&(d>3.8)&(yy<cy)&al,:3]=(235,90,95)
    out=np.clip(img,0,255).astype(np.uint8); return out
for d in ('kilian-black','kilian-grey','luisa-white'):
    Image.fromarray(make(d)).save(f'/workspace/scripts_tmp/roy/th-{d}.png')
