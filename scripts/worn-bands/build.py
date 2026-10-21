# Band crops v2 (see scripts/worn-bands/README in repo): registered worn art -> head/torso/jacket/legs/sole/feet pieces.
import cv2, numpy as np, json, os, sys
from PIL import Image
W='/workspace/snapshotx/assets/avatar-art/worn/'
OUT=sys.argv[1] if len(sys.argv)>1 else '/workspace/scripts_tmp/combo/bands/'
reg=json.load(open('/workspace/scripts_tmp/combo/reg2.json'))
REF={'male':'top-blueberry-white-tee','female':'top-nike-black-tee'}
BANDS={'male':dict(h=0.225,b=0.585,f=0.87,s=0.94,hand=0.69,face=0.12),'female':dict(h=0.185,b=0.455,f=0.89,s=0.95,hand=0.61,bhand=0.56,face=0.115)}
D=0.008
LONG={'outer-rossano-trench','outer-bf-fur-coat','outer-paramount-emperor-robe'}
PIECES={'hat':['head'],'shoes':['feet'],'socks':['feet'],'bottom':['legs'],'top':['head','torso','legs'],'outerwear':['head','torso','jacket','legs'],'dress':['head','torso','legs']}
cache='/workspace/scripts_tmp/combo/seg/'
WT,BT='top-blueberry-white-tee','top-nike-black-tee'
OPEN={'male':{'outer-bf-grunge-rose':WT,'outer-blueberry-black-vest':WT,'outer-overtime-varsity':BT,'outer-ploeg-olive-jacket':BT,'outer-ploeg-tan-jacket':WT,'outer-strideon-black-jacket':BT},
      'female':{k:BT for k in ['outer-basisbes-denim-jacket','outer-bf-fur-coat','outer-bf-grunge-rose','outer-blueberry-black-vest','outer-carhartt-black','outer-carhartt-camo','outer-dressx-green','outer-overtime-varsity','outer-ploeg-olive-jacket','outer-ploeg-tan-jacket','outer-strideon-black-jacket']}}
meta={}
def u8(x): return x.clip(0,255).astype(np.uint8)
GREEN_OK=('green','olive','camo','mint','dressx','track-jacket','neon','groningen')   # items that really are green/olive
def unscreen(img):
    # green screen left between arms and body (opaque slivers) and its olive mix with skin: make it transparent
    R,G,Bc=img[...,0],img[...,1],img[...,2]
    g1=np.clip((G-np.maximum(R,Bc)-14)/12,0,1)
    g2=np.clip(((G-Bc)-25)/15,0,1)*np.clip(((G-R)+20)/10,0,1)
    img[...,3]=img[...,3]*(1-np.maximum(g1,g2)); return img
def despill(img):
    # green-screen fringe: within ~4px of the silhouette edge clamp G to max(R,B) and fade strongly green edge pixels
    solid=cv2.erode((img[...,3]>200).astype(np.uint8),np.ones((9,9),np.uint8)); ring=(img[...,3]>0)&(solid==0)
    R,G,Bc=img[...,0],img[...,1],img[...,2]; mx=np.maximum(R,Bc); gk=G-mx
    img[...,1]=np.where(ring&(gk>0),mx,G); img[...,3]=np.where(ring&(gk>18),img[...,3]*np.clip(1-(gk-18)/30,0,1),img[...,3])
    return img
def clean_edges(o):
    # boy bottoms: drop stray slivers left over from the bottom image's own sweater/hands (bits floating beside the hips)
    # and recolour the soft silhouette edge from the solid fabric/skin just inside it (no green-screen fringe around
    # shorts, shins or joggers, whatever the colour of the trousers)
    from scipy.ndimage import distance_transform_edt
    a=o[...,3]; n,cl,st,_=cv2.connectedComponentsWithStats((a>24).astype(np.uint8),8)
    if n>2:
        big=st[1:,4].max(); keep=np.isin(cl,[k for k in range(1,n) if st[k,4]>=0.05*big])
        o[...,3]=np.where(keep|(a<=24)&(cv2.dilate(keep.astype(np.uint8),np.ones((5,5),np.uint8))>0),a,0); a=o[...,3]
    # hips: going up from the thigh the outline may only widen gently (no boxy step where the sweater's hip was)
    H_,W_=a.shape; rws=np.where((a>128).any(1))[0]; zt=rws.min(); zb=int(zt+0.45*(rws.max()-zt)); lim=np.ones((H_,W_),np.float32); xx_=np.arange(W_)
    ext=[(np.where(a[y]>128)[0]) for y in range(zb+1)]
    LL=np.full(zb+1,np.nan); RR=np.full(zb+1,np.nan)
    for y in range(zt,zb+1):
        if len(ext[y]): LL[y],RR[y]=ext[y].min(),ext[y].max()
    for rng,sl in ((range(zb-1,-1,-1),0.35),(range(1,zb+1),0.6)):   # up: hips barely wider than thighs; down: waist -> hip as a curve, not a step
        for y in rng:
            p_=y+1 if sl==0.35 else y-1
            if np.isnan(LL[y]) or np.isnan(LL[p_]): continue
            LL[y]=max(LL[y],LL[p_]-sl); RR[y]=min(RR[y],RR[p_]+sl)
    for y in range(zb+1):
        if not np.isnan(LL[y]): lim[y]=np.clip(np.minimum(xx_-LL[y]+1,RR[y]+1-xx_),0,1)
    o[...,3]=u8(o[...,3]*lim); a=o[...,3]
    # leftover green-screen pixels (solid or soft): not fabric
    R_,G_,B_=[o[...,k].astype(int) for k in range(3)]
    gr=(G_>np.maximum(R_,B_)+4)&(a>0)
    near=cv2.dilate((a<128).astype(np.uint8),np.ones((13,13),np.uint8))>0
    o[...,3]=np.where(gr&near,0,a); a=o[...,3]
    inner=cv2.erode(((a>=250)&~gr).astype(np.uint8),np.ones((5,5),np.uint8))
    if inner.sum()<50: return o
    _,(iy,ix)=distance_transform_edt(inner==0,return_indices=True)
    edge=(a>0)&(inner==0)
    o[...,:3]=np.where(edge[...,None],o[iy,ix,:3],o[...,:3]); return o
def edge_recolor(o):
    # soft silhouette edge takes the colour of the solid shoe just inside it: no light/green cut-out halo, alpha untouched
    from scipy.ndimage import distance_transform_edt
    a=o[...,3]; inner=cv2.erode((a>=250).astype(np.uint8),np.ones((5,5),np.uint8))
    if inner.sum()<50: return o
    _,(iy,ix)=distance_transform_edt(inner==0,return_indices=True)
    rows=np.where((a>0).any(1))[0]; upper=np.zeros_like(a,bool)
    if len(rows): upper[:rows.min()+int(0.45*(rows.max()-rows.min()))]=True   # collar/top only: the sole keeps its dark floor-shadow edge
    edge=(a>0)&(inner==0)&upper; o[...,:3]=np.where(edge[...,None],o[iy,ix,:3],o[...,:3]); return o
for g in ['male','female']:
    RW,RH=reg[g]['ref']; PX,PT,PB=70,60,70; CW,CH=RW+2*PX,RH+PT+PB
    B=BANDS[g]; meta[g]={'canvas':[CW,CH],'pieces':{}}; os.makedirs(OUT+g,exist_ok=True)
    yy=((np.arange(CH)-PT)/RH)[:,None]*np.ones((1,CW)); Y=lambda v:int(PT+v*RH)
    def warp_item(i,dx=0,dy=0):
        a=np.array(Image.open(W+f'{g}/{i}.png').convert('RGBA')); A=np.array(reg[g]['items'][i]['A'],np.float64); A[:,2]+=[PX+dx,PT+dy]
        w=despill(cv2.warpAffine(a,A,(CW,CH),flags=cv2.INTER_LINEAR,borderValue=0).astype(np.float32))
        if not any(k in i for k in GREEN_OK): w=unscreen(w)
        if g=='male' and reg[g]['items'][i].get('how')=='tmpl' and i!=REF[g]: w=fit_body(w)
        return w, A
    FIT={}
    def fit_body(w):
        # Template-registered boy jerseys: the head lines up but the shirt body is drawn wider and off-centre compared
        # with the reference doll every bottom is cut for. Squeeze/shift the body (shoulders down) onto the reference
        # silhouette at hip/hand height so trousers and shorts sit under the shirt like under any other top.
        if 'ref' not in FIT:
            r,_=warp_item(REF[g]); FIT['ref']=r[...,3]>128
        def ext(m,f):
            xs=np.where(m[int(PT+f*RH)])[0]; return xs.min(),xs.max()
        rl,rr=ext(FIT['ref'],0.55); il,ir=ext(w[...,3]>128,0.55)
        s=float(np.clip((rr-rl)/max(ir-il,1),0.85,1.05)); rc=(rl+rr)/2; ic=(il+ir)/2
        t=np.clip((np.arange(CH)-(PT+0.24*RH))/(0.16*RH),0,1)[:,None]   # 0 at the neck -> 1 from mid-chest down
        sy=1+(s-1)*t; cy=ic+(rc-ic)*t*0   # map x around the item centre, then move it to the reference centre
        xs=np.arange(CW)[None,:].astype(np.float32)
        mapx=(ic+(xs-(ic+(rc-ic)*t))/sy).astype(np.float32); mapy=np.repeat(np.arange(CH,dtype=np.float32)[:,None],CW,1)
        return cv2.remap(w,mapx,mapy,cv2.INTER_LINEAR,borderValue=0)
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
        cv2.floodFill(ff,msk,(0,0),1); holes=(1-ff).astype(np.uint8)
        n,hl,st,_=cv2.connectedComponentsWithStats(holes,4)
        small=np.isin(hl,[k for k in range(1,n) if st[k,4]<=400])   # only small gaps inside a hand; not the curl of a hand against the body
        return np.maximum(m,(small&(img[...,3]>200)).astype(np.uint8))
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
            img,SA=warp_item(i,dx=ref_feet_cx-xs.mean(),dy=rb-ys.max()); al=img[...,3]/255.
        hsv=cv2.cvtColor(u8(img[...,:3]),cv2.COLOR_RGB2HSV)
        long_=i in LONG; M={}; RGB={}; hem_=False
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
            lab_=cv2.cvtColor(u8(img[...,:3]),cv2.COLOR_RGB2LAB).astype(np.float32)
            fr=(yy>bb+0.005)&(img[...,3]<235)&((hsv[...,1]<60)|(lab_[...,1]<5))   # pale/greenish semi-transparent pixels around the hands
            t=t*(1-cv2.GaussianBlur(fr.astype(np.float32),(3,3),0))
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
            if cat=='top' and 'jersey' in i and g=='female':   # (male shirts already end on the reference hip line)
                # football shirts hang lower than the reference tee: keep the whole shirt (+ its own arms/hands) down to its hem,
                # minus the image's own trousers (Lab model sampled on the thighs, connected region), so it sits over any
                # bottom's waistband: no cut line / see-through strip at the hips
                labT=cv2.cvtColor(u8(img[...,:3]),cv2.COLOR_RGB2LAB).astype(np.float32)
                cx=int(np.median(np.where(img[Y(bb+0.2),:,3]>200)[0])); smp=labT[Y(bb+0.17):Y(bb+0.27),cx-25:cx+25].reshape(-1,3)
                mu=smp.mean(0); Ci=np.linalg.inv(np.cov(smp.T)+np.eye(3)*6); dd=labT-mu; md=np.einsum('...i,ij,...j->...',dd,Ci,dd)
                # per column: walk up from the thighs while the pixels look like those trousers (2px gaps allowed) = the hem
                hemy=np.full(CW,-1); y0t=Y(bb+0.2); ytop=Y(bb-0.04); TM=9
                for x in range(CW):
                    if img[y0t,x,3]<200 or md[y0t,x]>=TM: continue
                    y=y0t; miss=0
                    while y>ytop:
                        if md[y-1,x]<TM and img[y-1,x,3]>40: miss=0
                        else:
                            miss+=1
                            if miss>2: break
                        y-=1
                    hemy[x]=y+miss
                okh=hemy>=0
                if okh.sum()>10:
                    from scipy.ndimage import median_filter
                    xs_=np.arange(CW); body=img[y0t,:,3]>200; xb=xs_[body]
                    span_=(xs_>=xb.min())&(xs_<=xb.max())   # incl. the gap between the legs
                    hemy=np.where(span_,np.interp(xs_,xs_[okh],hemy[okh]),-1).astype(int)   # seams/shadows on the thighs: from the neighbours
                    hv=median_filter(hemy,41); cap=np.percentile(hemy[okh],30)+8   # the hem runs nearly level: cap columns that stopped low
                    hemy=np.where(span_,np.minimum(np.minimum(hemy,hv+3),cap),-1).astype(int)
                trousers=np.zeros((CH,CW),bool)
                for x in np.where(hemy>=0)[0]: trousers[hemy[x]:,x]=True
                shirt=((img[...,3]>40)&~trousers&(yy<bb+0.16)).astype(np.uint8)
                n,lab=cv2.connectedComponents(shirt); r=Y(bb-0.03)
                ids=set(np.unique(lab[r][shirt[r]>0]))-{0}   # the shirt body crossing the old band line (no specks)
                shirt=cv2.morphologyEx(np.isin(lab,list(ids)).astype(np.uint8),cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
                hem=cv2.GaussianBlur(cv2.erode(shirt,np.ones((3,3),np.uint8)).astype(np.float32),(5,5),0)
                t=np.maximum(t,hem*(yy>=bb-0.04)*(yy<max(bb+0.16,B['hand']+0.03))); hem_=True
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
                BH=B.get('bhand',B['hand'])   # hand height in the bottom images (female: hands stay higher than in the tops)
                from scipy.ndimage import minimum_filter1d, maximum_filter1d
                al=img[...,3]>128; xx=np.arange(CW)
                # the bottom image's own hands (over/beside the hips): fill them with trouser inside the trouser silhouette,
                # drop them outside it. The torso piece brings the real hands; no hand-shaped holes or boxes.
                # "not trousers" = colours unlike the trousers' own (sampled just below the waist, centre): hands, sleeves, shadows
                lab0=cv2.cvtColor(u8(img[...,:3]),cv2.COLOR_RGB2LAB).astype(np.float32)
                ra,rb2=Y(bb+0.01),Y(bb+0.06); xs=np.where(al[(ra+rb2)//2])[0]; pcx=(xs.min()+xs.max())/2; pw=xs.max()-xs.min()
                ps_=lab0[ra:rb2,int(pcx-0.2*pw):int(pcx+0.2*pw)][al[ra:rb2,int(pcx-0.2*pw):int(pcx+0.2*pw)]]
                pmu=ps_.mean(0); pCi=np.linalg.inv(np.cov(ps_.T)+np.eye(3)*10); pd_=lab0-pmu; pmd=np.einsum('...i,ij,...j->...',pd_,pCi,pd_)
                y0,y1=Y(bb-0.08),Y(BH+0.09)
                side=(np.abs(xx-pcx)>0.22*pw)[None,:]
                sk=((pmd>16)|skin_mask(img).astype(bool))&al&side&(rows_:=np.arange(CH))[:,None].__ge__(y0)&(np.arange(CH)[:,None]<Y(BH+0.06))
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
                # hips taper in towards the waist (the bottom image's sweater hid them): nothing white peeks out under the arms
                tw=(rgt[Y(bb)+8]-lft[Y(bb)+8])*(0.07 if g=='male' else 0.0)*np.clip((Y(BH+0.02)-rows)/max(1,Y(BH+0.02)-Y(bb)),0,1)
                lft=lft+tw; rgt=rgt-tw
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
                inzone=(rows[:,None]>=Y(bb)-4)&(rows[:,None]<y1)
                if g=='female': spanf=np.maximum(spanf,cv2.dilate(pcol.astype(np.uint8),np.ones((3,3),np.uint8)).astype(np.float32))   # hand-in-pocket pose: keep real trouser pixels
                L=L*np.where(sk|inzone,spanf,1.0)   # nothing of the bottom image outside the trouser silhouette beside the arms/hands
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
                    c=np.where(pcol[:,x]&(L[:,x]>0.5)&(np.arange(CH)>=Y(bb-0.06))&(np.arange(CH)<Y(bb+(0.06 if g=='male' else 0.12))))[0]   # first clean trouser pixel below the worn sweater + its shadow
                    if len(c)>8: P0[x]=c[0]+4
                okc=~np.isnan(P0); rgbN,LN=rgbL.copy(),L.copy()   # 'legsn': narrow extension (under long-hem football shirts)
                if okc.sum()>10:
                    from scipy.ndimage import median_filter
                    xsv=np.arange(CW); x0e,x1e=xsv[okc].min(),xsv[okc].max()
                    P0=np.interp(xsv,xsv[okc],P0[okc]); P0=median_filter(P0,15); P0=cv2.GaussianBlur(P0.reshape(1,-1),(9,1),0).ravel()
                    for x in range(x0e,x1e+1):
                        p0=int(round(P0[x])); fr=abs(x-(top_l+top_r)/2)/max(1,(top_r-top_l)/2)
                        yt=int(p0-(p0-yT)*(np.clip((0.9-fr)/0.35,0,1) if g=='male' else np.clip((1.02-fr)/0.1,0,1)))       # full height in the middle, tapering to nothing at the hips (rounded, no boxes)
                        # long-hem shirts cover the waist: the narrow variant stays inside the shirt (no trouser hip poking out beside it)
                        ytn=int(p0-(p0-yT)*(np.clip((0.9-fr)/0.35,0,1) if g=='male' else np.clip((0.8-fr)/0.2,0,1)))
                        for (R_,L_,y_) in ((rgbL,L,yt),(rgbN,LN,ytn)):
                            if y_>=p0: continue
                            src=np.clip(2*p0-np.arange(y_,p0),p0,CH-1)        # mirror the fabric below (no vertical streaks)
                            R_[y_:p0,x,:3]=R_[src,x,:3]; R_[y_:p0,x,3]=255; L_[y_:p0+1,x]=1
                L[:Y(bb)+12]=cv2.GaussianBlur(L,(5,1),0)[:Y(bb)+12]   # soft side edges of the extension
                LN[:Y(bb)+12]=cv2.GaussianBlur(LN,(5,1),0)[:Y(bb)+12]
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
                    kf=np.where(low,cv2.GaussianBlur(keep.astype(np.float32),(7,7),0),1.0); L=L*kf; LN=LN*kf
                RGB['legs']=rgbL; RGB['legsn']=rgbN
            if cat=='bottom':   # trousers end feathered just below the shoe-band top; the bare-foot/own-shoe 'sole' band takes over from there
                end=fb+(0.025 if g=='female' else 0.005)
                bare=skin_mask(img).astype(np.float32)*(yy>=fb-0.1)   # bare shins (shorts/skirts) run on down to the shoe
                kf=np.maximum(1-np.clip((yy-end)/0.025,0,1),bare*dn(B['s'])); M['legs']=L*kf; M['sole']=(yy>=fb-0.01)*1.0
                if g=='female' and 'legsn' in RGB: M['legsn']=LN*kf
            else: M['legs']=L; M['sole']=(yy>=B['s'])*1.0
        if 'feet' in ps:
            # the shoe image's own trouser hem = colours like its trousers just above the shoes (Lab Mahalanobis), connected to the band top
            lab3=cv2.cvtColor(u8(img[...,:3]),cv2.COLOR_RGB2LAB).astype(np.float32)
            samp=lab3[Y(fb-0.11):Y(fb-0.07)][img[Y(fb-0.11):Y(fb-0.07),:,3]>230]
            mu=samp.mean(0); C=np.cov(samp.T)+np.eye(3)*4; Ci=np.linalg.inv(C)
            dd=lab3-mu; md=np.einsum('...i,ij,...j->...',dd,Ci,dd)
            FT=fb-(0.06 if g=='female' else 0.03)   # look higher than the band line: the shoe beside the source trouser leg reaches up to its hem
            win=(yy>=FT)&(yy<fb+(0.04 if g=='female' else 0.025))
            grey=((md<9)&(img[...,3]>40)&win).astype(np.uint8)
            grey=cv2.morphologyEx(grey,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
            n,lab=cv2.connectedComponents(grey); top=Y(FT)+1
            ids=set(np.unique(lab[top:top+6][grey[top:top+6]>0]))-{0}
            pants=(cv2.dilate(np.isin(lab,list(ids)).astype(np.uint8),np.ones((5,5),np.uint8))*win).astype(np.uint8)
            ring=cv2.dilate(pants,np.ones((9,9),np.uint8))
            darkedge=(ring>0)&(hsv[...,2]<75)&(hsv[...,1]<70)&(yy<fb+(0.02 if g=='female' else 0.006))
            pants=np.maximum(pants,darkedge.astype(np.uint8))
            soft=(img[...,3]<110)&(hsv[...,2]<80)   # semi-transparent dark floor shadow
            keep=((1-pants)*(1-soft)*(yy>=FT)*(img[...,3]>40)).astype(np.uint8)
            n,cl,st,_=cv2.connectedComponentsWithStats(keep,8)
            big=st[1:,4].max() if n>1 else 0
            keep=np.isin(cl,[k for k in range(1,n) if st[k,4]>=0.08*big]).astype(np.uint8)
            SM=os.path.join(os.path.dirname(os.path.abspath(__file__)),'shoe-masks',g,i+'.png')
            if os.path.exists(SM):
                # hand-made shoe outline for this item: keep exactly the shoe, never the source trouser hem
                sm=cv2.warpAffine(np.array(Image.open(SM).convert('L')),SA,(CW,CH),flags=cv2.INTER_LINEAR,borderValue=0)
                keep=((sm>127)&(img[...,3]>40)).astype(np.uint8)
            M['feet']=cv2.GaussianBlur(keep.astype(np.float32),(3,3),0)   # top edge = the real shoe outline / the source trouser hem (no flat faded cut)
        meta[g]['pieces'][i]={'cat':cat,'long':bool(long_ or cat=='dress')}
        if hem_: meta[g]['pieces'][i]['hem']=True   # shirt hangs to its own hem: bottoms use their 'legsn' band under it
        for nme,m in M.items():
            src=RGB.get(nme,img); o=src.copy(); o[...,3]=src[...,3]*m
            o=u8(o)
            if g=='male' and cat=='bottom' and nme in('legs','legsn'): o=clean_edges(o)
            if nme=='feet': o=edge_recolor(o)
            ys,xs=np.where(o[...,3]>3)
            if not len(ys): continue
            x0,y0,x1,y1=xs.min(),ys.min(),xs.max()+1,ys.max()+1
            Image.fromarray(o[y0:y1,x0:x1]).save(OUT+f'{g}/{i}-{nme}.png')
            meta[g]['pieces'][i][nme]=[int(x0),int(y0),int(x1-x0),int(y1-y0)]
        print(g,i,list(M),flush=True)
json.dump(meta,open(OUT+'meta.json','w'))
