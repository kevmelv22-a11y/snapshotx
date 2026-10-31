# Girl FC Volendam shirt derived from the generated girl NAC Breda shirt (the image quota ran out before her own
# render): inside the u2net_cloth_seg 'upper' mask, yellow body -> orange, black trim / crest -> white (Lab
# lightness transfer keeps the shading). usage: recolor_shirt.py in.png upper.npy out.png body_rgb trim_rgb
import sys,numpy as np,cv2
from PIL import Image
src,mk,dst=sys.argv[1:4]; body=tuple(map(int,sys.argv[4].split(','))); trimc=tuple(map(int,sys.argv[5].split(',')))
rgb=np.array(Image.open(src).convert('RGB')); m=np.load(mk).astype(np.float32)/255
hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV); H,S,V=[hsv[...,k].astype(int) for k in range(3)]
lab=cv2.cvtColor(rgb,cv2.COLOR_RGB2LAB).astype(np.float32)
tolab=lambda c: cv2.cvtColor(np.uint8([[c]]),cv2.COLOR_RGB2LAB)[0,0].astype(np.float32)
sh=m>0.5
yel=sh&(H>=16)&(H<=40)&(S>110)&(V>45)
w_y=np.clip((S-80)/60,0,1)*((H>=14)&(H<=42))   # soft: how 'yellow' a pixel is
ref=np.median(lab[yel],0); tb=tolab(body)
nl=lab.copy(); nl[...,0]=np.clip(lab[...,0]-ref[0]+tb[0],0,255); nl[...,1]=tb[1]+(lab[...,1]-ref[1])*0.3; nl[...,2]=tb[2]+(lab[...,2]-ref[2])*0.3
nb=cv2.cvtColor(nl.clip(0,255).astype(np.uint8),cv2.COLOR_LAB2RGB).astype(np.float32)
dark=sh&(V<120)
refd=np.median(lab[dark],0); tt=tolab(trimc)
tl=lab.copy(); tl[...,0]=np.clip(tt[0]-(refd[0]-lab[...,0])*0.0-np.clip(refd[0]-lab[...,0],0,40)*0.6+np.clip(lab[...,0]-refd[0],0,80)*0.0,0,255); tl[...,1]=tt[1]; tl[...,2]=tt[2]
ntr=cv2.cvtColor(tl.clip(0,255).astype(np.uint8),cv2.COLOR_LAB2RGB).astype(np.float32)
skin=(H>=3)&(H<=22)&(S>40)&(S<170)&(V>140)
inn=cv2.erode(sh.astype(np.uint8),np.ones((7,7),np.uint8))>0
core=(inn&(V<100)&~skin).astype(np.uint8)
ring=cv2.dilate(core,np.ones((5,5),np.uint8))>0
w_y=np.where(ring&(V<215),0,w_y)
w_d=(1-w_y)*(~skin)*(inn|(V<100))
mm=cv2.GaussianBlur(m,(3,3),0)
out=rgb.astype(np.float32)
a_y=(mm*w_y)[...,None]; a_d=(mm*w_d)[...,None]
out=out*(1-a_y-a_d)+nb*a_y+ntr*a_d
Image.fromarray(out.clip(0,255).astype(np.uint8)).save(dst); print(dst)
