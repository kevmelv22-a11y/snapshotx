"""Female reference tee (top-nike-black-tee): the torso band ends in a 12px alpha fade at the band line (build.py), just
above the shirt's real hem, so over any bottom the composite shows a blurred light strip at the waist (the bottom's
synthesised waistband shows through the fade). This draws the shirt on down to its own hem from the worn art (crisp,
anti-aliased hem line, shirt pixels only: no trousers, no hands), in the original torso band and in the hair-free
'worn-clean' torso band (same rect, so no metadata changes; skin overlays are unaffected: the hem is cloth).
Idempotent. Run from the repo root after build.py / clean.py (before tones-clean.sh): python3 scripts/worn-bands/female/hem.py [--to dir]"""
import sys,json,numpy as np,cv2
from PIL import Image
sys.path.insert(0,'scripts/worn-bands'); import tones as T
ITEM='top-nike-black-tee'; g='female'
M=json.load(open('scripts/worn-bands/meta.json')); r=M[g]['pieces'][ITEM]['torso']; CW,CH=M[g]['canvas']
src=np.array(Image.open(f'assets/avatar-art/worn/{g}/{ITEM}.png').convert('RGBA')).astype(np.float32)
c=np.zeros((CH,CW,4),np.float32); c[60:60+src.shape[0],70:70+src.shape[1]]=src   # the reference item: identity registration
BAND=380   # build.py band line: 60 + 0.455*703
lum=c[...,:3].mean(2); chroma=c[...,:3].max(2)-c[...,:3].min(2)
dark=(c[...,3]>200)&(lum<62)&(chroma<22)
def hem_alpha():
    a=np.zeros((CH,CW),np.float32)
    for x in range(CW):
        if not dark[BAND-2:BAND+1,x].all(): continue   # shirt body crosses the band line here
        y=BAND
        while y<BAND+30 and (dark[y,x] or dark[y+1,x]): y+=1   # 1px specks (seam stitching) allowed
        a[BAND-12:y,x]=1
        # anti-aliased hem: the next rows by how dark they still are (shirt over light trousers)
        for k in range(2): a[y+k,x]=np.clip((100-lum[y+k,x])/70,0,1)*(c[y+k,x,3]>200)*(0.6 if k else 1)
    # no ragged columns: the hem line runs smoothly (median over 5 columns), edges of the shirt softened
    ext=(a>0.5).sum(0).astype(np.float32); from scipy.ndimage import median_filter
    sm=median_filter(ext,5); xs=np.where(ext>0)[0]
    for x in xs:
        if abs(ext[x]-sm[x])>2:
            a[:,x]=0; top=BAND-12; a[top:top+int(sm[x]),x]=1
    a=cv2.GaussianBlur(a,(3,1),0)*(a>0)+np.where(a==0,cv2.GaussianBlur(a,(3,1),0)*0.5,0)
    return np.clip(a,0,1)
H=hem_alpha()
def patch(path,out=None):
    im=Image.open(path); pal=im.mode=='P'; b=np.array(im.convert('RGBA')).astype(np.float32); h,w=b.shape[:2]
    sl=(slice(r[1],r[1]+h),slice(r[0],r[0]+w)); ha=H[sl]*255; cs=c[sl]
    na=np.maximum(b[...,3],ha)
    take=(ha>b[...,3])[...,None]   # where the shirt now is more opaque than the band was: the shirt's own colour
    b[...,:3]=np.where(take,cs[...,:3],b[...,:3]); b[...,3]=na
    o=b.clip(0,255).astype(np.uint8)
    if pal: q=T.kq(o); q.save(out or path,optimize=True,transparency=q.info['transparency'])   # same format as before
    else: Image.fromarray(o,'RGBA').save(out or path,optimize=True)
if __name__=='__main__':
    tmp=sys.argv[2] if len(sys.argv)>2 and sys.argv[1]=='--to' else None   # --to <dir>: write copies there instead
    for p in (f'assets/avatar-art/worn-bands/{g}/{ITEM}-torso.png',f'assets/avatar-art/worn-clean/{g}/{ITEM}-torso.png'):
        o=f'{tmp}/{p.split("/")[-3]}-{p.split("/")[-1]}' if tmp else None; patch(p,o); print(p,'->',o or 'patched in place')
