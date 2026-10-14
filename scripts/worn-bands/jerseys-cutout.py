# Cut out male jerseys from green-screen shots (exact base pose); rembg u2net + green despill/fringe removal.
import glob,os,statistics,numpy as np,cv2
from rembg import remove, new_session
from PIL import Image
s=new_session('u2net'); g='male'
O=f'/workspace/snapshotx/assets/avatar-art/worn/{g}/'
H=int(statistics.median(Image.open(f).size[1] for f in glob.glob(O+'*.png')))
for nm in ['psv','feyenoord','az','twente','utrecht']:
    i=f'top-{nm}-jersey'; im=Image.open(f'/workspace/sx-shots/kast/jerseys2/{g}/{i}.jpg').convert('RGB')
    r=remove(im,session=s,post_process_mask=True)
    a=np.array(r.getchannel('A')).astype(np.float32)
    rgb=np.array(im).astype(np.float32)
    # green-key: pixels strongly green => background
    R,G,B=rgb[...,0],rgb[...,1],rgb[...,2]; gk=G-np.maximum(R,B)
    a=a*np.clip((35-gk)/15,0,1)  # bg is mid green (63,112,56): gk~50
    a=np.where(a>200,255,np.where(a<30,0,a))
    # erode 1px edge ring to kill fringe
    hard=(a>0).astype(np.uint8); er=cv2.erode(hard,np.ones((3,3),np.uint8)); a=a*er
    # despill: clamp G to max(R,B) where green dominates
    sp=gk>0; rgb[...,1]=np.where(sp,np.maximum(R,B)+np.minimum(gk,0)*0,G)
    out=np.dstack([rgb,a]).clip(0,255).astype(np.uint8); r=Image.fromarray(out)
    r=r.crop(r.getchannel('A').getbbox()); b=r.size
    r=r.resize((round(r.width*H/r.height),H),Image.LANCZOS); r.save(O+i+'.png',optimize=True); print(i,b,r.size,H,flush=True)
