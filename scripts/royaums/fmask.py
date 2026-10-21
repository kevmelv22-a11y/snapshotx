import numpy as np,cv2
from scipy import ndimage as ndi
def female_shoe(a,y0f=0.86):
    """Shoe region of the female panda base, including its black side panel; jeans and hem shadow excluded."""
    h=a.shape[0]; V=cv2.cvtColor(a[...,:3],cv2.COLOR_RGB2HSV)[...,2].astype(int); al=a[...,3]>0
    zone=np.zeros(V.shape,bool); zone[int(h*y0f):]=True
    white=(V>150)&al&zone
    n,cl,st,_=cv2.connectedComponentsWithStats(white.astype(np.uint8),8)
    white=np.isin(cl,[k for k in range(1,n) if st[k,4]>300])
    dark=(V<75)&al&zone
    n,cl,st,_=cv2.connectedComponentsWithStats(dark.astype(np.uint8),8)
    wd=cv2.dilate(white.astype(np.uint8),np.ones((3,3),np.uint8))>0
    panel=np.zeros_like(dark)
    for k in range(1,n):
        c=cl==k; ring=(cv2.dilate(c.astype(np.uint8),np.ones((3,3),np.uint8))>0)&~c
        if ring.sum() and (white[ring].mean()>0.45): panel|=c
    core=ndi.binary_fill_holes(cv2.morphologyEx((white|panel).astype(np.uint8),cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))>0)&al
    # anti-aliased light rim of the shoe (light grey, brighter than any denim)
    rim=(V>128)&al&zone&(cv2.dilate(core.astype(np.uint8),np.ones((3,3),np.uint8))>0)
    shoe=core|rim
    pan=(cv2.dilate(panel.astype(np.uint8),np.ones((5,5),np.uint8))>0)&shoe&~((V>200))
    return shoe,pan
