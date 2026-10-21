import sys;import os;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from girl_canvas import *
n=np.array(Image.open('/workspace/coachjack-girl/new-canvas.png')).astype(np.int32)
x0,y0,w,_=P['torso']
al=n[...,3]; R,G,Bc=n[...,0],n[...,1],n[...,2]; mx=np.maximum(np.maximum(R,G),Bc); mn=np.minimum(np.minimum(R,G),Bc)
grey=(mx-mn<22)&(mn>95)&(al>128)
# hem: lowest row where black jacket pixels exist in the body column range
dark=(mx<75)&(al>128)
rows=np.where(dark[:,x0:x0+w].sum(1)>20)[0]; hem=rows[rows<560].max(); print('hem row',hem)
y1=hem+3; h=y1-y0
# trousers: grey blob (zip line opened away) reaching the bottom of the band
g=cv2.morphologyEx(grey.astype(np.uint8),cv2.MORPH_OPEN,np.ones((5,5),np.uint8))
g[:y0+150]=0
k,lab=cv2.connectedComponents(g)
tr=np.zeros_like(grey)
for i in range(1,k):
    ys=np.where(lab==i)[0]
    if ys.max()>=y0+200: tr|=lab==i
tr=cv2.dilate(tr.astype(np.uint8),np.ones((3,3),np.uint8))>0
# also everything of the trousers below the hem-line between the jacket fronts: grey OR anything below waist not dark/skin
skin=(R>G+10)&(G>Bc)&(R>120)&(al>128)
sk_all=skin|((R>150)&(G>110)&(R>Bc+25))
torso=n[y0:y1,x0:x0+w].copy().astype(np.uint8)
T=tr[y0:y1,x0:x0+w]
torso[...,3]=np.where(T,0,torso[...,3])
# leftover trouser bits around the hem: grey pixels low in the band that are not on a zip line, then tiny islands
Gb=grey[y0:y1,x0:x0+w].copy(); Gb[:215]=False
zipz=np.zeros_like(Gb)
for r in range(h):
    for zx in (92.6-(r-120)*(11.6/110), 117+(r-90)*(8/140)):
        zipz[r,max(0,int(zx)-3):int(zx)+4]=True
torso[...,3]=np.where(Gb&~zipz,0,torso[...,3])
mxb=torso[...,:3].max(-1); keep=(mxb<90)|sk_all[y0:y1,x0:x0+w]
low=np.zeros_like(Gb); low[:]=False
# below the jacket body: only leather/skin (zip pulls keep their zip zone)
lowrow=np.arange(h)[:,None]>=h-20
torso[...,3]=np.where(lowrow&~keep&~zipz,0,torso[...,3])
k,lab,st,_=cv2.connectedComponentsWithStats((torso[...,3]>24).astype(np.uint8),8)
big=st[1:,4].max(); small=np.isin(lab,[i for i in range(1,k) if st[i,4]<0.01*big])
torso[...,3]=np.where(small,0,torso[...,3])
# light fringe on the outline -> colour of the solid pixels just inside, alpha softened
rim=cv2.dilate((torso[...,3]<128).astype(np.uint8),np.ones((5,5),np.uint8))>0
op=((torso[...,3]>=250)&~rim).astype(np.float32)
sm=cv2.blur(torso[...,:3].astype(np.float32)*op[...,None],(9,9)); nn=cv2.blur(op,(9,9))[...,None]; nb=sm/np.maximum(nn,1e-3)
lum=lambda a:a[...,:3].astype(np.float32).mean(-1)
light=rim&(torso[...,3]>0)&(lum(torso)>lum(nb)+18)&(nn[...,0]>0.05)
torso[...,:3]=np.where(light[...,None],nb,torso[...,:3]).astype(np.uint8)
torso[...,3]=np.where(light&(torso[...,3]<250),(torso[...,3]*0.7).astype(np.uint8),torso[...,3])
# drop anything in the band below the hem that is not jacket/skin
# jacket hole: between the two zips
hole=np.zeros(T.shape,bool)
for r in range(60,h):
    L=92.6-(r-120)*(11.6/110)+2; Rr=117+(r-90)*(8/140)-1
    if r<118: L=max(L,100)
    hole[r,int(np.ceil(L)):int(Rr)]=True
sk=skin[y0:y1,x0:x0+w]|((R>150)&(G>110)&(R>Bc+25))[y0:y1,x0:x0+w]
hole&=~sk
hole=cv2.morphologyEx(hole.astype(np.uint8),cv2.MORPH_OPEN,np.ones((3,3),np.uint8))>0
jacket=torso.copy(); jacket[...,3]=np.where(hole,0,jacket[...,3])
np.save('/tmp/jz/hole.npy',hole); 
Image.fromarray(torso).save('/tmp/jz/new-torso.png'); Image.fromarray(jacket).save('/tmp/jz/new-jacket.png')
json.dump(dict(h=int(h)),open('/tmp/jz/geo.json','w'))
def show(a,bg):
  f=a.astype(float);aa=f[...,3:]/255; return (f[...,:3]*aa+np.array(bg)*(1-aa)).astype(np.uint8)
Image.fromarray(np.hstack([show(torso,[0,120,255]),show(jacket,[0,120,255])])).resize((w*6,h*3),Image.NEAREST).save('/tmp/jz/nb.png')
if len(sys.argv)>1 and sys.argv[1]=='--write':
    D='assets/avatar-art/worn-bands/female/outer-strideon-black-jacket-'
    Image.fromarray(torso).save(D+'torso.png',optimize=True); Image.fromarray(jacket).save(D+'jacket.png',optimize=True)
    lx,ly,lw,lh=P['legs']; Image.fromarray(n[ly:ly+lh,lx:lx+lw].astype(np.uint8)).save(D+'legs.png',optimize=True)
    MM=json.load(open('scripts/worn-bands/meta.json')); pp=MM['female']['pieces']['outer-strideon-black-jacket']
    pp['torso']=[x0,y0,w,int(h)]; pp['jacket']=[x0,y0,w,int(h)]
    s=open('scripts/worn-bands/meta.json').read(); print(s[:200])
    json.dump(MM,open('/tmp/jz/meta-new.json','w'))
