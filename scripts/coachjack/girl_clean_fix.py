# hair-free (Kapsel) bands: LaMa left beige hair remnants on the shoulders -> inpaint them as leather
import numpy as np,cv2
from PIL import Image
for b in ['torso','jacket']:
    f=f'assets/avatar-art/worn-clean/female/outer-strideon-black-jacket-{b}.png'
    a=np.array(Image.open(f).convert('RGBA')); R,G,B=[a[...,i].astype(int) for i in range(3)]
    warm=(R-B>25)&(R>70)&(a[...,3]>0)
    reg=np.zeros_like(warm); reg[40:140,:]=True; reg[:,62:128]=False   # face / chin hand stay
    m=cv2.dilate((warm&reg).astype(np.uint8),np.ones((5,5),np.uint8))&(a[...,3]>0)
    m[:,62:128]=0
    a[...,:3]=np.where(m[...,None]>0,cv2.inpaint(np.where(m[...,None]>0,0,a[...,:3]).astype(np.uint8),m*255,6,cv2.INPAINT_TELEA),a[...,:3])
    Image.fromarray(a).save(f,optimize=True); print(b,int(m.sum()))
