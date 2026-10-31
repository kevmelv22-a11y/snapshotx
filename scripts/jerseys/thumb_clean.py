# Kast thumbnail for cloned club jerseys (scripts/staff/thumb.py for any item id): the worn boy torso band minus skin,
# hands, denim and arm-in-shadow, RGBA (no quantise). Run after scripts/jerseys/clean_hem.py, which already removed the
# white cargo; KEEPWHITE=1 skips the white-cargo colour cut (shirts with white stripes); NOARM=1 skips the
# arm-in-shadow cut (orange / warm shirts, whose own shading matches that colour test).  usage: thumb_clean.py <item-id> ...
import os,sys,json,numpy as np,cv2
from PIL import Image
T=json.load(open('scripts/worn-bands/tones.json'))['male']['files']
for n in sys.argv[1:]:
    i=n; a=np.array(Image.open(f'assets/avatar-art/worn-bands/male/{i}-torso.png').convert('RGBA'))
    a0=a.copy(); x,y,w,h=dict(next(f[1] for f in T if f[0]==f'{i}-torso'))['s-light']
    sk=np.zeros(a.shape[:2],np.float32); sk[y:y+h,x:x+w]=np.array(Image.open(f'assets/avatar-art/worn-tones/male/{i}-torso--s-light.png').convert('RGBA'))[...,3]/255.
    a[...,3]=(a[...,3]*np.clip(1-sk*1.5,0,1)).astype(np.uint8)
    sys.path.insert(0,'scripts/worn-bands'); import tones as TT
    l=TT.lab(a0); H=a.shape[0]; yy=np.arange(H)[:,None]
    jeans=(yy>0.85*H)&(np.hypot(l[...,1],l[...,2])<9)&(l[...,0]>32)&(l[...,0]<72)   # grey denim / shadow under the hem
    a[...,3]=np.where(jeans,0,a[...,3])
    rgb=a0[...,:3].astype(int); R_,G_,B_=rgb[...,0],rgb[...,1],rgb[...,2]
    skin=(yy>0.55*H)&(R_>G_+18)&(G_>B_+8)&(R_>110)&(B_>0.5*R_)                                   # hand in the pocket
    low=(yy>0.72*H)&(rgb.min(axis=2)>170)&(rgb.max(axis=2)-rgb.min(axis=2)<30)   # white cargo under the hem
    if os.environ.get('KEEPWHITE'): low[:]=False
    a[...,3]=np.where(skin|low,0,a[...,3])
    body=cv2.morphologyEx((a[...,3]>40).astype(np.uint8),cv2.MORPH_OPEN,np.ones((9,9),np.uint8))  # no thin shadow lines / neck stubs
    n_,lb,st,_=cv2.connectedComponentsWithStats(body,8); keep=cv2.dilate((lb==1+np.argmax(st[1:,4])).astype(np.uint8),np.ones((3,3),np.uint8))
    ff=keep.copy(); m=np.zeros((ff.shape[0]+2,ff.shape[1]+2),np.uint8); cv2.floodFill(ff,m,(0,0),1)
    keep=keep|(ff==0)                      # crest / logo pixels the skin mask took inside the shirt
    a[...,3]=np.where(ff==0,a0[...,3],a[...,3])*keep
    # hem: the lowest row that is still one solid run across the shirt (below it: notches, shadow, denim)
    op=a[...,3]>128
    for yv in range(int(0.6*H),H):
        xs=np.where(op[yv])[0]
        if not (len(xs)>20 and op[yv,xs[0]:xs[-1]+1].mean()>0.985): a[yv:]=0; break
    im=Image.fromarray(a); im=im.crop(im.getchannel('A').getbbox())
    s=330/max(im.size); im=im.resize((round(im.width*s),round(im.height*s)),Image.LANCZOS)
    c=Image.new('RGBA',(384,384),(0,0,0,0)); c.alpha_composite(im,((384-im.width)//2,(384-im.height)//2))
    # arm in shadow under the left sleeve: warm brown (not the gold trim, which has G/R > 0.7; only left of x 130, below y 150), then drop slivers
    q=np.array(c).astype(np.float32); R2,G2,B2=q[...,0],q[...,1],q[...,2]
    yy2=np.arange(q.shape[0])[:,None]; xx2=np.arange(q.shape[1])[None,:]
    arm=(R2>B2+30)&(G2<0.68*R2)&(R2>45)&(q[...,3]>0)&(yy2>150)&(xx2<130)
    arm=cv2.dilate(arm.astype(np.uint8),np.ones((3,3),np.uint8))>0
    if os.environ.get('NOARM'): arm[:]=False
    q[...,3]=np.where(arm,0,q[...,3])
    solid=cv2.morphologyEx((q[...,3]>40).astype(np.uint8),cv2.MORPH_OPEN,np.ones((5,5),np.uint8))
    n2,lb2,st2,_=cv2.connectedComponentsWithStats(solid,8); main=lb2==1+np.argmax(st2[1:,4])
    q[...,3]=np.where(cv2.dilate(main.astype(np.uint8),np.ones((3,3),np.uint8))>0,q[...,3],0)
    c=Image.fromarray(q.astype(np.uint8))
    c.save(f'assets/avatar-art/items/{i}.png',optimize=True)
