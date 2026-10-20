import numpy as np,cv2,sys,os
from PIL import Image
sys.path.insert(0,'/workspace/scripts_tmp/roy'); from mask import shoe_mask
W='/workspace/sx-jerseys/assets/avatar-art/worn/'
BASE={'male':'shoes-nike-white','female':'shoes-strideon-panda'}
def parts(a,m,thin=False):
    h,w=m.shape; n,cl,st,_=cv2.connectedComponentsWithStats(m.astype(np.uint8),8)
    comps=sorted([k for k in range(1,n) if st[k,4]>300],key=lambda k:st[k,0])
    out=[]
    for side,k in zip(('L','R'),comps):
        c=cl==k; ys,xs=np.where(c); x0,x1,y0,y1=xs.min(),xs.max(),ys.min(),ys.max()
        yb=np.full(w,-1)
        for x in range(x0,x1+1):
            col=np.where(c[:,x])[0]
            if len(col): yb[x]=col.max()
        sole=np.zeros_like(c); t=0.27*(y1-y0)
        top=np.full(w,np.nan)
        for x in range(x0,x1+1):
            if yb[x]>=0:
                ch=yb[x]-np.where(c[:,x])[0].min()
                tt=t if (ch>1.6*t or not thin) else 0.55*ch   # thin heel/back columns: keep the upper above the sole
                top[x]=yb[x]-tt
        if thin:   # smooth sole line across columns (no stair steps)
            v=top[x0:x1+1]; k=np.ones(9)/9; pad=np.pad(v,4,mode='edge'); top[x0:x1+1]=np.convolve(pad,k,'valid')
        for x in range(x0,x1+1):
            if yb[x]>=0: sole[int(top[x]):yb[x]+1,x]=True
        sole&=c; out.append(dict(side=side,c=c,sole=sole,up=c&~sole,box=(x0,y0,x1,y1)))
    return out
def stud(img,cx,cy,r,col,hi):
    # small metal stud: dark rim, lit top-left
    yy,xx=np.mgrid[int(cy-r-1):int(cy+r+2),int(cx-r-1):int(cx+r+2)]
    d=np.hypot(xx-cx,yy-cy); ok=(d<=r)&(yy>=0)&(yy<img.shape[0])&(xx>=0)&(xx<img.shape[1])
    sh=np.clip(1-np.hypot(xx-(cx-r*0.4),yy-(cy-r*0.4))/(r*1.4),0,1)
    for k in range(3):
        v=col[k]*(0.55+0.45*sh)+hi[k]*sh**3
        img[yy[ok],xx[ok],k]=np.clip(v[ok],0,255)
def make(g,design):
    a=np.array(Image.open(W+f'{g}/{BASE[g]}.png').convert('RGBA')); m=shoe_mask(a); P=parts(a,m)
    img=a.astype(np.float32); hsv=cv2.cvtColor(a[...,:3],cv2.COLOR_RGB2HSV); V=hsv[...,2].astype(np.float32)
    if g=='female':   # plain white low top: paint out the base shoe's black side panel
        from fmask import female_shoe
        m,pan=female_shoe(a)
        src=a[...,:3].copy()
        rgb=cv2.inpaint(src,pan.astype(np.uint8),6,cv2.INPAINT_TELEA)
        img[...,:3]=np.where(pan[...,None],rgb,img[...,:3])
        V=cv2.cvtColor(np.clip(img[...,:3],0,255).astype(np.uint8),cv2.COLOR_RGB2HSV)[...,2].astype(np.float32)
        P=parts(a,m,thin=True)
    sc=1.0 if g=='male' else 0.85
    for p in P:
        up=p['up']; x0,y0,x1,y1=p['box']; wv=x1-x0; hv=y1-y0
        shade=np.clip(V/235.0,0,1.15)
        if design in('kilian-black','kilian-grey'):
            base=np.array([24,24,27.]) if design=='kilian-black' else np.array([92,94,98.])
            hl=np.array([70,70,76.]) if design=='kilian-black' else np.array([150,152,156.])
            col=base[None,None,:]*shade[...,None]+hl[None,None,:]*np.clip(shade-0.95,0,1)[...,None]*3
            # laces stay dark grey, a patent black toe cap
            img[...,:3]=np.where(up[...,None],col,img[...,:3])
            toe=up.copy(); xx=np.arange(img.shape[1])[None,:]; yy=np.arange(img.shape[0])[:,None]
            if p['side']=='L': toe&=(xx<x0+0.3*wv)
            else: toe&=(yy>y0+0.62*hv)
            pc=np.array([12,12,14.])[None,None,:]*shade[...,None]+np.array([120,120,130.])[None,None,:]*np.clip(shade-1.0,0,1)[...,None]*4
            tf=cv2.GaussianBlur(toe.astype(np.float32),(7,7),0)[...,None]*up[...,None]
            img[...,:3]=img[...,:3]*(1-tf)+pc*tf
            # studs over the outer heel quarter
            scol=(196,198,204) if design=='kilian-black' else (30,30,34); shi=(255,255,255) if design=='kilian-black' else (150,150,160)
            r=2.0*sc; step=6.0*sc
            for row,y in enumerate(np.arange(y0+0.18*hv,y1-0.30*hv,step)):
                for x in np.arange(x1-0.32*wv+(row%2)*step/2,x1-2,step):
                    if up[int(y),int(x)] and up[int(min(y+r+1,y1)),int(x)]: stud(img,x,y,r,scol,shi)
        if design=='luisa-white':
            xx=np.arange(img.shape[1])[None,:]; yy=np.arange(img.shape[0])[:,None]
            toe=up.copy()
            if p['side']=='L': toe&=(xx<x0+0.34*wv)&(yy>y0+0.35*hv)
            else: toe&=(yy>y0+0.6*hv)&(xx>x0+0.15*wv)&(xx<x1-0.15*wv)
            r=1.7*sc; step=5.0*sc
            for row,y in enumerate(np.arange(y0,y1,step)):
                for x in np.arange(x0+(row%2)*step/2,x1,step):
                    if toe[int(y),int(x)]: stud(img,x,y,r,(214,214,218),(255,255,255))
        # ROYAUMS signature: red ring at the top eyelet
        ys,xs=np.where(up); ty=ys.min(); tx=int(np.median(xs[ys<ty+4]))
        cy,cx=ty+(5 if g=='male' else (12 if p['side']=='L' else 8))*sc,tx
        yy,xx=np.mgrid[0:img.shape[0],0:img.shape[1]]; d=np.hypot(xx-cx,yy-cy)
        ring=(d<=2.6*sc)&up; img[ring,0]=196; img[ring,1]=24; img[ring,2]=34
        hole=(d<=1.1*sc)&up; img[hole,:3]=40
    return np.clip(img,0,255).astype(np.uint8)
if __name__=='__main__':
    for g in ('male','female'):
        for d in ('kilian-black','kilian-grey','luisa-white'):
            Image.fromarray(make(g,d)).save(f'/workspace/scripts_tmp/roy/{g}-{d}.png')
