# Hairstyle (Kapsel) layers: generated head+hair images registered onto the reference head by the two eyes.
# Out: <out>/<g>/style-<id>.png (+ --s-<tone>, --h-<colour> overlays), <out>/<g>/<item>-keep.png (+ --s-<tone>)
# keep = the part of an item's head band below the chin (neck, collar, hand) without its hair, drawn above the style.
import sys,os,json,glob
import numpy as np,cv2
from PIL import Image
sys.argv=[sys.argv[0]]+[a for a in sys.argv[1:]]
import tones as T
HERE=os.path.dirname(os.path.abspath(__file__)); SRC=f'{HERE}/hairstyles-src'
BANDS=sys.argv[1] if len(sys.argv)>1 else 'assets/avatar-art/worn-bands'; OUT=sys.argv[2] if len(sys.argv)>2 else 'assets/avatar-art/worn-styles'
M=json.load(open(f'{HERE}/meta.json')); EYES=json.load(open(f'{SRC}/eyes.json'))
REF={'male':('top-blueberry-white-tee',[(46,92),(92,99)],147),'female':('top-nike-black-tee',[(77.5,93),(126,90)],146)}
STYLES={'male':{'short':'m-short','wavy':'m-wavy','buzz':'m-fade','afro':'m-afro','curtain':'m-curtain','curtain-short':'m-curtain-short','kuif':'m-kuif','twists':'m-twists'},
        # female: the reference composite re-drawn with the new hair (scripts/worn-bands/female/edits, keyed + registered
        # on the body: f-*-e). The long art hair baked into the torso bands is removed per item by female/clean.py; only
        # those items (female/allow.json) get a keep band, the app shows the art hair with any other top.
        'female':{'bun':'f-bun-e','short':'f-bob-e','long':'f-long-e'}}
FEMALE_ALLOW=json.load(open(f'{HERE}/female/allow.json'))
GENDER=os.environ.get('GENDER')  # only regenerate this set (the other one is kept from styles.json)
ONLY=os.environ.get('ONLY')
def ramp(x,a,b): return np.clip((x-a)/(b-a),0,1)
KR=float(os.environ.get('KR','4')); JAW=float(os.environ.get('JAW','0.4'))
NECK=float(os.environ.get('NECK','0'))
K=float(os.environ.get('K','0'))
def sim(src,dst,k=1.0):
    (a,b),(c,d)=src; (e,f),(g,h)=dst
    s=complex(g-e,h-f)/complex(c-a,d-b)*k; t=complex((e+g)/2,(f+h)/2)-s*complex((a+c)/2,(b+d)/2)
    return np.array([[s.real,-s.imag,t.real],[s.imag,s.real,t.imag]],np.float32)
TONES=json.load(open(f'{HERE}/tones.json')); TDIR=os.environ.get('TDIR','assets/avatar-art/worn-tones')
REF_FACE={'m-curtain','m-curtain-short'}
def face_mask(im):
    l=T.lab(im); sw=T.skin_w(l[...,0],l[...,1],l[...,2],im[...,3])
    sk=cv2.morphologyEx((sw>0.35).astype(np.uint8),cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))
    n,lb,st,_=cv2.connectedComponentsWithStats(sk,8)
    if n>1: sk=(lb==1+np.argmax(st[1:,4])).astype(np.uint8)
    ff=sk.copy(); m=np.zeros((sk.shape[0]+2,sk.shape[1]+2),np.uint8); cv2.floodFill(ff,m,(0,0),1)
    return ((sk>0)|(ff==0))&(im[...,3]>8)
def ref_face(g,key,out,refb,chin):
    """Keep the default boy's own face (shape, eyes, smile, ears); from the generated head only the hair and the
    forehead above the brows (the default forehead is under its curls) are used."""
    rb,r=refb; CH,CW=out.shape[:2]
    base=np.zeros_like(out); h,w=rb.shape[:2]; base[r[1]:r[1]+h,r[0]:r[0]+w]=rb
    ref=REF[g][0]; ent=dict(next((f[1] for f in TONES[g]['files'] if f[0]==f'{ref}-head'),[])); hm=np.zeros((CH,CW),np.float32)
    x,y,w2,h2=ent['h-black']; hm[r[1]+y:r[1]+y+h2,r[0]+x:r[0]+x+w2]=np.array(Image.open(f'{TDIR}/{g}/{ref}-head--h-black.png').convert('RGBA'))[...,3]/255.
    hm=cv2.dilate((hm>0.3).astype(np.uint8),np.ones((3,3),np.uint8))>0
    re=REF[g][1]; ey0=r[1]+(re[0][1]+re[1][1])/2; ed0=abs(re[1][0]-re[0][0])
    yy=np.mgrid[:CH,:CW][0]
    xb=np.mgrid[:CH,:CW][1]; bcx=r[0]+(re[0][0]+re[1][0])/2
    bz=(yy>ey0-0.6*ed0)&(yy<ey0-0.1*ed0)&(abs(xb-bcx)<0.95*ed0)   # the brows share the hair tone mask: keep them
    bf=(base[...,3]>128)&(~hm|bz)&(yy<r[1]+chin+5)&(yy>ey0-0.75*ed0)
    n,lb,st,_=cv2.connectedComponentsWithStats(bf.astype(np.uint8),8); bf=lb==1+np.argmax(st[1:,4])
    # hair = the plain (generated-face) layer's own hair weight
    _,pr,_,phw,_=style_layer(g,key,plain=True); hw=np.zeros((CH,CW),np.float32)
    hw[pr[1]:pr[1]+pr[3],pr[0]:pr[0]+pr[2]]=phw
    xx=np.mgrid[:CH,:CW][1]; ecx=r[0]+(re[0][0]+re[1][0])/2
    brows=(yy>ey0-0.6*ed0)&(abs(xx-ecx)<1.05*ed0)          # the default face's own brows, not the generated ones
    Lg=T.lab(out)[...,0]; hw=hw*~brows*(1-ramp(Lg,52,62))   # light pixels (skin / halo the plain split left in) are no hair
    hair=hw>0.5
    wy=ramp(yy,ey0-0.62*ed0,ey0-0.42*ed0)              # 0: generated forehead, 1: default face
    fore=(out[...,3]>128)&~hair&(yy<ey0-0.42*ed0)        # generated forehead (skin-matched already)
    fa_b=cv2.GaussianBlur(bf.astype(np.float32),(3,3),0)*base[...,3]/255.*wy*(1-ramp(yy,r[1]+chin-3,r[1]+chin+5))  # soft chin edge onto the neck
    fa_g=fore*(out[...,3]/255.)*(1-wy)
    fa=np.clip(fa_b+fa_g,0,1); fc=(base[...,:3]*fa_b[...,None]+out[...,:3]*fa_g[...,None])/np.maximum(fa_b+fa_g,1e-3)[...,None]
    ha=np.clip(hw,0,1)*out[...,3]/255.
    A=ha+fa*(1-ha)
    C=(out[...,:3]*ha[...,None]+fc*(fa*(1-ha))[...,None])/np.maximum(A,1e-3)[...,None]
    # pockets between the new hair and the default face (where its curls were, e.g. the temples): generated pixels
    U=(A>0.5).astype(np.uint8); Uc=cv2.morphologyEx(U,cv2.MORPH_CLOSE,np.ones((11,11),np.uint8))
    ff=Uc.copy(); m=np.zeros((CH+2,CW+2),np.uint8); cv2.floodFill(ff,m,(0,0),1)
    tz=(yy>ey0-0.7*ed0)&(yy<ey0+0.15*ed0)&(abs(xb-bcx)>0.8*ed0)&(abs(xb-bcx)<1.5*ed0)   # temples
    gap=cv2.GaussianBlur(((((Uc>0)|(ff==0))|tz)&(U==0)&(yy<r[1]+chin)).astype(np.float32),(3,3),0)*out[...,3]/255.*(1-A)
    C=(C*A[...,None]+out[...,:3]*gap[...,None])/np.maximum(A+gap,1e-3)[...,None]; A=A+gap
    ref_face.mask=bf
    return np.dstack([C.clip(0,255),A*255]).astype(np.uint8)
def style_layer(g,key,plain=False):
    ref,reyes,chin=REF[g]; r=M[g]['pieces'][ref]['head']; CW,CH=M[g]['canvas']
    dst=[(r[0]+x,r[1]+y) for x,y in reyes]; chinY=r[1]+chin
    im=np.array(Image.open(f'{SRC}/{key}.png').convert('RGBA')).astype(np.float32)
    rgbv=im[...,:3]; a=im[...,3]
    gx=rgbv[...,1]-np.maximum(rgbv[...,0],rgbv[...,2]); rgbv[...,1]-=np.clip(gx,0,None)  # green spill
    se=EYES[key]['eyes']; sm=((se[0][0]+se[1][0])/2,(se[0][1]+se[1][1])/2); dm=((dst[0][0]+dst[1][0])/2,(dst[0][1]+dst[1][1])/2)
    rs=(EYES[key]['chinY']-sm[1])/np.hypot(se[1][0]-se[0][0],se[1][1]-se[0][1]); rr=(chinY-dm[1])/np.hypot(dst[1][0]-dst[0][0],dst[1][1]-dst[0][1])
    A=sim(se,dst,(rr/rs)**K)
    chinY=dm[1]+(EYES[key]['chinY']-sm[1])*np.hypot(A[0,0],A[1,0])  # this face's own chin on the canvas
    pm=np.dstack([rgbv*a[...,None]/255,a])
    w=cv2.warpAffine(pm,A,(CW,CH),flags=cv2.INTER_AREA if abs(A[0,0])<1 else cv2.INTER_CUBIC,borderValue=0)
    al=np.clip(w[...,3],0,255); col=np.where(al[...,None]>1,w[...,:3]*255/np.maximum(al[...,None],1),0)
    out=np.dstack([np.clip(col,0,255),al]).astype(np.uint8)
    l=T.lab(out)
    xx=np.mgrid[:CH,:CW][1]; yy=np.mgrid[:CH,:CW][0]; cx=(dst[0][0]+dst[1][0])/2; ey=(dst[0][1]+dst[1][1])/2; ed=abs(dst[1][0]-dst[0][0])
    # match the face skin to the reference head (lightness + hue), weighted by skin-likeness
    cheek=(abs(xx-cx)<ed*0.55)&(yy>ey+ed*0.25)&(yy<ey+ed*0.8)&(out[...,3]>200)
    rb=np.array(Image.open(f'{BANDS}/{g}/{ref}-head.png').convert('RGBA')); rl=T.lab(rb)
    ry,rx=np.mgrid[:rb.shape[0],:rb.shape[1]]; rcx=(reyes[0][0]+reyes[1][0])/2; rey=(reyes[0][1]+reyes[1][1])/2; red=reyes[1][0]-reyes[0][0]
    rcheek=(abs(rx-rcx)<red*0.55)&(ry>rey+red*0.25)&(ry<rey+red*0.8)&(rb[...,3]>200)
    cs=np.median(l[cheek&(l[...,0]>40)],0); cr=np.median(rl[rcheek&(rl[...,0]>40)],0)
    hh0=np.degrees(np.arctan2(l[...,2],l[...,1])); ch0=np.hypot(l[...,1],l[...,2])
    skl=ramp(l[...,0],cs[0]-25,cs[0]-12)*ramp(ch0,8,14)*ramp(hh0,30,40)*(1-ramp(hh0,72,80))
    l=l+skl[...,None]*(cr-cs)[None,None,:]
    out[...,:3]=T.rgb(l)
    if key in REF_FACE and not plain:  # keep the default boy's own face (shape, eyes, smile); only the generated hair is used
        out=ref_face(g,key,out,(rb,r),chin); l=T.lab(out)
    # chin: the strongest light->dark step under the mouth along the face's centre column (shadow under the chin)
    ED0=np.hypot(A[0,0],A[1,0])*np.hypot(se[1][0]-se[0][0],se[1][1]-se[0][1])
    col=cv2.GaussianBlur(l[...,0],(5,5),0)[:,int(cx)-3:int(cx)+4].mean(1); y0c,y1c=int(ey+ED0*0.9),int(ey+ED0*1.9)
    gr=col[y0c+2:y1c+2]-col[y0c-2:y1c-2]; autoc=y0c+int(np.argmin(gr))
    chinY=autoc
    L,Aa,Bc=l[...,0],l[...,1],l[...,2]
    sw=np.maximum(T.skin_w(L,Aa,Bc,out[...,3]),skl*ramp(L,cr[0]-22,cr[0]-12))
    # hair: dark-ish warm brown, not skin
    hh=np.degrees(np.arctan2(Bc,Aa))
    hw=(out[...,3]>8)*(1-np.clip(sw*2,0,1))*(1-ramp(L,62,72))*(1-ramp(np.hypot(Aa,Bc),45,55))*ramp(np.hypot(Aa,Bc),4,9)
    yy=np.mgrid[:CH,:CW][0]
    ED=np.hypot(A[0,0],A[1,0])*np.hypot(se[1][0]-se[0][0],se[1][1]-se[0][1])
    BLONDE=key.endswith('-e')  # hair-edited reference art (blonde like the art): hair/skin by nearest centroid, not by hue
    if BLONDE:
        F=np.dstack([Aa,Bc,L*0.2]); al_=out[...,3]>200; ch_=np.hypot(Aa,Bc)
        hseed=al_&(L>25)&(((yy<ey-0.95*ED)&(abs(xx-cx)<1.6*ED))|((abs(xx-cx)>1.15*ED)&(yy>ey-0.3*ED)&(yy<ey+0.9*ED)))
        cs_=np.median(F[cheek],0); chh=np.median(F[hseed],0)
        ds=np.linalg.norm(F-cs_,axis=2); dh=np.linalg.norm(F-chh,axis=2); sep=max(np.linalg.norm(cs_-chh),4)
        fr=np.sqrt(((xx-cx)/(1.08*ED))**2+((yy-(ey+0.3*ED))/(1.25*ED))**2)  # face ellipse: <1 skin-ish, >1 hair-ish
        hp=1/(1+np.exp(-((ds-dh)/(0.12*sep+0.5)+8.0*np.clip(fr-1,-0.6,0.6))))
        eyes_=sum(((((xx-ex_)/(0.32*ED))**2+((yy-ey_)/(0.18*ED))**2)<1) for ex_,ey_ in dst)>0
        iris_=(sum((((xx-ex_)**2+(yy-ey_)**2)<(0.2*ED)**2) for ex_,ey_ in dst)>0)&(L<58)
        white_=cv2.dilate((eyes_&(L>74)&(ch_<9)).astype(np.uint8),np.ones((3,3),np.uint8))>0
        brow=np.zeros((CH,CW),bool)
        for ex_,ey_ in dst: brow|=(abs(xx-ex_)<0.5*ED)&(yy>ey_-0.6*ED)&(yy<ey_-0.12*ED)
        brow=brow&(L<36)  # brow strokes keep their drawn brown
        noface=iris_|white_|brow
        # no hair inside the face (forehead highlights), except strands that clearly are hair falling over the face's
        # sides (beside the eyes / cheeks): left out they stayed the art blonde, or turned skin-coloured, next to the cheek
        side=(abs(xx-cx)>0.6*ED)&(yy>ey-1.3*ED)
        strong=np.clip(((ds-dh)/sep-0.3)/0.4,0,1)*side
        hw_e=hp*(out[...,3]>8)*ramp(L,10,16)*(1-ramp(dh,22,30))*(~noface)*np.maximum(ramp(fr,0.9,0.96),strong)
        hw_e=np.where(cv2.morphologyEx((hw_e>0.5).astype(np.uint8),cv2.MORPH_OPEN,np.ones((3,3),np.uint8))>0,hw_e,hw_e*0.3)
        sw_e=(out[...,3]>8)*(1-hw_e)*(~noface)
        hw=hw_e
    cut=chinY-JAW*ED*((xx-cx)/(0.75*ED))**2
    above=(1-ramp(yy,cut-1.5,cut+1.5))*(1-ramp(abs(xx-cx),ED*1.9,ED*2.0))
    above=above*np.where(yy>chinY-24,1-ramp(abs(xx-cx),ED*1.0,ED*1.1),1)*np.where(yy>chinY-9,1-ramp(abs(xx-cx),ED*0.7,ED*0.8),1)
    neck=(1-ramp(yy,chinY+14,chinY+26))*(1-ramp(abs(xx-cx),ED*0.8,ED*0.9))*(yy>=chinY-6)*ramp(np.hypot(Aa,Bc),6,10)*ramp(np.degrees(np.arctan2(Bc,Aa)),28,34)*ramp(L,22,30)
    above=np.maximum(above,neck*NECK)
    if key in REF_FACE and not plain: above=np.maximum(above,ref_face.mask*(yy<=r[1]+chin+2))  # the default face's own chin/cheeks
    hm=cv2.morphologyEx((hw>0.4).astype(np.uint8),cv2.MORPH_OPEN,np.ones((5,5),np.uint8))
    hm=hm*(abs(xx-cx)<ED*2.6)
    if g=='female':  # hair falling below the chin: hair pixels connected to the hair above it
        n,lb,st,_=cv2.connectedComponentsWithStats(hm.astype(np.uint8),8); top=set(k for k in np.unique(lb[(yy<chinY)&(hm>0)]) if k and st[k,4]>200)
        hconn=np.isin(lb,list(top)).astype(np.float32)
        # not the neck/face area directly under the chin
        hconn=cv2.GaussianBlur(cv2.dilate(hconn,np.ones((3,3),np.uint8)),(3,3),0)
        keep=np.maximum(above,hconn*np.clip(hw*1.5,0,1))
    else: keep=above
    out[...,3]=(out[...,3]*keep).astype(np.uint8)
    n,lb,st,_=cv2.connectedComponentsWithStats((out[...,3]>20).astype(np.uint8),8)
    if n>2: big=1+np.argmax(st[1:,4]); out[...,3]=(out[...,3]*cv2.dilate((lb==big).astype(np.uint8),np.ones((3,3),np.uint8))).astype(np.uint8)
    ys,xs=np.where(out[...,3]>4); x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    sl=(slice(y0,y1),slice(x0,x1))
    eyes=sum(((((xx-ex_)/(0.32*ED))**2+((yy-ey_)/(0.18*ED))**2)<1) for ex_,ey_ in dst)>0
    hw=np.maximum(hw*ramp(hh,38,46),(out[...,3]>8)*(1-ramp(L,20,30)))*(~eyes)
    hw=np.maximum(hw,(out[...,3]>8)*(1-np.clip(sw*2,0,1))*ramp(L,60,62)*(1-ramp(L,78,84))*ramp(hh,45,52)*(yy<ey-0.3*ED))  # light tips
    # the face (skin + what it encloses: eyes, mouth, nostrils) is not hair; the brows are
    sk=cv2.morphologyEx((sw>0.35).astype(np.uint8),cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))
    n,lb,st,_=cv2.connectedComponentsWithStats(sk,8)
    if n>1: sk=(lb==1+np.argmax(st[1:,4])).astype(np.uint8)
    ff=sk.copy(); msk=np.zeros((CH+2,CW+2),np.uint8); cv2.floodFill(ff,msk,(0,0),1); face=(sk>0)|(ff==0)
    face=cv2.dilate(face.astype(np.uint8),np.ones((3,3),np.uint8))>0
    if g=="male": hw=(out[...,3]>8)*(~eyes)*1.0  # above the chin, everything but the face is hair
    holes=((ff==0)&(sk==0)).astype(np.uint8); hw=np.where(face,0,hw)
    if g=='male':  # fringe strands enclosed by the forehead skin: holes that touch the hair
        n,lb,st,_=cv2.connectedComponentsWithStats(holes,8); hb=cv2.dilate((hw>0.5).astype(np.uint8),np.ones((5,5),np.uint8))>0
        for k in range(1,n):
            m=lb==k
            if (m&hb).any(): hw=np.where(cv2.dilate(m.astype(np.uint8),np.ones((3,3),np.uint8))>0,np.maximum(hw,(L<45)*1.0),hw)
        for _ in range(3):  # dark strands the skin closing swallowed: grow the hair into dark face pixels next to it
            near=cv2.dilate((hw>0.5).astype(np.uint8),np.ones((5,5),np.uint8))>0
            hw=np.maximum(hw,(near&face&(L<38)&(yy<ey-0.2*ED)&~eyes)*1.0)
    if g=='male':  # skin = the rest (face rim, ears), eye whites + irises excluded
        if key=='m-fade':  # the faded sides are skin with stubble
            shaved=(yy>ey-0.75*ED)&(L>42)&(np.hypot(Aa,Bc)>7)&(hh<75)
            shaved=cv2.morphologyEx(shaved.astype(np.uint8),cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))>0
            hw=hw*(1-cv2.GaussianBlur(shaved.astype(np.float32),(7,7),0))
        hw=cv2.GaussianBlur(hw.astype(np.float32),(3,3),0)
        iris=(sum((((xx-ex_)**2+(yy-ey_)**2)<(0.2*ED)**2) for ex_,ey_ in dst)>0)&(L<58)
        white=eyes&(L>74)&(np.hypot(Aa,Bc)<9)
        white=cv2.dilate(white.astype(np.uint8),np.ones((3,3),np.uint8))>0
        sw=(out[...,3]>8)*(1-hw)*~(iris|white)
    if BLONDE: sw,hw=sw_e,cv2.GaussianBlur(hw_e.astype(np.float32),(3,3),0)
    # female edits: the drawn brows and the eyes, for the overlays in __main__ (brows follow the skin tone, eyes never)
    style_layer.marks=(brow[sl].astype(np.float32),(iris_|white_)[sl]) if BLONDE else None
    return out[sl],[int(x0),int(y0),int(x1-x0),int(y1-y0)],sw[sl],(hw*(out[...,3]>4))[sl],chinY
def keep_band(g,item,extra=()):
    """The item's head band without the old face + hair: the neck under the chin extended straight up behind the new
    face (male). extra: band-sized RGBA arrays (tone overlays) that get the same treatment."""
    im=np.array(Image.open(f'{BANDS}/{g}/{item}-head.png').convert('RGBA')); H,W=im.shape[:2]
    hm=np.zeros((H,W),np.float32)
    ent=dict(next((f[1] for f in TONES[g]['files'] if f[0]==f'{item}-head'),[]))
    if 'h-black' in ent:
        x,y,w,h=ent['h-black']; a=np.array(Image.open(f'{TDIR}/{g}/{item}-head--h-black.png').convert('RGBA'))[...,3]/255.
        hm[y:y+h,x:x+w]=a
    hm=np.clip(hm*1.6,0,1); hm=np.maximum(hm,cv2.dilate(hm,np.ones((3,3),np.uint8))*0.8)
    r=M[g]['pieces'][item]['head']; ref,reyes,chin=REF[g]; rr=M[g]['pieces'][ref]['head']
    cy=rr[1]+chin-r[1]  # reference chin row in this band
    src=int(cy+KR); top=int(cy-40)
    if g=='male': hm[src:]=0  # male hair ends above the chin; below it the mask only catches neck shadow
    def neck_row(y):
        rl=T.lab(im[y:y+1])[0]; rh=np.degrees(np.arctan2(rl[:,2],rl[:,1])); rc=np.hypot(rl[:,1],rl[:,2])
        ok=(im[y,:,3]>200)&(rh>30)&(rh<78)&(rc>12)&(rl[:,0]>30)  # skin only: no collar / hood above the neck
        n,lb,st,_=cv2.connectedComponentsWithStats(ok[None].astype(np.uint8),8)
        return (lb[0]==1+np.argmax(st[1:,4])) if n>1 else ok
    row_ok=neck_row(src)
    xs=np.where(row_ok)[0]
    res=[]
    for k,arr in enumerate((im,)+tuple(extra)):
        out=arr.copy(); out[...,3]=(arr[...,3]*(1-hm)).astype(np.uint8)
        row=out[src].copy()
        if k==0: row[...,3]=np.where(row_ok,255,0)
        else: row[...,3]=np.where(row_ok,row[...,3],0)
        if len(xs):  # a little wider: the torso band's neck top must stay covered
            l0,r0=row[min(xs[0]+2,W-1)].copy(),row[max(xs[-1]-2,0)].copy()
            for d in (0,1,2,3): row[max(xs[0]-d,0)]=l0; row[min(xs[-1]+d,W-1)]=r0
        if g=='female':  # no neck extension: the hair-free torso band (worn-clean) has the neck up behind the new chin
            out[:max(src-2,0)]=0
            for j in range(4): out[src-2+j,:,3]=(out[src-2+j,:,3]*(j+1)/5).astype(np.uint8)
            res.append(out); continue
        out[max(top,0):src]=row[None]; out[:max(top,0)]=0
        for j in range(6):  # soft top of the neck extension
            if top+j>=0: out[top+j,:,3]=(out[top+j,:,3]*(j+1)/7).astype(np.uint8)
        res.append(out)
    return res
def crop_save(path,arr):
    a=arr[...,3]; a[a<6]=0
    if (a>20).sum()<12: return None
    ys,xs=np.where(a>0); x0,y0,x1,y1=xs.min(),ys.min(),xs.max()+1,ys.max()+1
    q=T.kq(arr[y0:y1,x0:x1]); q.save(path,optimize=True,transparency=q.info['transparency'])
    return [int(x0),int(y0),int(x1-x0),int(y1-y0)]
if __name__=='__main__':
    meta=json.load(open(f'{HERE}/styles.json')) if GENDER else {}
    for g in STYLES:
        if not STYLES[g] or (GENDER and g!=GENDER): continue
        os.makedirs(f'{OUT}/{g}',exist_ok=True); meta[g]={'styles':{},'keep':{}}
        for item,P in M[g]['pieces'].items():
            if 'head' not in P or P['cat']=='hat' or (ONLY and ONLY!=item): continue
            if g=='female' and item not in FEMALE_ALLOW: continue
            if not os.path.exists(f'{BANDS}/{g}/{item}-head.png'): continue
            im=np.array(Image.open(f'{BANDS}/{g}/{item}-head.png')); H,W=im.shape[:2]
            ent=dict(next((f[1] for f in TONES[g]['files'] if f[0]==f'{item}-head'),[]))
            keys=[k for k in ent if k.startswith('s-')]; ex=[]
            for k in keys:
                x,y,w,h=ent[k]; z=np.zeros((H,W,4),np.uint8)
                z[y:y+h,x:x+w]=np.array(Image.open(f'{TDIR}/{g}/{item}-head--{k}.png').convert('RGBA')); ex.append(z)
            outs=keep_band(g,item,ex)
            rect=crop_save(f'{OUT}/{g}/{item}-keep.png',outs[0]); ov={}
            for k,o in zip(keys,outs[1:]):
                rr=crop_save(f'{OUT}/{g}/{item}-keep--{k}.png',o)
                if rr: ov[k]=rr
            meta[g]['keep'][item]={'rect':rect,'tones':ov}
        for sid,key in STYLES[g].items():
            im,rect,sw,hw,chinY=style_layer(g,key)
            q=T.kq(im); q.save(f'{OUT}/{g}/style-{sid}.png',optimize=True,transparency=q.info['transparency'])
            l=T.lab(im); ov={}
            hwf=np.clip((hw-0.15)/0.45,0,1); hs=np.median(l[hwf>0.6],0)
            swf=np.clip((sw-0.15)/0.45,0,1)
            if g=='female' and style_layer.marks is not None:
                # skin-light pixels at the hairline / beside the cheeks that the colour split left half hair, half skin:
                # recoloured they showed as a grey patch (Knot, dark hair) or a light streak (Lang stijl): they are skin
                brow,eyes=style_layer.marks
                inner=cv2.erode((im[...,3]>250).astype(np.uint8),np.ones((5,5),np.uint8))>0
                nearskin=(cv2.dilate(((swf>0.6)&inner).astype(np.uint8),np.ones((7,7),np.uint8))>0)&inner&~eyes
                fix=nearskin*np.clip((l[...,0]-hs[0]-10)/10,0,1)*np.clip((sw-0.15)/0.15,0,1)   # some skin evidence: no hair highlights
                hwf=hwf*(1-fix); swf=np.maximum(swf,fix)
                # the drawn brows darken with the skin (a mid-brown brow looked orange on dark skin); soft edge
                swf=np.maximum(swf,cv2.GaussianBlur(cv2.dilate(brow,np.ones((3,3),np.uint8)),(3,3),0)*(~eyes))
            if g=="male":  # skin-light pixels at the hairline: no hair overlay there (recoloured they turn into a light line)
                inner=cv2.erode((im[...,3]>250).astype(np.uint8),np.ones((9,9),np.uint8))>0  # not at the outer silhouette
                nearskin=(cv2.dilate(((sw>0.5)&inner).astype(np.uint8),np.ones((5,5),np.uint8))>0)&inner
                hwf=np.where(nearskin&(np.hypot(l[...,1],l[...,2])>14),hwf*(1-np.clip((l[...,0]-hs[0]-8)/12,0,1)),hwf)
            for t,dstc in T.SKIN.items():
                rr=T.write(f'{OUT}/{g}/style-{sid}--s-{t}.png',im,swf,T.rgb(T.recolour(l,T.SKIN_SRC,dstc,dstc[0]/T.SKIN_SRC[0])))
                if rr: ov['s-'+t]=rr
            for t,dstc in T.HAIR.items():
                if g=='female' and t==T.orig_hair(g): continue  # the edits keep the art's own blonde: drawn as is
                c=float(np.clip((dstc[0]+8)/(hs[0]+8),0.4,1.8))
                rr=T.write(f'{OUT}/{g}/style-{sid}--h-{t}.png',im,hwf,T.rgb(T.recolour(l,hs,dstc,c)))
                if rr: ov['h-'+t]=rr
            meta[g]['styles'][sid]={'rect':rect,'tones':ov}; print(g,sid,rect,'hair src',np.round(hs,1),sorted(ov))
    json.dump(meta,open(f'{HERE}/styles.json','w'),separators=(',',':'))
