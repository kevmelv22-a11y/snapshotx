# Band crops v2 (see scripts/worn-bands/README in repo): registered worn art -> head/torso/jacket/legs/sole/feet pieces.
import cv2, numpy as np, json, os, sys
from PIL import Image
W='/workspace/snapshotx/assets/avatar-art/worn/'
OUT=sys.argv[1] if len(sys.argv)>1 else '/workspace/scripts_tmp/combo/bands/'
reg=json.load(open('/workspace/scripts_tmp/combo/reg2.json'))
REF={'male':'top-blueberry-white-tee','female':'top-nike-black-tee'}
BANDS={'male':dict(h=0.225,b=0.585,f=0.87,s=0.94,hand=0.69,face=0.12),'female':dict(h=0.185,b=0.455,f=0.89,s=0.95,hand=0.56,face=0.115)}
D=0.008
LONG={'outer-rossano-trench','outer-bf-fur-coat','outer-paramount-emperor-robe'}
PIECES={'hat':['head'],'shoes':['feet'],'socks':['feet'],'bottom':['legs'],'top':['head','torso','legs'],'outerwear':['head','torso','jacket','legs'],'dress':['head','torso','legs']}
cache='/workspace/scripts_tmp/combo/seg/'
WT,BT='top-blueberry-white-tee','top-nike-black-tee'
OPEN={'male':{'outer-bf-grunge-rose':WT,'outer-blueberry-black-vest':WT,'outer-overtime-varsity':BT,'outer-ploeg-olive-jacket':BT,'outer-ploeg-tan-jacket':WT,'outer-strideon-black-jacket':BT},
      'female':{k:BT for k in ['outer-basisbes-denim-jacket','outer-bf-fur-coat','outer-bf-grunge-rose','outer-blueberry-black-vest','outer-carhartt-black','outer-carhartt-camo','outer-dressx-green','outer-overtime-varsity','outer-ploeg-olive-jacket','outer-ploeg-tan-jacket','outer-strideon-black-jacket']}}
meta={}
def u8(x): return x.clip(0,255).astype(np.uint8)
for g in ['male','female']:
    RW,RH=reg[g]['ref']; PX,PT,PB=70,60,70; CW,CH=RW+2*PX,RH+PT+PB
    B=BANDS[g]; meta[g]={'canvas':[CW,CH],'pieces':{}}; os.makedirs(OUT+g,exist_ok=True)
    yy=((np.arange(CH)-PT)/RH)[:,None]*np.ones((1,CW)); Y=lambda v:int(PT+v*RH)
    def warp_item(i,dx=0,dy=0):
        a=np.array(Image.open(W+f'{g}/{i}.png').convert('RGBA')); A=np.array(reg[g]['items'][i]['A'],np.float64); A[:,2]+=[PX+dx,PT+dy]
        return cv2.warpAffine(a,A,(CW,CH),flags=cv2.INTER_LINEAR,borderValue=0).astype(np.float32), A
    REFC,_=warp_item(REF[g]) if REF[g] in reg[g]['items'] else (None,None)
    ra=REFC[...,3]>128; rb=np.where(ra.any(1))[0].max()
    fy=np.where(ra[Y(B['f']):])[0]; fx=np.where(ra[Y(B['f']):])[1]; ref_feet_cx=fx.mean()
    dn=lambda c,d=D: 1-np.clip((yy-c)/(2*d),0,1)
    def skin_mask(img):
        lab=cv2.cvtColor(u8(img[...,:3]),cv2.COLOR_RGB2LAB).astype(np.float32)
        al=img[...,3]>128; row=Y(B['face']); xs=np.where(al[row])[0]; cx=int(xs.mean())
        patch=lab[row-4:row+5,cx-4:cx+5].reshape(-1,3); ref=np.median(patch,0)
        d=np.sqrt(0.3*(lab[...,0]-ref[0])**2+(lab[...,1]-ref[1])**2+(lab[...,2]-ref[2])**2)
        m=((d<20)&al).astype(np.uint8); m=cv2.morphologyEx(m,cv2.MORPH_OPEN,np.ones((3,3),np.uint8)); return cv2.dilate(m,np.ones((5,5),np.uint8))
    # hem profile of the top every bottom image wears (black hoodie / black tee): from the light-trousers bottom image
    hi,_=warp_item('bottom-white-cargo'); hsv=cv2.cvtColor(u8(hi[...,:3]),cv2.COLOR_RGB2HSV)
    dark=((hsv[...,2]<85)&(hi[...,3]>100)&(yy<B['b']+0.12)).astype(np.uint8)
    n,lab=cv2.connectedComponents(dark); sx=np.where(dark[Y(B['b']-0.12)])[0]; seed=lab[Y(B['b']-0.12),int(np.median(sx))]
    top=(lab==seed); HEM=np.full(CW,-1)
    for x in range(CW):
        c=np.where(top[:,x])[0]
        if len(c): HEM[x]=c.max()
    for i,it in sorted(reg[g]['items'].items()):
        cat=it['cat']; ps=PIECES.get(cat)
        if not ps: continue
        img,_=warp_item(i); al=img[...,3]/255.
        hb,bb,fb=B['h'],B['b'],B['f']
        if cat in('shoes','socks'):  # stand on the reference floor, centred on the reference feet
            m=(img[...,3]>128)&(yy>=fb); ys,xs=np.where(m)
            img,_=warp_item(i,dx=ref_feet_cx-xs.mean(),dy=rb-ys.max()); al=img[...,3]/255.
        hsv=cv2.cvtColor(u8(img[...,:3]),cv2.COLOR_RGB2HSV)
        long_=i in LONG; M={}; RGB={}
        HD=0.05 if g=='female' else D
        if 'head' in ps: M['head']=1-np.clip((yy-hb)/(2*HD),0,1)
        if 'torso' in ps:
            sk=skin_mask(img).astype(np.float32)
            t=(yy>=hb-2*D)*np.maximum(dn(bb),sk*(yy<B['hand']))     # its own hands come with the torso
            if cat!='dress':
                # never show the base trousers below a short top: drop grey-jeans pixels connected to the band bottom
                grey=((hsv[...,1]<55)&(hsv[...,2]>75)&(hsv[...,2]<205)&(img[...,3]>40)&(yy>=bb-0.06)&(yy<bb+3*D)).astype(np.uint8)
                n,lab=cv2.connectedComponents(grey); r=Y(bb)+1
                ids=set(np.unique(lab[r-2:r+2][grey[r-2:r+2]>0]))-{0}
                jeans=cv2.dilate(np.isin(lab,list(ids)).astype(np.uint8),np.ones((3,3),np.uint8)).astype(np.float32)
                t=t*(1-jeans*(1-sk))
            if cat=='outerwear':
                sm=np.load(cache+f'{g}-{i}.npy'); a0=np.array(reg[g]['items'][i]['A'],np.float64); a0[:,2]+=[PX,PT]
                up=cv2.warpAffine(np.maximum(sm[0],sm[2]),a0,(CW,CH)); up=cv2.GaussianBlur(cv2.dilate((up>128).astype(np.float32),np.ones((7,7),np.uint8)),(5,5),0)
                t=np.maximum(t,(yy>=hb-2*D)*up*(yy<bb+0.08))
            M['torso']=t
            if cat=='outerwear':
                # Open jackets (curated): the inner shirt = pixels matching the inner-tee reference, connected to the chest centre.
                inner=np.zeros((CH,CW),np.float32); ref_id=OPEN[g].get(i)
                if ref_id:
                    rimg,_=warp_item(ref_id)
                    l1=cv2.cvtColor(u8(img[...,:3]),cv2.COLOR_RGB2LAB).astype(np.float32); l2=cv2.cvtColor(u8(rimg[...,:3]),cv2.COLOR_RGB2LAB).astype(np.float32)
                    d=np.sqrt(0.5*(l1[...,0]-l2[...,0])**2+(l1[...,1]-l2[...,1])**2+(l1[...,2]-l2[...,2])**2)
                    row=Y(hb+0.1); xs=np.where(img[row,:,3]>128)[0]; cx=int((xs.min()+xs.max())/2); w=xs.max()-xs.min()
                    sim=((cv2.GaussianBlur(d,(5,5),0)<16)&(np.abs(np.arange(CW)-cx)<w*0.24)[None,:]&(yy>hb-0.01)&(yy<bb+0.02)).astype(np.uint8)
                    n,lab=cv2.connectedComponents(sim); cand=lab[row-15:row+15,cx-6:cx+7]; ids=set(np.unique(cand[cand>0]))
                    inner=np.isin(lab,list(ids)).astype(np.uint8)
                    inner=cv2.GaussianBlur(cv2.morphologyEx(inner,cv2.MORPH_CLOSE,np.ones((9,9),np.uint8)).astype(np.float32),(5,5),0)
                M['jacket']=t*(1-inner)
                meta.setdefault('_open',{})[f'{g}/{i}']=round(float(inner.sum())/RH/RW,4)
        if 'legs' in ps:
            L=(yy>=bb-2*D)*dn(B['s']); RGB['legs']=img.copy()
            if cat=='bottom':
                sk=cv2.dilate(skin_mask(img),np.ones((7,7),np.uint8)); L=L*(1-sk*(yy<B['hand']))   # hands come from the torso source
                cut=np.zeros((CH,CW),np.float32)
                for x in range(CW):
                    if HEM[x]>=0: cut[:HEM[x]+7,x]=1
                L=L*(1-cut)
                # extend the trousers' waistband up under the top (no hole above the pants of a lower-hemmed top)
                rgbL=img.copy(); yT=Y(bb-0.045)
                for x in range(CW):
                    if HEM[x]<0: continue
                    c=np.where((L[:,x]>0.9)&(img[:,x,3]>200)&(np.arange(CH)>HEM[x]))[0]
                    if not len(c) or c[0]>HEM[x]+0.05*RH: continue
                    p0=c[0]+3; rgbL[yT:p0,x,:3]=img[p0,x,:3]; rgbL[yT:p0,x,3]=255; L[yT:p0,x]=1
                RGB['legs']=rgbL
            M['legs']=L; M['sole']=(yy>=B['s'])*1.0
        if 'feet' in ps:
            # the shoe image's own trouser hem = colours like its trousers just above the shoes (Lab Mahalanobis), connected to the band top
            lab3=cv2.cvtColor(u8(img[...,:3]),cv2.COLOR_RGB2LAB).astype(np.float32)
            samp=lab3[Y(fb-0.11):Y(fb-0.07)][img[Y(fb-0.11):Y(fb-0.07),:,3]>230]
            mu=samp.mean(0); C=np.cov(samp.T)+np.eye(3)*4; Ci=np.linalg.inv(C)
            dd=lab3-mu; md=np.einsum('...i,ij,...j->...',dd,Ci,dd)
            win=(yy>=fb-2*D)&(yy<fb+(0.04 if g=='female' else 0.025))
            grey=((md<9)&(img[...,3]>40)&win).astype(np.uint8)
            grey=cv2.morphologyEx(grey,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
            n,lab=cv2.connectedComponents(grey); top=Y(fb-2*D)+1
            ids=set(np.unique(lab[top:top+6][grey[top:top+6]>0]))-{0}
            pants=(cv2.dilate(np.isin(lab,list(ids)).astype(np.uint8),np.ones((5,5),np.uint8))*win).astype(np.uint8)
            ring=cv2.dilate(pants,np.ones((9,9),np.uint8))
            darkedge=(ring>0)&(hsv[...,2]<75)&(hsv[...,1]<70)&(yy<fb+(0.02 if g=='female' else 0.006))
            pants=np.maximum(pants,darkedge.astype(np.uint8))
            soft=(img[...,3]<110)&(hsv[...,2]<80)   # semi-transparent dark floor shadow
            keep=((1-pants)*(1-soft)*(yy>=fb-2*D)*(img[...,3]>40)).astype(np.uint8)
            n,cl,st,_=cv2.connectedComponentsWithStats(keep,8)
            big=st[1:,4].max() if n>1 else 0
            keep=np.isin(cl,[k for k in range(1,n) if st[k,4]>=0.08*big]).astype(np.uint8)
            M['feet']=(yy>=fb-2*D)*cv2.GaussianBlur(keep.astype(np.float32),(3,3),0)
        meta[g]['pieces'][i]={'cat':cat,'long':bool(long_ or cat=='dress')}
        for nme,m in M.items():
            src=RGB.get(nme,img); o=src.copy(); o[...,3]=src[...,3]*m
            o=u8(o); ys,xs=np.where(o[...,3]>3)
            if not len(ys): continue
            x0,y0,x1,y1=xs.min(),ys.min(),xs.max()+1,ys.max()+1
            Image.fromarray(o[y0:y1,x0:x1]).save(OUT+f'{g}/{i}-{nme}.png')
            meta[g]['pieces'][i][nme]=[int(x0),int(y0),int(x1-x0),int(y1-y0)]
        print(g,i,list(M),flush=True)
json.dump(meta,open(OUT+'meta.json','w'))
