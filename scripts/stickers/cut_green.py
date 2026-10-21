import numpy as np,cv2,sys
from PIL import Image
from scipy import ndimage as ndi
for n in ['boy-hartje','girl-hartje','boy-facepalm-v2','boy-facepalm-v1']:
    a=np.array(Image.open(n+'.jpg').convert('RGB')).astype(np.float32)
    bg=np.median(np.concatenate([a[:20].reshape(-1,3),a[:, :20].reshape(-1,3)]),0)
    lab=cv2.cvtColor(a.astype(np.uint8),cv2.COLOR_RGB2LAB).astype(np.float32); bl=cv2.cvtColor(bg[None,None].astype(np.uint8),cv2.COLOR_RGB2LAB)[0,0].astype(np.float32)
    d=np.linalg.norm(lab-bl,axis=-1)
    al=np.clip((d-14)/18,0,1)
    fg=al>0.5; n_,cl,st,_=cv2.connectedComponentsWithStats(fg.astype(np.uint8),8)
    big=1+np.argmax(st[1:,4]); keep=ndi.binary_fill_holes(cl==big)
    keep=cv2.dilate(keep.astype(np.uint8),np.ones((5,5),np.uint8))>0
    solid=cv2.erode(ndi.binary_fill_holes(cl==big).astype(np.uint8),np.ones((5,5),np.uint8))>0
    al=np.where(solid,1.0,al)*keep
    # despill: limit green to max(r,b)
    g=a[...,1]; lim=np.maximum(a[...,0],a[...,2]); a[...,1]=np.where(g>lim,lim+(g-lim)*0.15,g)
    o=np.dstack([a,al*255]).clip(0,255).astype(np.uint8)
    ys,xs=np.where(al>0.05); o=o[max(ys.min()-6,0):ys.max()+6,max(xs.min()-6,0):xs.max()+6]
    Image.fromarray(o).save(f'{n}.png'); print(n,o.shape)
