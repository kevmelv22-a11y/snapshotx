# post-pass on fixarm output: rebuild the viewer-left shoulder+sleeve+arm as a mirror of the good right side about the head axis
import numpy as np,glob,os
from PIL import Image
YC=int(os.environ.get('YC','168')); Y0=int(os.environ.get('Y0','155')); Y1=int(os.environ.get('Y1','699')); D=int(os.environ.get('D','78'))
def fix(im):
    a=np.array(im.convert('RGBA')).astype(np.float32); al=a[...,3]>128; h,w=al.shape
    xs=np.where(al[20:140].any(0))[0]; ax=0.5*(xs.min()+xs.max())
    W=max(w,int(2*ax)+2); o=np.zeros((h,W,4),np.float32); o[:,:w]=a
    x=np.arange(W); mx=np.round(2*ax-x).astype(int); ok=(mx>=0)&(mx<W)
    mir=np.zeros_like(o); mir[:,ok]=o[:,mx[ok]]
    wx=np.clip((ax-D-x)/8+0.5,0,1)[None,:]; y=np.arange(h)[:,None]; wy=np.clip((y-Y0)/6,0,1)*np.clip((Y1-y)/6,0,1)
    wg=(wx*wy)[...,None]
    pa=o[...,3:]*(1-wg)+mir[...,3:]*wg
    pc=(o[...,:3]*o[...,3:]*(1-wg)+mir[...,:3]*mir[...,3:]*wg)/np.maximum(pa,1)
    out=np.concatenate([pc,pa],2).clip(0,255).astype(np.uint8)
    # inner shoulder (collar side, logos stay): clip anything above the mirrored shoulder contour
    for xx in range(int(ax-D-8),int(ax-30)):
        m=int(round(2*ax-xx)); col=o[YC:260,m,3]>128
        if m>=W or not col.any(): continue
        out[:YC+np.argmax(col),xx][np.arange(YC+np.argmax(col))>=YC]=0
    import cv2
    n,lb,st,_=cv2.connectedComponentsWithStats((out[...,3]>8).astype(np.uint8),8)
    if n>2: out[lb!=1+np.argmax(st[1:,4])]=0   # stray bits of the old raised sleeve
    r=Image.fromarray(out); r=r.crop(r.getchannel('A').getbbox())
    return r.resize((round(r.width*h/r.height),h),Image.LANCZOS) if r.height!=h else r, ax
for f in sorted(glob.glob('fixed/male-*.png')):
    im,ax=fix(Image.open(f)); im.save(f.replace('fixed/','fixed2/'),optimize=True); print(f,ax,im.size)
