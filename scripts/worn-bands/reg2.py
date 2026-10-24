import cv2, numpy as np, glob, os, json
from PIL import Image
W='/workspace/snapshotx/assets/avatar-art/worn/'
REF={'male':'top-blueberry-white-tee','female':'top-nike-black-tee'}
sift=json.load(open('/workspace/scripts_tmp/combo/reg.json'))
def load(p): return np.array(Image.open(p).convert('RGBA'))
def gray(a):
    al=a[...,3:4]/255.; return cv2.cvtColor((a[...,:3]*al+128*(1-al)).astype(np.uint8),cv2.COLOR_RGB2GRAY).astype(np.float32)
def bands(cat,g):
    if cat=='hat': return [(0.14,0.85)]
    if cat in('shoes','socks'): return [(0.0,0.84)]
    if cat=='bottom': return [(0.0,0.42 if g=='female' else 0.5)]
    if cat=='dress': return [(0.0,0.17),(0.93,1.0)]
    return [(0.0,0.17),(0.62,1.0)]
out={}; P=90
for g in ['male','female']:
    r=load(W+g+f'/{REF[g]}.png'); RH,RW=r.shape[:2]
    Rp=cv2.copyMakeBorder(gray(r),P,P,P,P,cv2.BORDER_CONSTANT,value=128)
    out[g]={'ref':[RW,RH],'items':{}}
    for p in sorted(glob.glob(W+g+'/*.png')):
        i=os.path.basename(p)[:-4]; a=load(p); cat=i.split('-')[0]; cat={'outer':'outerwear'}.get(cat,cat)
        M=np.array(sift[g][i]['M']); inl=sift[g][i]['inl']; sc=np.hypot(M[0,0],M[1,0]); rot=abs(np.degrees(np.arctan2(M[1,0],M[0,0])))
        # count inliers again from log is lost; accept SIFT if geometry plausible and translation small
        ok=inl>=18 and 0.9<sc<1.2 and rot<1.5 and abs(M[1,2])<30
        best=None
        for s in np.arange(0.90,1.20,0.01):
            I=cv2.resize(a,(round(a.shape[1]*s),round(a.shape[0]*s)),interpolation=cv2.INTER_AREA)
            G=gray(I); h,w=G.shape; m=np.zeros_like(G)
            for y0,y1 in bands(cat,g): m[int(y0*h):int(y1*h)]=1
            m*= (I[...,3]>20)
            m=cv2.dilate(m,np.ones((9,9),np.uint8))  # include silhouette edges
            if G.shape[0]>Rp.shape[0] or G.shape[1]>Rp.shape[1]: continue
            res=cv2.matchTemplate(Rp,G,cv2.TM_CCORR_NORMED,mask=m)
            res[~np.isfinite(res)]=0
            _,v,_,loc=cv2.minMaxLoc(res)
            if best is None or v>best[0]: best=(v,s,loc[0]-P,loc[1]-P)
        v,s,tx,ty=best
        if ok: A=[[float(M[0,0]),float(M[0,1]),float(M[0,2])],[float(M[1,0]),float(M[1,1]),float(M[1,2])]]; how='sift'
        else: A=[[s,0,tx],[0,s,ty]]; how='tmpl'
        out[g]['items'][i]={'A':A,'how':how,'cat':cat}
        print(g,i,how,f'sift s{sc:.3f} | tmpl s{s:.2f} t{tx},{ty} v{v:.4f}')
json.dump(out,open('/workspace/scripts_tmp/combo/reg2.json','w'))
