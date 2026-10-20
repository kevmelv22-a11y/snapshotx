import cv2, numpy as np, glob, os, json
from PIL import Image
W='/workspace/snapshotx/assets/avatar-art/worn/'
REF={'male':'top-blueberry-white-tee','female':'top-nike-black-tee'}
def load(p): return np.array(Image.open(p).convert('RGBA'))
def gray(a):
    al=a[...,3:4]/255.; return cv2.cvtColor((a[...,:3]*al+128*(1-al)).astype(np.uint8),cv2.COLOR_RGB2GRAY)
sift=cv2.SIFT_create(4000); bf=cv2.BFMatcher()
res={}
for g in ['male','female']:
    r=load(W+g+f'/{REF[g]}.png'); kr,dr=sift.detectAndCompute(gray(r),(r[...,3]>128).astype(np.uint8)); res[g]={'_ref':[r.shape[1],r.shape[0]]}
    for p in sorted(glob.glob(W+g+'/*.png')):
        i=os.path.basename(p)[:-4]; a=load(p)
        k,d=sift.detectAndCompute(gray(a),(a[...,3]>128).astype(np.uint8))
        m=[x for x,y in bf.knnMatch(d,dr,k=2) if x.distance<0.75*y.distance]
        src=np.float32([k[x.queryIdx].pt for x in m]); dst=np.float32([kr[x.trainIdx].pt for x in m])
        M,inl=cv2.estimateAffinePartial2D(src,dst,method=cv2.RANSAC,ransacReprojThreshold=2.0,maxIters=5000)
        sc=float(np.hypot(M[0,0],M[1,0])); n=int(inl.sum())
        res[g][i]={'M':M.tolist(),'inl':n}; print(g,i,f'scale {sc:.3f} rot {np.degrees(np.arctan2(M[1,0],M[0,0])):.2f} t {M[0,2]:.1f},{M[1,2]:.1f} inl {n}/{len(m)}')
json.dump(res,open('/workspace/scripts_tmp/combo/reg.json','w'))
