# Zwart coachjack (outer-strideon-black-jacket), boy: the jacket band had a transparent chest/shoulder patch and a seam
# along the zip (the white under-tee showed through), and both torso + jacket bands a square hole in the hand.
# Fill: jacket gaps from the (complete) torso band, then any interior hole (hand) inpainted from its surroundings;
# light semi-transparent fringe pixels on the outline are darkened to their opaque neighbours.
import numpy as np,cv2,sys
from PIL import Image
B='assets/avatar-art/worn-bands/male/outer-strideon-black-jacket-'
def interior(al):
    m=(al>128).astype(np.uint8); m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
    ff=m.copy(); k=np.zeros((m.shape[0]+2,m.shape[1]+2),np.uint8); cv2.floodFill(ff,k,(0,0),1)
    return (m>0)|(ff==0)
def defringe(a):
    al=a[...,3]; L=cv2.cvtColor(a[...,:3],cv2.COLOR_RGB2LAB)[...,0].astype(np.float32)
    rim=cv2.dilate((al<128).astype(np.uint8),np.ones((5,5),np.uint8))>0  # within 2px of the outline
    op=((al>=250)&~rim).astype(np.uint8); edge=(al>0)&rim
    # mean colour of nearby opaque pixels
    s=cv2.blur(a[...,:3].astype(np.float32)*op[...,None],(9,9)); n=cv2.blur(op.astype(np.float32),(9,9))[...,None]
    nb=s/np.maximum(n,1e-3); Lnb=cv2.cvtColor(nb.clip(0,255).astype(np.uint8),cv2.COLOR_RGB2LAB)[...,0].astype(np.float32)
    light=edge&(L>Lnb+12)&(n[...,0]>0.05)
    a[...,:3]=np.where(light[...,None],nb,a[...,:3]).astype(np.uint8)
    a[...,3]=np.where(light&(al<250),(al*0.7).astype(np.uint8),al)
    return a
t=np.array(Image.open(B+'torso.png').convert('RGBA')); j=np.array(Image.open(B+'jacket.png').convert('RGBA'))
# 1. jacket gaps from the torso band
gap=(t[...,3].astype(int)-j[...,3].astype(int))>8
j[gap]=t[gap]
for name,a in (('torso',t),('jacket',j)):
    ins=interior(a[...,3]); hole=ins&(a[...,3]<200)
    n,lab,st,_=cv2.connectedComponentsWithStats(hole.astype(np.uint8))
    keep=np.zeros_like(hole)
    for i in range(1,n):
        x,y,w,h,ar=st[i]
        if ar<600 and x>0 and y>0 and x+w<hole.shape[1] and y+h<hole.shape[0]: keep|=lab==i
    hole=cv2.dilate(keep.astype(np.uint8),np.ones((3,3),np.uint8))>0
    if hole.any():
        rgb=cv2.inpaint(a[...,:3],hole.astype(np.uint8)*255,4,cv2.INPAINT_TELEA)
        a[...,:3]=np.where(hole[...,None],rgb,a[...,:3]); a[...,3]=np.where(hole,255,a[...,3])
    a=defringe(a)
    Image.fromarray(a).save(B+name+'.png',optimize=True); print(name,int(hole.sum()),'hole px')
