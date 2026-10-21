# Boy jersey art is drawn waving (viewer-left arm raised). Rebuild the arms-down base pose: drop the raised arm and
# mirror the hanging arm + sleeve (and the outer torso edge) from the other side about the body centre line.
import numpy as np,cv2,sys,glob,statistics
from PIL import Image
R0='/workspace/sx-jerseys/assets/avatar-art/worn/'
H=int(statistics.median(Image.open(f).size[1] for f in glob.glob(R0+'male/*.png')))
def fix(a):
    h,w=a.shape[:2]; al=a[...,3]>128
    ys,xs=np.where(al); top=ys.min(); bot=ys.max()
    # body extent from the head (the hand is beside/above it): head = alpha around the top of the widest top blob right of the hand
    legs=al[int(bot-0.25*(bot-top)):int(bot-0.05*(bot-top))]; cx=np.where(legs)[1].mean()
    head_top=np.where(al[:, int(cx)-10:int(cx)+10].any(1))[0].min()
    Hb=bot-head_top; neck=int(head_top+0.235*Hb); t=float(__import__('os').environ.get('T','0.1'))*Hb
    W=int(2*cx)+60; o=np.zeros((h,max(w,W),4),np.uint8); o[:,:w]=a
    m=o[:, ::-1]  # mirror about x=(W-1)/2 -> shift so that the mirror axis is cx
    sh=int(round(2*cx))-(o.shape[1]-1); mir=np.roll(m,sh,axis=1)
    if sh<0: mir[:,sh:]=0
    elif sh>0: mir[:,:sh]=0
    x=np.arange(o.shape[1])[None,:]; y=np.arange(h)[:,None]
    side=(x<cx-t)
    out=o.copy()
    # feathered seam (8 px) so the shading/stripes do not show a hard vertical line
    wgt=np.clip((cx-t-x)/8.0+0.5,0,1)*(y>=neck-0.035*Hb)
    o_p=o[...,:3].astype(np.float32)*o[...,3:4]/255; m_p=mir[...,:3].astype(np.float32)*mir[...,3:4]/255
    A=o[...,3].astype(np.float32)*(1-wgt)+mir[...,3].astype(np.float32)*wgt
    C=o_p*(1-wgt[...,None])+m_p*wgt[...,None]
    out[...,:3]=np.where(A[...,None]>0,C*255/np.maximum(A[...,None],1),0).clip(0,255).astype(np.uint8); out[...,3]=A.clip(0,255).astype(np.uint8)
    # above the neck: remove the raised hand/arm left of the head
    hd=al[head_top:neck]; hx=np.where(hd)[1]
    head_l=np.percentile(hx[hx> cx-0.3*Hb],1) if len(hx) else cx-t
    up=(y<neck)&(x<head_l-2); out[up[...,None].repeat(4,2)]=0
    # keep the main body component only
    n,lb,st,_=cv2.connectedComponentsWithStats((out[...,3]>0).astype(np.uint8),8); big=1+np.argmax(st[1:,4]); out[lb!=big]=0
    im=Image.fromarray(out); im=im.crop(im.getchannel('A').getbbox())
    return im.resize((round(im.width*H/im.height),H),Image.LANCZOS), (cx,neck,t,head_l)
if __name__=='__main__':
    for f in sorted(glob.glob('cut/male-*.png')):
        im,info=fix(np.array(Image.open(f).convert('RGBA'))); n=f.split('male-')[1][:-4]
        im.save(f'fixed/male-{n}.png',optimize=True); print(n,im.size,np.round(info,1))
