# Green jersey on a green screen: trust the rembg mask inside, green-key + despill only in a thin edge ring.
import numpy as np,cv2
from rembg import remove, new_session
from PIL import Image
s=new_session('u2net'); im=Image.open('groningen-boy.jpg').convert('RGB')
a=np.array(remove(im,session=s,post_process_mask=True).getchannel('A')).astype(np.float32)
rgb=np.array(im).astype(np.float32); R,G,B=rgb[...,0],rgb[...,1],rgb[...,2]; gk=G-np.maximum(R,B)
from scipy import ndimage as ndi
solid=cv2.erode(ndi.binary_fill_holes(cv2.morphologyEx((a>128).astype(np.uint8),cv2.MORPH_CLOSE,np.ones((15,15),np.uint8))>0).astype(np.uint8),np.ones((7,7),np.uint8))>0
solid=solid&((R<50)|(gk<15)|(a>128))
a=np.where(solid,255,a)
edge=~solid
a=np.where(edge,a*np.clip((35-gk)/15,0,1),a)
a=np.where(a>200,255,np.where(a<30,0,a))
a=a*cv2.erode((a>0).astype(np.uint8),np.ones((3,3),np.uint8))
n,lb,st,_=cv2.connectedComponentsWithStats((a>0).astype(np.uint8)); big=1+np.argmax(st[1:,4]); a=a*(lb==big)
rgb[...,1]=np.where(edge&(gk>0),np.maximum(R,B),G)
out=Image.fromarray(np.dstack([rgb,a]).clip(0,255).astype(np.uint8)); out=out.crop(out.getchannel('A').getbbox()); out.save('cut/male-groningen.png')
