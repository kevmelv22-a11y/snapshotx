"""Skin-tone and hair-colour overlays for the worn bands (lib/avatar/tones.ts, components/avatar/OutfitArt ComboStack).
For every band PNG: skin mask (all bands but soles/feet) and hair mask (head bands; female also the hair that hangs
into the top bands) -> recoloured overlay PNGs, cropped to their pixels, per non-original skin tone / hair colour.
Recolour = Lab transfer from the art's own tone to the target (shading kept). Overlays are drawn right over their band.
usage (repo root): python3 scripts/worn-bands/tones.py [assets/avatar-art/worn-bands assets/avatar-art/worn-tones]
       [--meta scripts/worn-bands/meta.json] [--json scripts/worn-bands/tones.json] [--only substr] [--debug dir]
then: node scripts/gen-worn-tones.mjs"""
import cv2,numpy as np,os,sys,json,glob
from PIL import Image
ARGS=[a for i,a in enumerate(sys.argv[1:],1) if not a.startswith('--') and not sys.argv[i-1].startswith('--')]
SRC,OUT=(ARGS+['assets/avatar-art/worn-bands','assets/avatar-art/worn-tones'][len(ARGS):])[:2]
ONLY=sys.argv[sys.argv.index('--only')+1] if '--only' in sys.argv else None
DBG=sys.argv[sys.argv.index('--debug')+1] if '--debug' in sys.argv else None
# skin: art mid tone (warm) ~ Lab(75,19,31); targets as Lab of the mid tone
SKIN_SRC=(75.,19.,31.)
SKIN={'light':(84,12,22),'tan':(63,19,30),'brown':(50,18,25),'dark':(35,15,17)}
HAIR={'black':(12,1,2),'darkbrown':(24,11,13),'brown':(36,16,25),'blonde':(70,7,40),'auburn':(40,30,36)}
def lab(im):
    l=cv2.cvtColor(im[...,:3],cv2.COLOR_RGB2LAB).astype(np.float32); l[...,0]*=100/255; l[...,1:]-=128; return l
def rgb(l):
    l=l.copy(); l[...,0]*=255/100; l[...,1:]+=128
    return cv2.cvtColor(np.clip(l,0,255).astype(np.uint8),cv2.COLOR_LAB2RGB)
ramp=lambda x,a,b: np.clip((x-a)/(b-a),0,1)
def hue_split(L,A,Bc,al):
    # per-band skin/blonde-hair hue boundary: face centre vs outer hair columns
    h=np.degrees(np.arctan2(Bc,A)); H,W=L.shape; ok=(al>200)&(L>40)&(Bc>16)
    f=ok[int(H*.5):int(H*.7),int(W*.4):int(W*.6)]; hf=np.median(h[int(H*.5):int(H*.7),int(W*.4):int(W*.6)][f])
    side=np.zeros_like(ok); side[int(H*.4):,:int(W*.2)]=True; side[int(H*.4):,int(W*.8):]=True
    hs=h[side&ok&(L>25)]; hh=np.median(hs) if len(hs)>20 else hf+8
    return float(np.clip((hf+hh)/2,hf+2.5,hf+7))
def skin_w(L,A,Bc,al,thr=64.2):
    h=np.degrees(np.arctan2(Bc,A))
    w=ramp(A,7,11)*(1-ramp(A,40,48))*ramp(Bc,14,19)*(1-ramp(Bc,46,52))*ramp(L,28,36)*ramp(h,30,36)*(1-ramp(h,thr-1.2,thr+1.2))
    return w*(al>8)
def hair_w(L,A,Bc,al,g,im,thr=64.8):
    if g=='male':  # dark brown curls
        w=(1-ramp(L,38,46))*ramp(A,3,7)*(1-ramp(A,22,26))*ramp(Bc,5,9)*(1-ramp(Bc,30,36))*ramp(L,4,8)
    else:          # blonde waves
        h=np.degrees(np.arctan2(Bc,A))
        w=ramp(Bc,16,21)*ramp(h,thr-1.2,thr+1.2)*(1-ramp(h,84,90))*ramp(L,22,30)*(1-ramp(L,90,95))
    w=w*(al>8)
    if g=='male':  # curls are blobs; the face outline / lash lines are 1-3 px strokes of the same brown
        core=cv2.morphologyEx((w>0.3).astype(np.uint8),cv2.MORPH_OPEN,np.ones((4,4),np.uint8))
        # keep the hair mass and what sits above mid-face (brows); not the neck / chin shadow below
        n,lb,st,cen=cv2.connectedComponentsWithStats(core,8)
        if n>1:
            big=st[1:,4].max(); H_=core.shape[0]
            core=np.isin(lb,[k for k in range(1,n) if st[k,4]>=0.15*big or cen[k][1]<0.55*H_]).astype(np.uint8)
        w=w*(cv2.dilate(core,np.ones((5,5),np.uint8))>0)
    # drop pupils/irises: dark components touching eye-white
    m=(w>0.3).astype(np.uint8); n,lb,st,_=cv2.connectedComponentsWithStats(m,8)
    white=((L>80)&(np.abs(A)<6)&(np.abs(Bc)<10)).astype(np.uint8)
    keep=np.ones(n,bool); keep[0]=False
    for k in range(1,n):
        if g=='female' and st[k,4]<150: keep[k]=False; continue
        if st[k,4]>600: continue
        comp=(lb==k).astype(np.uint8); ring=cv2.dilate(comp,np.ones((5,5),np.uint8))-comp
        if (white*ring).sum()>0.15*ring.sum() or st[k,4]<6: keep[k]=False
    region=cv2.dilate(keep[lb].astype(np.uint8),np.ones((3,3),np.uint8))
    return w*region
def recolour(l,src,dst,contrast,kab=0.35):
    o=l.copy()
    o[...,0]=dst[0]+(l[...,0]-src[0])*contrast
    o[...,1]=dst[1]+(l[...,1]-src[1])*kab
    o[...,2]=dst[2]+(l[...,2]-src[2])*kab
    return o
CENT={}; FACE={}
def fem_split(L,A,Bc,al,item,band):
    """female: per item skin/hair centroids from the head band (face centre vs outer hair columns), soft nearest-centroid split"""
    H,W=L.shape; F=np.dstack([A,Bc,L*0.2])
    if band=='head' or item not in CENT:
        hp=f'{SRC}/female/{item}-head.png'
        if band!='head' and os.path.exists(hp):
            hi=np.array(Image.open(hp).convert('RGBA')); hl=lab(hi); fem_split(hl[...,0],hl[...,1],hl[...,2],hi[...,3],item,'head')
        elif band=='head':
            ok=(al>200)&(L>40)&(Bc>16)
            # face skin seed: warm (a>15) lit pixels in the middle columns (hat bands are taller: no fixed rows)
            seed=ok&(A>15.5)&(L>50); seed[:, :int(W*.3)]=False; seed[:, int(W*.7):]=False
            if seed.sum()>80:
                cs=np.median(F[seed],0); ys,xs=np.where(seed)
                y0,y1=np.percentile(ys,[8,85]); x0,x1=np.percentile(xs,[10,90]); FACE[item]=(y0,y1,x0,x1)
            else:
                fc=(slice(int(H*.5),int(H*.7)),slice(int(W*.4),int(W*.6))); cs=np.median(F[fc][ok[fc]],0)
            side=np.zeros_like(ok); side[int(H*.4):,:int(W*.2)]=True; side[int(H*.4):,int(W*.8):]=True
            hm=side&ok&(L>25)&(np.hypot(A-cs[0],Bc-cs[1])>3)
            ch=np.median(F[hm],0) if hm.sum()>20 else cs+np.array([-7,-3,-3])
            CENT[item]=(cs,ch)
    cs,ch=CENT.get(item,(np.array([19.,35,14]),np.array([13.,31,10])))
    ds=np.linalg.norm(F-cs,axis=2); dh=np.linalg.norm(F-ch,axis=2); sep=max(np.linalg.norm(cs-ch),4)
    hp_=1/(1+np.exp(-(ds-dh)/(0.12*sep+0.5)))
    chroma=ramp(np.hypot(A,Bc),10,15)*(al>8)
    gs=(1-ramp(np.minimum(ds,dh),22,30))*chroma*ramp(A,7,11)*(1-ramp(A,32,38))
    hh=np.degrees(np.arctan2(Bc,A))
    hw=hp_*(1-ramp(dh,18,26))*ramp(np.hypot(A,Bc),13,18)*(al>8)*ramp(L,8,14)*(1-ramp(hh,78,84))*(1-ramp(np.hypot(A,Bc),48,56))
    if band=='head' and item in FACE:  # no hair inside the face (cheek highlights / blush look like blonde hair)
        y0,y1,x0,x1=FACE[item]; yy,xx=np.mgrid[:H,:W]
        inside=(((yy-(y0+y1)/2)/max((y1-y0)/2,1))**2+((xx-(x0+x1)/2)/max((x1-x0)/2,1))**2)<0.8
        hw=np.where(inside,0,hw); hp_=np.where(inside,0,hp_)
    if band!='head':  # hair in a top band = what hangs down from the head: components touching the band top
        m=(hw>0.4).astype(np.uint8); n,lb,st,_=cv2.connectedComponentsWithStats(m,8)
        top=set(np.unique(lb[:max(4,int(H*.08))]))-{0}
        keep=cv2.dilate(np.isin(lb,list(top)).astype(np.uint8),np.ones((5,5),np.uint8))>0
        hw=np.where(keep,hw,0); hp_=np.where(keep,hp_,0)
    # hair is one big mass (+ strands touching it): small hair-coloured islands (cheek highlights) are skin
    m=(hw>0.5).astype(np.uint8); n,lb,st,_=cv2.connectedComponentsWithStats(m,8)
    if n>1:
        big=max(st[1:,4]); keep=np.isin(lb,[k for k in range(1,n) if st[k,4]>=max(0.15*big,80)])
        isl=cv2.dilate(((m>0)&~keep).astype(np.uint8),np.ones((3,3),np.uint8),iterations=1)>0
        isl&=~cv2.dilate(keep.astype(np.uint8),np.ones((3,3),np.uint8))>0
        hw=np.where(isl,0,hw); hp_=np.where(isl,0,hp_)
    sw=(1-hp_)*gs*ramp(L,26,34)
    return sw,hw
HAIR_SRC={}
def hair_src(g):
    if g in HAIR_SRC: return HAIR_SRC[g]
    ref={'male':'top-blueberry-white-tee','female':'top-nike-black-tee'}[g]
    im=np.array(Image.open(f'{SRC}/{g}/{ref}-head.png').convert('RGBA')); l=lab(im)
    w=hair_w(l[...,0],l[...,1],l[...,2],im[...,3],g,im,hue_split(l[...,0],l[...,1],l[...,2],im[...,3]) if g=='female' else 64.8)>0.6
    HAIR_SRC[g]=tuple(float(v) for v in np.median(l[w],0)); return HAIR_SRC[g]
def orig_hair(g): return {'male':'darkbrown','female':'blonde'}[g]
def kq(rgba,k=256):
    """k-means palette PNG (smooth skin ramps; octree posterised them), alpha in the palette (tRNS)"""
    px=rgba.reshape(-1,4).astype(np.float32); vis=px[:,3]>0
    out=np.zeros(len(px),np.uint8)
    v=px[vis]; u,inv=np.unique(v.astype(np.uint8),axis=0,return_inverse=True)
    if len(u)<=k-1: cent=u.astype(np.float32); lab_=inv.ravel()
    else:
        feat=v*np.array([1,1,1,0.6],np.float32)
        crit=(cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER,12,0.5)
        _,lab_,cent=cv2.kmeans(feat,k-1,None,crit,1,cv2.KMEANS_PP_CENTERS); lab_=lab_.ravel(); cent=cent/np.array([1,1,1,0.6],np.float32)
    out[vis]=lab_+1
    pal=np.zeros((256,4),np.uint8); pal[1:len(cent)+1]=np.clip(np.round(cent),0,255)
    im=Image.fromarray(out.reshape(rgba.shape[:2]),'P'); im.putpalette(pal[:,:3].ravel().tolist())
    im.info['transparency']=bytes(pal[:,3].tolist()); return im
def band_alpha(al):
    """band alpha without the soft seam fade at the band's top/bottom (rows whose max alpha < 1): an overlay drawn
    over a fading band must be opaque where the band fades, else the original colour leaks back (A over A' over B)."""
    a=al.astype(np.float32)/255; H=a.shape[0]; rm=a.max(1,keepdims=True)
    zone=np.zeros((H,1),bool); zone[:int(H*.35)]=True; zone[int(H*.65):]=True
    f=np.where(zone&(rm>0.02)&(rm<0.98),np.clip(a/np.maximum(rm,1e-3),0,1),a)
    return f*255
def write(path,im,w,col):
    ba=band_alpha(im[...,3])/255.; ba=ba*(2-ba)   # thin edges: overlay A over band A' leaks A'(1-A) of the old colour
    a=(ba*255*np.clip(w,0,1)).astype(np.uint8)
    a[a<6]=0
    if a.max()<20 or (a>20).sum()<12: return None
    ys,xs=np.where(a>0); x0,y0,x1,y1=xs.min(),ys.min(),xs.max()+1,ys.max()+1
    os.makedirs(os.path.dirname(path),exist_ok=True)
    im=kq(np.dstack([col,a])[y0:y1,x0:x1])
    im.save(path,optimize=True,transparency=im.info['transparency']); return [int(x0),int(y0),int(x1-x0),int(y1-y0)]
    im=Image.fromarray(np.dstack([col,a])[y0:y1,x0:x1]).quantize(256,method=Image.Quantize.LIBIMAGEQUANT,dither=Image.Dither.NONE) if QOK else Image.fromarray(np.dstack([col,a])[y0:y1,x0:x1]).quantize(256,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE)
    im.save(path,optimize=True); return [int(x0),int(y0),int(x1-x0),int(y1-y0)]
QOK=True
try: Image.new("RGBA",(2,2)).quantize(4,method=Image.Quantize.LIBIMAGEQUANT)
except Exception as e: print("no libimagequant",e); QOK=False
M=json.load(open(sys.argv[sys.argv.index('--meta')+1] if '--meta' in sys.argv else 'scripts/worn-bands/meta.json'))
meta={}
for g in ('male','female'):
    hs=hair_src(g); oh=orig_hair(g); meta[g]={'hairSrc':[round(v,1) for v in hs],'origHair':oh,'files':[]}
    print(g,'hair src',np.round(hs,1),'orig',oh)
    STORE=[]
    for p in sorted(glob.glob(f'{SRC}/{g}/*.png')):
        name=os.path.basename(p)[:-4]
        if ONLY and ONLY not in name: continue
        band=name.rsplit('-',1)[1]
        if band in('sole','feet'): continue
        if band=='jacket' and not M.get('_open',{}).get(f"{g}/{name.rsplit('-',1)[0]}",0)>0: continue  # jacket cutout only used for open jackets
        im=np.array(Image.open(p).convert('RGBA')); l=lab(im); L,A,Bc=l[...,0],l[...,1],l[...,2]; al=im[...,3]
        TOPB=band in('torso','under','jacket')
        item=name.rsplit('-',1)[0]
        if g=='female' and (band=='head' or TOPB):
            sw,hw=fem_split(L,A,Bc,al,item,band)
        if g=='female' and band=='head': thr=hue_split(L,A,Bc,al)
        elif g=='female' and TOPB:
            hh=np.degrees(np.arctan2(Bc,A)); conf=(al>200)&(A>17)&(L>50)&(Bc>20)&(hh<66)
            thr=float(np.median(hh[conf]))+3.2 if conf.sum()>50 else 65.
        else: thr=70.
        if g=='female' and (band=='head' or TOPB): pass
        else:
            sw=skin_w(L,A,Bc,al,thr)
            hw=hair_w(L,A,Bc,al,g,im,thr) if band=='head' else np.zeros_like(sw)
        if band=='head':  # eyes = holes of the face skin with eye-white in them: iris/pupil/lashes are not hair
            sk=(sw>0.35).astype(np.uint8); ff=sk.copy(); msk=np.zeros((sk.shape[0]+2,sk.shape[1]+2),np.uint8)
            cv2.floodFill(ff,msk,(0,0),1); holes=(1-ff).astype(np.uint8)
            n,lb,st,_=cv2.connectedComponentsWithStats(holes,8); white=((L>78)&(np.hypot(A,Bc)<12)).astype(np.uint8)
            eyes=np.isin(lb,[k for k in range(1,n) if st[k,4]<1500 and (white*(lb==k)).sum()>=6])
            hw=np.where(cv2.dilate(eyes.astype(np.uint8),np.ones((3,3),np.uint8))>0,0,hw)
        sw=sw*(1-np.clip(hw*2,0,1))
        if band!='head': sw=sw*np.maximum(ramp(L,40,48),ramp(A,13,16))  # khaki / tan cloth sits at the L of shaded skin; lit body skin is lighter
        # despeckle: skin mask must be part of a reasonably large blob
        m=(sw>0.4).astype(np.uint8); n,lb,st,_=cv2.connectedComponentsWithStats(m,8)
        big=np.isin(lb,[k for k in range(1,n) if st[k,4]>=25]).astype(np.uint8)
        big=cv2.dilate(big,np.ones((3,3),np.uint8)); sw=sw*big
        # firm masks: half-weights mix the original colour back in (mottled skin, greyish hair)
        sw=np.clip((sw-0.15)/0.45,0,1); hw=np.clip((hw-0.15)/0.45,0,1)
        # fill skin gaps (highlights/freckle-like misses) enclosed by skin; not eyes (dark / white) nor hair
        core=(sw>0.35).astype(np.uint8); clo=cv2.morphologyEx(core,cv2.MORPH_CLOSE,np.ones((9,9),np.uint8))
        cand=(clo>0)&(core==0)&(L>45)&(A>8)&(Bc>12)&(hw<0.3)&(al>100)
        sw=np.maximum(sw,cand*0.95)
        if hw.max()>0.3:  # same for hair: specks between strands keep the old colour otherwise
            hc=(hw>0.35).astype(np.uint8); hcl=cv2.morphologyEx(hc,cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))
            hcand=(hcl>0)&(hc==0)&(sw<0.3)&(np.hypot(A,Bc)>12)&(L>8)&(al>60)
            hw=np.maximum(hw,hcand*0.95)
        sw=np.maximum(sw,cv2.dilate(sw.astype(np.float32),np.ones((3,3),np.uint8))*(hw<0.3)*(al<230))  # antialiased rim pixels
        sw=cv2.GaussianBlur(sw.astype(np.float32),(3,3),0)*(al>0)
        STORE.append((name,band,item,im,l,sw,hw))
    # hat heads: skin / hair only where the hatless heads of this set have it (beanie stripes, bucket hats are not
    # skin or hair); the face + chin hand there is skin even when its lighting differs
    CW,CH=M[g]['canvas']; HS=np.zeros((CH,CW),np.float32); HH=np.zeros((CH,CW),np.float32); HN=0
    for name,band,item,im,l,sw,hw in STORE:
        if band!='head' or M[g]['pieces'][item]['cat']=='hat': continue
        r=M[g]['pieces'][item][band]; h,w=sw.shape; sl=(slice(r[1],r[1]+h),slice(r[0],r[0]+w))
        HS[sl]+=(sw>0.4); HH[sl]+=(hw>0.4); HN+=1
    HS/=max(HN,1); HH/=max(HN,1)
    sk_ok=cv2.dilate((HS>0.2).astype(np.uint8),np.ones((7,7),np.uint8)); sk_core=cv2.erode((HS>0.6).astype(np.uint8),np.ones((5,5),np.uint8))
    hr_ok=cv2.dilate((HH>0.15).astype(np.uint8),np.ones((9,9),np.uint8))
    for k,(name,band,item,im,l,sw,hw) in enumerate(STORE):
        if band!='head' or M[g]['pieces'][item]['cat']!='hat': continue
        r=M[g]['pieces'][item][band]; h,w=sw.shape; sl=(slice(r[1],r[1]+h),slice(r[0],r[0]+w))
        L,A,Bc=l[...,0],l[...,1],l[...,2]; hh=np.degrees(np.arctan2(Bc,A))
        skinish=(A>7)&(Bc>10)&(L>30)&(hh>35)&(hh<75)&(im[...,3]>100)
        if g=='male':  # female hat images are posed differently: colour split only (+ the hand below)
            hw=hw*hr_ok[sl]*(sk_core[sl]==0)
            sw=np.maximum(sw*sk_ok[sl],(sk_core[sl]>0)*skinish*(hw<0.3)*0.95)
        if g=='female':  # the chin hand in the band's faded bottom: warmer hue than the blonde hair around it
            low=np.zeros_like(sw,bool); low[int(h*.55):]=True
            hand=low&(A>6)&(Bc>8)&(L>30)&(hh>35)&(hh<62.5)&(im[...,3]>8)
            sw=np.maximum(sw,hand*0.95); hw=np.where(hand,0,hw)
        STORE[k]=(name,band,item,im,l,sw,hw)
    # skin vote on the shared canvas: skin of a body (not skin-coloured cloth: trench, baroque, beige tee) sits where
    # many items show skin; head bands always count as skin
    CW,CH=M[g]['canvas']; V=np.zeros((CH,CW),np.float32); N=np.zeros((CH,CW),np.float32)
    for name,band,item,im,l,sw,hw in STORE:
        if band not in('torso','under','jacket'): continue
        r=M[g]['pieces'][item][band]; h,w=sw.shape; sl=(slice(r[1],r[1]+h),slice(r[0],r[0]+w))
        V[sl]+=(sw>0.4); N[sl]+=(im[...,3]>128)
    vote=V/np.maximum(N,1); allow=((vote>=0.12)&(V>=3)).astype(np.uint8)
    allow=cv2.GaussianBlur(cv2.dilate(allow,np.ones((7,7),np.uint8)).astype(np.float32),(7,7),0)
    if DBG: os.makedirs(DBG,exist_ok=True); Image.fromarray((np.clip(vote*3,0,1)*255).astype(np.uint8)).save(f'{DBG}/_vote-{g}.png')
    for name,band,item,im,l,sw,hw in STORE:
        al=im[...,3]
        if band in('torso','under','jacket'):
            r=M[g]['pieces'][item][band]; h,w=sw.shape; sw=sw*allow[r[1]:r[1]+h,r[0]:r[0]+w]
        out=[]
        for t,dst in SKIN.items():
            r=write(f'{OUT}/{g}/{name}--s-{t}.png',im,sw,rgb(recolour(l,SKIN_SRC,dst,dst[0]/SKIN_SRC[0])))
            if r: out.append(['s-'+t,r])
        if hw.max()>0.3:
            hw=cv2.GaussianBlur(hw.astype(np.float32),(3,3),0)*(al>0)
            for t,dst in HAIR.items():
                if t==oh: continue
                c=float(np.clip((dst[0]+8)/(hs[0]+8),0.4,1.8))
                r=write(f'{OUT}/{g}/{name}--h-{t}.png',im,hw,rgb(recolour(l,hs,dst,c)))
                if r: out.append(['h-'+t,r])
        if out: meta[g]['files'].append([name,out])
        if DBG:
            os.makedirs(DBG,exist_ok=True)
            vis=im[...,:3].copy(); vis[sw>0.4]=(vis[sw>0.4]*0.4+np.array([0,255,0])*0.6).astype(np.uint8); vis[hw>0.4]=(vis[hw>0.4]*0.4+np.array([255,0,255])*0.6).astype(np.uint8)
            Image.fromarray(vis).save(f'{DBG}/{g}-{name}.png')
json.dump(meta,open(sys.argv[sys.argv.index('--json')+1] if '--json' in sys.argv else 'scripts/worn-bands/tones.json','w'),separators=(',',':'))
