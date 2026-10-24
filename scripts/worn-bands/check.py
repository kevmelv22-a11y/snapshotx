import cv2,numpy as np,json,sys
from PIL import Image
W='/workspace/snapshotx/assets/avatar-art/worn/'; reg=json.load(open('reg2.json'))
REF={'male':'top-blueberry-white-tee','female':'top-nike-black-tee'}
ims=[]
for gi in sys.argv[2:]:
    g,i=gi.split(':'); RW,RH=reg[g]['ref']; CW,CH=RW+140,RH+72
    r=np.array(Image.open(W+f'{g}/{REF[g]}.png').convert('RGBA')); a=np.array(Image.open(W+f'{g}/{i}.png').convert('RGBA'))
    A=np.array(reg[g]['items'][i]['A'],np.float64); A[:,2]+=[70,60]
    wa=cv2.warpAffine(a,A,(CW,CH)); wr=cv2.warpAffine(r,np.array([[1,0,70],[0,1,60]],np.float64),(CW,CH))
    v=np.zeros((CH,CW,3),np.uint8); v[...,0]=cv2.cvtColor(wr[...,:3],cv2.COLOR_RGB2GRAY); v[...,1]=cv2.cvtColor(wa[...,:3],cv2.COLOR_RGB2GRAY); v[...,2]=v[...,1]
    ims.append(v[:770])
Image.fromarray(np.concatenate(ims,1)).save(sys.argv[1])
