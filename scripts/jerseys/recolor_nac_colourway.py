# New colourways of the NAC Breda shirt (yellow body, black trim/crest) by recolouring ONLY the shirt pixels, for the worn
# art and every band crop (same geometry as NAC -> same rects / registration); Kast thumbnail via thumb_clean.py.
# usage (repo root): REF=assets/avatar-art/worn/<g>/top-nac-jersey.png recolor_nac_colourway.py in.png out.png body_rgb trim_rgb [debug.png]
# (MVV Maastricht: 215,20,30 / 255,255,255; Fortuna Sittard: 255,214,0 / 0,133,62; soles copied as is; then tones.py, hairstyles.py keep, thumb_clean.py)
import sys,os,numpy as np,cv2
from PIL import Image
def tolab(c): return cv2.cvtColor(np.uint8([[c]]),cv2.COLOR_RGB2LAB)[0,0].astype(np.float32)
def recolour(rgba,body,trimc,dbg=None,refs=None):
    rgb=np.ascontiguousarray(rgba[...,:3]); al=rgba[...,3]
    hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV); H,S,V=[hsv[...,k].astype(np.float32) for k in range(3)]
    lab=cv2.cvtColor(rgb,cv2.COLOR_RGB2LAB).astype(np.float32)
    core=((H>=21)&(H<=34)&(S>170)&(V>60)&(al>8)).astype(np.uint8)
    core=cv2.morphologyEx(core,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
    n,lb,st,_=cv2.connectedComponentsWithStats(core,8)
    if n<=1: return rgba.copy(),None
    big=st[1:,4].max(); keep=[k for k in range(1,n) if st[k,4]>=12]
    yel=np.isin(lb,keep)
    hull=cv2.morphologyEx(yel.astype(np.uint8),cv2.MORPH_CLOSE,np.ones((25,25),np.uint8))>0
    near=cv2.dilate(hull.astype(np.uint8),np.ones((17,17),np.uint8))>0
    # soft body weight: yellow hue around the shirt hue (hair strands are more orange H~16 / less saturated)
    w_y=np.clip(1-(np.abs(H-27)-5)/4,0,1)*np.clip((S-90)/50,0,1)*near
    # trim: dark neutral pixels hugging the shirt, not below the hem (jeans)
    mx=rgb.max(2).astype(int); mn=rgb.min(2).astype(int)
    tcore=(V<125)&((mx-mn)<70)&((S<150)|(V<30))&(al>0)
    hairish=(H>=12)&(H<=25)&(S>45)&(S<215)&(V>105)&(al>0)   # blonde strands / chin hand next to the shirt
    nohair=cv2.dilate(hairish.astype(np.uint8),np.ones((5,5),np.uint8))==0
    tcore=tcore&(nohair|(cv2.erode(tcore.astype(np.uint8),np.ones((3,3),np.uint8))>0))
    dark=tcore|((V<100)&(H>=20)&(H<=40)&(al>0)&(cv2.dilate(tcore.astype(np.uint8),np.ones((5,5),np.uint8))>0))
    yx=cv2.dilate(yel.astype(np.uint8),np.ones((1,15),np.uint8))>0
    hh=rgb.shape[0]; rows=np.arange(hh)[:,None]
    cb0=np.where(yel.any(0),hh-1-np.argmax(yel[::-1],0),-1); cbx=np.where(yx.any(0),hh-1-np.argmax(yx[::-1],0),-1)
    colbot=cb0
    yb=int(np.where(yel.any(1))[0].max()); lim=np.where(colbot<yb-40,colbot+16,colbot-1)
    ww=11; yl=yel.astype(np.uint8); kl=np.zeros((1,2*ww+1),np.uint8); kl[0,ww:]=1; kr=np.zeros((1,2*ww+1),np.uint8); kr[0,:ww+1]=1
    both=(cv2.dilate(yl,kl)>0)&(cv2.dilate(yl,kr)>0)   # yellow on both sides: a stripe, not the shadow under the hem
    hz=cv2.dilate(yl,np.ones((1,13),np.uint8))>0
    trim=dark&near&((rows<=lim[None,:])|(hz&(rows<yb-8))|both)
    trim=trim&(cv2.dilate(yel.astype(np.uint8),np.ones((17,17),np.uint8))>0)
    ka=np.zeros((9,1),np.uint8); ka[:5]=1   # anchor at the centre: yellow 1-4 px above
    above=cv2.dilate(yl,ka,anchor=(0,4))>0
    hem=(rows>yb-25)&(((rows>cb0[None,:])&(cb0[None,:]>=yb-30))|(above&~both))   # shadow under the hem / denim
    trim=trim&~hem&~((rows>yb-25)&~tcore)   # dark olive shading at the hem staircase is body, not trim
    w_y=w_y*(1-trim*np.clip((135-V)/35,0,1))   # dark (shadowed) yellow inside the trim is trim
    # soft trim weight: also the antialiased rim between trim and yellow
    w_d=cv2.GaussianBlur(trim.astype(np.float32),(3,3),0)*(1-w_y)*np.clip((150-V)/40,0,1)
    w_d=np.maximum(w_d,trim*1.0)*(1-w_y)
    ref=refs[0] if refs is not None else np.median(lab[yel],0); tb=tolab(body)
    nl=lab.copy(); nl[...,0]=np.clip(lab[...,0]-ref[0]+tb[0],0,255); nl[...,1]=tb[1]+(lab[...,1]-ref[1])*0.3; nl[...,2]=tb[2]+(lab[...,2]-ref[2])*0.3
    nb=cv2.cvtColor(nl.clip(0,255).astype(np.uint8),cv2.COLOR_LAB2RGB).astype(np.float32)
    tt=tolab(trimc); refd=refs[1] if refs is not None else (np.median(lab[trim],0) if trim.sum()>20 else np.array([40,128,128],np.float32))
    tl=lab.copy()
    if tt[0]>200: tl[...,0]=np.clip(tt[0]-np.clip(refd[0]-lab[...,0],0,40)*0.6+np.clip(lab[...,0]-refd[0],0,90)*-0.15,0,255)
    else: tl[...,0]=np.clip(tt[0]+(lab[...,0]-refd[0])*1.2,0,255)
    tl[...,1]=tt[1]; tl[...,2]=tt[2]
    ntr=cv2.cvtColor(tl.clip(0,255).astype(np.uint8),cv2.COLOR_LAB2RGB).astype(np.float32)
    out=rgb.astype(np.float32); a_y=w_y[...,None]; a_d=w_d[...,None]
    out=out*(1-a_y-a_d)+nb*a_y+ntr*a_d
    res=rgba.copy(); res[...,:3]=out.clip(0,255).astype(np.uint8)
    vis=None
    if dbg is not None:
        vis=rgb.copy(); vis[w_y>0.5]=(vis[w_y>0.5]*0.3+np.array([0,0,255])*0.7).astype(np.uint8); vis[w_d>0.5]=(vis[w_d>0.5]*0.3+np.array([255,0,0])*0.7).astype(np.uint8)
    recolour.last=(np.median(lab[yel],0),np.median(lab[trim],0))
    return res,vis
if __name__=='__main__':
    src,dst=sys.argv[1:3]; body=tuple(map(int,sys.argv[3].split(','))); trimc=tuple(map(int,sys.argv[4].split(',')))
    im=Image.open(src); rgba=np.array(im.convert('RGBA'))
    refs=None
    if os.environ.get('REF'):   # same Lab reference for every crop of one gender: measured on its full worn image
        recolour(np.array(Image.open(os.environ['REF']).convert('RGBA')),body,trimc); refs=recolour.last
    res,vis=recolour(rgba,body,trimc,dbg=True if len(sys.argv)>5 else None,refs=refs)
    Image.fromarray(res,'RGBA').save(dst,optimize=True)
    if vis is not None: Image.fromarray(vis).save(sys.argv[5])
    print(dst)
