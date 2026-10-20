import numpy as np,cv2,sys
from PIL import Image
from scipy.ndimage import binary_fill_holes
def shoe_mask(a,y0f=0.84):
    h,w=a.shape[:2]; rgb=a[...,:3].astype(np.float32); al=a[...,3]>40
    hsv=cv2.cvtColor(a[...,:3],cv2.COLOR_RGB2HSV); V=hsv[...,2].astype(int); S=hsv[...,1].astype(int)
    zone=np.zeros((h,w),bool); zone[int(h*y0f):]=True
    bright=(V>150)&al&zone
    m=cv2.morphologyEx(bright.astype(np.uint8),cv2.MORPH_CLOSE,np.ones((9,9),np.uint8))
    m=binary_fill_holes(m)&al
    n,cl,st,_=cv2.connectedComponentsWithStats(m.astype(np.uint8),8)
    keep=[k for k in range(1,n) if st[k,4]>300]
    return np.isin(cl,keep)
if __name__=='__main__':
    a=np.array(Image.open(sys.argv[1]).convert('RGBA')); m=shoe_mask(a,float(sys.argv[3]) if len(sys.argv)>3 else 0.84)
    o=a.copy(); o[m,0]=255; o[m,1]=(o[m,1]*0.5).astype(np.uint8)
    h=a.shape[0]; Image.fromarray(o[int(h*0.8):]).resize((a.shape[1]*3,(h-int(h*0.8))*3)).save(sys.argv[2])
