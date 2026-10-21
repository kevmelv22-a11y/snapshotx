# Girl Zwart coachjack: 1) reg.py keys + registers the regenerated worn image (gen1.jpg) onto the old one; 2) girl_bands.py --write cuts torso/jacket/legs bands; 3) clean.py + girl_clean_fix.py; 4) tones.
import cv2,numpy as np
from PIL import Image
g=np.array(Image.open('gen1.jpg').convert('RGB')).astype(np.float32)
R,G,B=g[...,0],g[...,1],g[...,2]
gk=G-np.maximum(R,B)
al=np.clip(1-(gk-20)/40,0,1)  # green key
mx=np.maximum(R,B); g[...,1]=np.where(gk>0,mx,G)  # despill
o=np.array(Image.open('/workspace/sx-jerseys/assets/avatar-art/worn/female/outer-strideon-black-jacket.png').convert('RGBA')).astype(np.float32)
H,W=o.shape[:2]
# initial: scale by height of silhouette
ys=np.where(al.max(1)>0.5)[0]; oy=np.where(o[...,3].max(1)>128)[0]
s=(oy[-1]-oy[0])/(ys[-1]-ys[0])
xs=np.where(al.max(0)>0.5)[0]; ox=np.where(o[...,3].max(0)>128)[0]
M=np.array([[s,0,0],[0,s,oy[0]-s*ys[0]]],np.float32)
# x via face center: use ECC on grayscale of alpha-premultiplied
gimg=np.dstack([g,al*255])
def warp(M): return cv2.warpAffine(gimg,M,(W,H),flags=cv2.INTER_LINEAR,borderValue=0)
M[0,2]=( (ox[0]+ox[-1])/2 - s*(xs[0]+xs[-1])/2)
tmpl=cv2.cvtColor((o[...,:3]*o[...,3:]/255).astype(np.uint8),cv2.COLOR_RGB2GRAY).astype(np.float32)
w0=warp(M); inp=cv2.cvtColor((w0[...,:3]*w0[...,3:]/255).astype(np.uint8),cv2.COLOR_RGB2GRAY).astype(np.float32)
# ECC: map from template coords -> gen-warped; refine on head+legs (exclude jacket rows)
mask=np.zeros((H,W),np.uint8); mask[:int(H*0.24)]=255; mask[int(H*0.62):]=255
A=np.eye(2,3,dtype=np.float32)
_,A=cv2.findTransformECC(tmpl,inp,A,cv2.MOTION_AFFINE,(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,200,1e-6),mask,5)
w1=cv2.warpAffine(w0,A,(W,H),flags=cv2.INTER_LINEAR|cv2.WARP_INVERSE_MAP)
print(A)
w1[...,3]=np.clip(w1[...,3],0,255)
Image.fromarray(w1.clip(0,255).astype(np.uint8),'RGBA').save('new-worn.png')
a=w1[...,3:]/255; b=o[...,3:]/255
c=np.hstack([o[...,:3]*b+200*(1-b), w1[...,:3]*a+200*(1-a), (0.5*(o[...,:3]*b+200*(1-b))+0.5*(w1[...,:3]*a+200*(1-a)))])
Image.fromarray(c.astype(np.uint8)).resize((c.shape[1]*2,c.shape[0]*2)).save('/tmp/jz/reg.png')
