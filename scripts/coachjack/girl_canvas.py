import json,cv2,numpy as np,sys
from PIL import Image
m=json.load(open('scripts/worn-bands/meta.json'));P=m['female']['pieces']['outer-strideon-black-jacket'];CW,CH=m['female']['canvas']
A=np.array(json.load(open('scripts/worn-bands/registration.json'))['female']['items']['outer-strideon-black-jacket']['A']);A[0,2]+=70;A[1,2]+=60
def canvas(f):
  w=np.array(Image.open(f).convert('RGBA')).astype(np.float32); w[...,:3]*=w[...,3:]/255
  c=cv2.warpAffine(w,A,(CW,CH),flags=cv2.INTER_LINEAR); c[...,:3]/=np.maximum(c[...,3:],1e-3)/255; return c.clip(0,255).astype(np.uint8)
