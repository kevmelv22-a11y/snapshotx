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
def despill(img):
    # green-screen fringe: within ~4px of the silhouette edge clamp G to max(R,B) and fade strongly green edge pixels
    solid=cv2.erode((img[...,3]>200).astype(np.uint8),np.ones((9,9),np.uint8)); ring=(img[...,3]>0)&(solid==0)
    R,G,Bc=img[...,0],img[...,1],img[...,2]; mx=np.maximum(R,Bc); gk=G-mx
    img[...,1]=np.where(ring&(gk>0),mx,G); img[...,3]=np.where(ring&(gk>18),img[...,3]*np.clip(1-(gk-18)/30,0,1),img[...,3])
    return img
for g in ['male','female']:
    RW,RH=reg[g]['ref']; PX,PT,PB=70,60,70; CW,CH=RW+2*PX,RH+PT+PB
    B=BANDS[g]; meta[g]={'canvas':[CW,CH],'pieces':{}}; os.makedirs(OUT+g,exist_ok=True)
    yy=((np.arange(CH)-PT)/RH)[:,None]*np.ones((1,CW)); Y=lambda v:int(PT+v*RH)
    def warp_item(i,dx=0,dy=0):
        a=np.array(Image.open(W+f'{g}/{i}.png').convert('RGBA')); A=np.array(reg[g]['items'][i]['A'],np.float64); A[:,2]+=[PX+dx,PT+dy]
        return despill(cv2.warpAffine(a,A,(CW,CH),flags=cv2.INTER_LINEAR,borderValue=0).astype(np.float32)), A
    REFC,_=warp_item(REF[g]) if REF[g] in reg[g]['items'] else (None,None)
    ra=REFC[...,3]>128; rb=np.where(ra.any(1))[0].max()
    fy=np.where(ra[Y(B['f']):])[0]; fx=np.where(ra[Y(B['f']):])[1]; ref_feet_cx=fx.mean()
    dn=lambda c,d=D: 1-np.clip((yy-c)/(2*d),0,1)
    def skin_mask(img):
        lab=cv2.cvtColor(u8(img[...,:3]),cv2.COLOR_RGB2LAB).astype(np.float32)
        al=img[...,3]>128; row=Y(B['face']); xs=np.where(al[row])[0]; cx=int(xs.mean())
        patch=lab[row-4:row+5,cx-4:cx+5].reshape(-1,3); ref=np.median(patch,0)
        d=np.sqrt(0.3*(lab[...,0]-ref[0])**2+(lab[...,1]-ref[1])**2+(lab[...,2]-ref[2])**2)
        m=((d<20)&al).astype(np.uint8); m=cv2.morphologyEx(m,cv2.MORPH_OPEN,np.ones((3,3),np.uint8)); m=cv2.dilate(m,np.ones((5,5),np.uint8))
        # fill holes (shaded back of a hand fell outside the colour range and left a square gap in the torso piece)
        m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((7,7),np.uint8)); ff=m.copy(); msk=np.zeros((m.shape[0]+2,m.shape[1]+2),np.uint8)
        cv2.floodFill(ff,msk,(0,0),1); return np.maximum(m,(1-ff).astype(np.uint8))
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
        if cat=='hat' and g=='female':
            xs=np.where(img[Y(hb),:,3]>128)[0]; hcx=(xs.min()+xs.max())/2; hhw=(xs.max()-xs.min())/2
            side=(np.abs(np.arange(CW)-hcx)>0.55*hhw)[None,:]   # long hair hangs beside the face/neck/hand
            hair=((hsv[...,2]>95)&(img[...,3]>40)&side&(yy>=hb-0.02)&(yy<0.36)).astype(np.uint8)   # hat images wear the dark start tee: bright = hair
            hair=cv2.morphologyEx(hair,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
            n,lab,st,_=cv2.connectedComponentsWithStats(hair,8)
            hair=np.isin(lab,[k for k in range(1,n) if st[k,4]>150 and st[k,1]<=Y(hb)+2]).astype(np.uint8)
            hair=cv2.GaussianBlur(cv2.morphologyEx(hair,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8)).astype(np.float32),(7,7),0)
            M['head']=np.maximum(M['head'],hair*dn(0.33,0.015))
        if 'torso' in ps:
            sk=skin_mask(img).astype(np.float32)
            t=(yy>=hb-2*D)*np.maximum(dn(bb),sk*(yy<B['hand']))     # its own hands come with the torso
            t0=t.copy()   # before the grey-jeans drop (that also eats faded denim; the jacket cutout keeps it)
            if cat!='dress':
                # never show the base trousers below a short top: drop grey-jeans pixels connected to the band bottom
                grey=((hsv[...,1]<55)&(hsv[...,2]>75)&(hsv[...,2]<205)&(img[...,3]>40)&(yy>=bb-0.06)&(yy<bb+3*D)).astype(np.uint8)
                n,lab=cv2.connectedComponents(grey); r=Y(bb)+1
                ids=set(np.unique(lab[r-2:r+2][grey[r-2:r+2]>0]))-{0}
                jeans=cv2.dilate(np.isin(lab,list(ids)).astype(np.uint8),np.ones((3,3),np.uint8)).astype(np.float32)
                t=t*(1-jeans*(1-sk))
                # light/colourful tops: also drop the dark shadow strip their hem casts on those trousers (it showed as a grey band under the shirt)
                ya,yb=Y(bb-0.1),Y(bb-0.05); smp=(img[ya:yb,:,3]>200)&(sk[ya:yb]==0)
                if smp.sum()>50 and (hsv[ya:yb][...,2][smp]<90).mean()<0.3:
                    dk=((hsv[...,2]<110)&(hsv[...,1]<90)&(img[...,3]>20)&(yy>=bb-0.035)&(yy<bb+3*D)).astype(np.uint8)
                    n,lab=cv2.connectedComponents(np.maximum(dk,(jeans>0).astype(np.uint8)))
                    ids=set(np.unique(lab[jeans>0]))-{0}
                    shadow=(np.isin(lab,list(ids))&(dk>0)).astype(np.float32)
                    t=t*(1-cv2.GaussianBlur(cv2.dilate(shadow,np.ones((3,3),np.uint8)),(3,3),0)*(1-sk))
            if cat=='outerwear':
                sm=np.load(cache+f'{g}-{i}.npy'); a0=np.array(reg[g]['items'][i]['A'],np.float64); a0[:,2]+=[PX,PT]
                up=cv2.warpAffine(np.maximum(sm[0],sm[2]),a0,(CW,CH)); up=cv2.GaussianBlur(cv2.dilate((up>128).astype(np.float32),np.ones((7,7),np.uint8)),(5,5),0)
                t=np.maximum(t,(yy>=hb-2*D)*up*(yy<bb+0.08)); t0=np.maximum(t0*(yy<bb-0.01),t)
            M['torso']=t
            if cat in('top','dress'):
                # 'under': the chest of a top for use beneath an open jacket (no arms/hands/hair that would poke out around the jacket)
                row=Y(hb+0.1); xs=np.where(img[row,:,3]>128)[0]; cx=(xs.min()+xs.max())/2; w=xs.max()-xs.min()
                col=np.clip((0.3*w-np.abs(np.arange(CW)-cx))/6,0,1)[None,:]
                M['under']=t*col*(1-sk)*(yy>=hb+0.01)
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
                M['jacket']=t0*(1-inner*(1-sk))   # the jacket image's own hands stay (never cut out as 'inner shirt')
                meta.setdefault('_open',{})[f'{g}/{i}']=round(float(inner.sum())/RH/RW,4)
        if 'legs' in ps:
            L=(yy>=bb-2*D)*dn(B['s']); RGB['legs']=img.copy()
            if cat=='bottom':
                from scipy.ndimage import minimum_filter1d, maximum_filter1d
                al=img[...,3]>128; xx=np.arange(CW)
                # the bottom image's own hands (over/beside the hips): fill them with trouser inside the trouser silhouette,
                # drop them outside it. The torso piece brings the real hands; no hand-shaped holes or boxes.
                # "not trousers" = colours unlike the trousers' own (sampled just below the waist, centre): hands, sleeves, shadows
                lab0=cv2.cvtColor(u8(img[...,:3]),cv2.COLOR_RGB2LAB).astype(np.float32)
                ra,rb2=Y(bb+0.01),Y(bb+0.06); xs=np.where(al[(ra+rb2)//2])[0]; pcx=(xs.min()+xs.max())/2; pw=xs.max()-xs.min()
                ps_=lab0[ra:rb2,int(pcx-0.2*pw):int(pcx+0.2*pw)][al[ra:rb2,int(pcx-0.2*pw):int(pcx+0.2*pw)]]
                pmu=ps_.mean(0); pCi=np.linalg.inv(np.cov(ps_.T)+np.eye(3)*10); pd_=lab0-pmu; pmd=np.einsum('...i,ij,...j->...',pd_,pCi,pd_)
                y0,y1=Y(bb-0.08),Y(B['hand']+0.09)
                side=(np.abs(xx-pcx)>0.22*pw)[None,:]
                sk=((pmd>16)|skin_mask(img).astype(bool))&al&side&(rows_:=np.arange(CH))[:,None].__ge__(y0)&(np.arange(CH)[:,None]<Y(B['hand']+0.06))
                sk=cv2.morphologyEx(sk.astype(np.uint8),cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
                sk=cv2.dilate(sk,np.ones((5,5),np.uint8)).astype(bool)
                pants=al&~sk
                # trouser side edges: straight lines fitted on rows where no hand/sleeve touches that edge
                rows=np.arange(CH); lft=np.full(CH,np.nan); rgt=np.full(CH,np.nan); vl=[]; vr=[]
                pcol=pants&(pmd<16)   # trouser-coloured only (not the sweater the bottom image wears above it)
                for y in range(Y(bb)+3,y1):
                    xs=np.where(pcol[y])[0]
                    if len(xs)<=10: continue
                    lft[y],rgt[y]=xs.min(),xs.max(); ks=np.where(sk[y])[0]
                    if not len(ks) or ks.min()>lft[y]+4 or ks.max()<lft[y]-40: vl.append(y)
                    if not len(ks) or ks.max()<rgt[y]-4 or ks.min()>rgt[y]+40: vr.append(y)
                    # a hand right on the edge: only rows where it doesn't border the edge count
                    if len(ks) and ((ks<=lft[y]+4)&(ks>=lft[y]-40)).any() and y in vl: vl.remove(y)
                    if len(ks) and ((ks>=rgt[y]-4)&(ks<=rgt[y]+40)).any() and y in vr: vr.remove(y)
                def fit(e,v):
                    v=np.array(v)
                    if len(v)<8: v=np.where(~np.isnan(e))[0]
                    p=np.polyfit(v,e[v],1); return np.polyval(p,rows)
                lft=fit(lft,vl)-1; rgt=fit(rgt,vr)+1
                span=(xx[None,:]>=lft[:,None])&(xx[None,:]<=rgt[:,None])&(rows[:,None]>=y0)&(rows[:,None]<y1)
                span|=al&((rows[:,None]<y0)|(rows[:,None]>=y1))
                hole=(sk&span).astype(np.uint8)
                rgbL=img.copy()
                # fill from the nearest trouser pixel in the same row (inpainting bled skin colour in), then soften
                fill=img[...,:3].copy(); hole=cv2.dilate(hole,np.ones((5,5),np.uint8))&span.astype(np.uint8)
                for y in np.where(hole.any(1))[0]:
                    src=np.where(pcol[y])[0]
                    if not len(src): continue
                    hx=np.where(hole[y])[0]; j=np.clip(np.searchsorted(src,hx),0,len(src)-1); j2=np.clip(j-1,0,len(src)-1)
                    near=np.where(np.abs(src[j]-hx)<np.abs(src[j2]-hx),src[j],src[j2]); fill[y,hx]=img[y,near,:3]
                fb_=cv2.GaussianBlur(fill,(7,7),0); hm=cv2.GaussianBlur(hole.astype(np.float32),(5,5),0)[...,None]
                rgbL[...,:3]=np.where(hole[...,None]>0,fb_*hm+fill*(1-hm),img[...,:3])
                rgbL[...,3]=np.where(hole>0,255,img[...,3])
                spanf=cv2.GaussianBlur(span.astype(np.float32),(5,5),0)
                L=L*np.where(sk,spanf,1.0)
                # the hem of the top the bottom image wears: feathered cut (no per-column steps)
                cut=np.zeros((CH,CW),np.float32)
                for x in range(CW):
                    if HEM[x]>=0: cut[:HEM[x]+7,x]=1
                cut=cv2.GaussianBlur(cv2.GaussianBlur(cut,(1,9),0),(9,1),0)
                L=L*(1-cut)
                # extend the trousers' waistband up under the top (no hole above the pants of a lower-hemmed top), inside the silhouette only
                yT=Y(bb-0.045); top_l,top_r=lft[Y(bb)+8],rgt[Y(bb)+8]
                P0=np.full(CW,np.nan)
                for x in range(int(top_l)+2,int(top_r)-1):
                    c=np.where(pcol[:,x]&(L[:,x]>0.5)&(np.arange(CH)>=Y(bb-0.06))&(np.arange(CH)<Y(bb+0.06)))[0]   # first clean trouser pixel below the worn sweater + its shadow
                    if len(c)>8: P0[x]=c[0]+4
                okc=~np.isnan(P0)
                if okc.sum()>10:
                    from scipy.ndimage import median_filter
                    xsv=np.arange(CW); x0e,x1e=xsv[okc].min(),xsv[okc].max()
                    P0=np.interp(xsv,xsv[okc],P0[okc]); P0=median_filter(P0,15); P0=cv2.GaussianBlur(P0.reshape(1,-1),(9,1),0).ravel()
                    for x in range(x0e,x1e+1):
                        p0=int(round(P0[x])); fr=abs(x-(top_l+top_r)/2)/max(1,(top_r-top_l)/2)
                        yt=int(p0-(p0-yT)*np.clip((0.9-fr)/0.35,0,1))       # full height in the middle, tapering to nothing at the hips (rounded, no boxes)
                        if yt>=p0: continue
                        rgbL[yt:p0,x,:3]=rgbL[p0,x,:3]; rgbL[yt:p0,x,3]=255; L[yt:p0+1,x]=1
                L[:Y(bb)+12]=cv2.GaussianBlur(L,(5,1),0)[:Y(bb)+12]   # soft side edges of the extension
                # the bottom image's own shoes: keep only trouser-coloured (or bare-leg) pixels connected to the leg above, feathered
                lab3=cv2.cvtColor(u8(rgbL[...,:3]),cv2.COLOR_RGB2LAB).astype(np.float32)
                ya,yb=Y(fb-0.12),Y(fb-0.06); samp=lab3[ya:yb][(rgbL[ya:yb,:,3]>230)&~skin_mask(img)[ya:yb].astype(bool)]
                low=(yy>=fb-0.06)
                if len(samp)>50:
                    mu=samp.mean(0); Ci=np.linalg.inv(np.cov(samp.T)+np.eye(3)*6); dd=lab3-mu; md=np.einsum('...i,ij,...j->...',dd,Ci,dd)
                    legish=((md<12)|skin_mask(img).astype(bool))&(rgbL[...,3]>40)
                    keep=(legish|~low).astype(np.uint8)&(rgbL[...,3]>40)
                    n,cl=cv2.connectedComponents(keep.astype(np.uint8),connectivity=4)
                    ids=set(np.unique(cl[Y(fb-0.1)][keep[Y(fb-0.1)]>0]))-{0}
                    keep=np.isin(cl,list(ids)).astype(np.uint8)
                    keep=cv2.morphologyEx(keep,cv2.MORPH_OPEN,np.ones((5,5),np.uint8))
                    L=L*np.where(low,cv2.GaussianBlur(keep.astype(np.float32),(7,7),0),1.0)
                RGB['legs']=rgbL
            if cat=='bottom':   # trousers end feathered just below the shoe-band top; the bare-foot/own-shoe 'sole' band takes over from there
                end=fb+(0.025 if g=='female' else 0.005)
                bare=skin_mask(img).astype(np.float32)*(yy>=fb-0.1)   # bare shins (shorts/skirts) run on down to the shoe
                L=L*np.maximum(1-np.clip((yy-end)/0.025,0,1),bare*dn(B['s'])); M['legs']=L; M['sole']=(yy>=fb-0.01)*1.0
            else: M['legs']=L; M['sole']=(yy>=B['s'])*1.0
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
            M['feet']=np.clip((yy-(fb-2*D))/0.012,0,1)*cv2.GaussianBlur(keep.astype(np.float32),(3,3),0)   # soft top edge: no hard boot-shaft/cuff line over the trousers
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
