"""Female Kapsel support: the female worn art bakes long wavy hair into every top's torso band (shoulders, chest), so a
short style (Knot, Bob) or a different long one (Lang stijl) needs hair-free torso / under / jacket bands.

Per item in allow.json:
  * items with a hair-edited image of their own (edits/<item>--bun.png: the reference composite re-drawn with a high bun,
    see README in this folder) -> the edited pixels where the old hair was;
  * other items -> the body silhouette of the best matching hair-free edit (grown to the item's outline), neck / jaw from
    the reference edit, the cloth inpainted with LaMa (ONNX, $LAMA, default /workspace/tools/lama/lama_fp32.onnx).
Out: assets/avatar-art/worn-clean/female/<item>-<band>.png (same rect as the original band) + clean.json (rects).
Then: the tee hem (scripts/worn-bands/female/hem.py, also after build.py), tones for them (scripts/worn-bands/female/tones-clean.sh)
and node scripts/gen-worn-styles.mjs.
usage (repo root): python3 scripts/worn-bands/female/clean.py [--preview dir]"""
import sys,os,json,numpy as np,cv2
from PIL import Image
HERE=os.path.dirname(os.path.abspath(__file__)); WB=os.path.dirname(HERE); R=os.path.dirname(os.path.dirname(WB))
sys.path.insert(0,HERE); sys.path.insert(0,WB)
import tones as T
from lama import inpaint
g='female'
M=json.load(open(f'{WB}/meta.json')); TON=json.load(open(f'{WB}/tones.json'))
B=f'{R}/assets/avatar-art/worn-bands/{g}'; TD=f'{R}/assets/avatar-art/worn-tones/{g}'; OUT=f'{R}/assets/avatar-art/worn-clean/{g}'
CW,CH=M[g]['canvas']; CHIN=60+146; X0,Y0,X1,Y1=30,0,345,470
ALLOW=json.load(open(f'{HERE}/allow.json'))
G=np.array([0,200,0],np.float32)
def tones(n): return dict(next((f[1] for f in TON[g]['files'] if f[0]==n),[]))
def band(item,b): return np.array(Image.open(f'{B}/{item}-{b}.png').convert('RGBA')),M[g]['pieces'][item][b]
def place(arr,r):
    c=np.zeros((CH,CW)+arr.shape[2:],arr.dtype); h,w=arr.shape[:2]; c[r[1]:r[1]+h,r[0]:r[0]+w]=arr; return c
def over(dst,src):
    a=src[...,3:4]/255.; o=dst.astype(np.float32); o[...,:3]=src[...,:3]*a+o[...,:3]*(1-a); o[...,3]=src[...,3]+o[...,3]*(1-a[...,0]); return o.astype(np.uint8)
def composite(item):
    c=np.zeros((CH,CW,4),np.uint8)
    for b in ('torso','head'): im,r=band(item,b); c=over(c,place(im,r))
    return c
def hairmask(item,b):
    r=M[g]['pieces'][item][b]; t=tones(f'{item}-{b}'); m=np.zeros((CH,CW),np.float32)
    if 'h-black' in t:
        x,y,w,h=t['h-black']; a=np.array(Image.open(f'{TD}/{item}-{b}--h-black.png').convert('RGBA'))[...,3]/255.
        m[r[1]+y:r[1]+y+h,r[0]+x:r[0]+x+w]=a
    return m
# hair-edited images (592x928 input = composite crop (42,0,338,464) x2; the model answered 656x1024) -> canvas
def edit_on_canvas(item,name):
    ref=cv2.cvtColor(composite(item),cv2.COLOR_RGBA2RGB) if False else None
    c=composite(item); rgb=(c[...,:3]*(c[...,3:4]/255.)+G*(1-c[...,3:4]/255.)).astype(np.uint8)
    e=np.array(Image.open(f'{HERE}/edits/{item}--{name}.png').convert('RGB')).astype(np.float32)
    A0=np.array([[(592/e.shape[1])/2,0,42],[0,(928/e.shape[0])/2,0]],np.float32)
    mask=np.zeros((CH,CW),np.uint8); mask[300:430,60:320]=1  # register on the body below the hair
    gref=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY).astype(np.float32)
    gw=cv2.cvtColor(cv2.warpAffine(e,A0,(CW,CH)).astype(np.uint8),cv2.COLOR_RGB2GRAY).astype(np.float32)
    W=np.eye(2,3,dtype=np.float32)
    try: _,W=cv2.findTransformECC(gref,gw,W,cv2.MOTION_AFFINE,(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,200,1e-5),mask,5)
    except cv2.error as ex: print('ecc',item,ex)
    Tm=np.linalg.inv(np.vstack([A0,[0,0,1]]))@np.vstack([W,[0,0,1]])
    al=cv2.warpAffine(e,np.linalg.inv(Tm)[:2],(CW,CH),borderValue=(0,200,0))
    gr=al[...,1]-np.maximum(al[...,0],al[...,2]); a=1-np.clip((gr-20)/70,0,1)
    return al.astype(np.uint8),a.astype(np.float32),Tm
PRIORS=['top-nike-black-tee','outer-bf-fur-coat','outer-blueberry-blue-hoodie']
EDIT={k:edit_on_canvas(k,'bun') for k in PRIORS}
_e,PTEE,_=EDIT['top-nike-black-tee']; _l=T.lab(_e); _yy,_xx=np.mgrid[:CH,:CW]
_h=np.degrees(np.arctan2(_l[...,2],_l[...,1]))
_sk=(_l[...,1]>8)&(_l[...,2]>14)&(_l[...,0]>35)&(_h>30)&(_h<75)&(_yy>=CHIN-8)&(_yy<275)&(abs(_xx-172)<48)
_n,_lb,_st,_=cv2.connectedComponentsWithStats(_sk.astype(np.uint8),8)
NECK=cv2.erode(((_lb==_lb[CHIN+18,176])&(_lb>0)).astype(np.uint8),np.ones((3,3),np.uint8))
def clean(item):
    P=M[g]['pieces'][item]; comp=composite(item)
    hm=np.maximum(hairmask(item,'torso'),hairmask(item,'head'))
    for b in ('under','jacket'):
        if b in P and os.path.exists(f'{B}/{item}-{b}.png'): hm=np.maximum(hm,hairmask(item,b))
    m=(hm>0.2).astype(np.uint8); m=cv2.morphologyEx(m,cv2.MORPH_OPEN,np.ones((5,5),np.uint8)); m=cv2.dilate(m,np.ones((5,5),np.uint8))
    m[_yy>320]=0; m[:, :X0]=0; m[:,X1:]=0
    rgb=(comp[...,:3]*(comp[...,3:4]/255.)+G*(1-comp[...,3:4]/255.)).astype(np.uint8)
    sl=(slice(Y0,Y1),slice(X0,X1)); mb=m>0
    if item in EDIT:  # this very item re-drawn without the long hair
        e,S,_=EDIT[item]; res=np.where(mb[...,None],e,rgb).astype(np.uint8); ka=np.where(mb,S,1); info='edit'
    else:
        # body silhouette under the hair: the hair-free edit that best matches the visible (non-hair) outline, grown to fit
        ia=comp[...,3]>128; zone=np.zeros_like(ia); zone[CHIN:340,X0:X1]=True; zone&=~(cv2.dilate(m,np.ones((7,7),np.uint8))>0)
        best=None
        for pn in (PRIORS[:1] if P['cat']=='dress' else PRIORS):
            Pm=EDIT[pn][1]>0.5
            for d in (0,2,4,6,8,10,12):
                Q=cv2.dilate(Pm.astype(np.uint8),cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(2*d+1,2*d+1)))>0 if d else Pm
                iou=(Q&ia&zone).sum()/max(((Q|ia)&zone).sum(),1)
                if best is None or iou>best[0]: best=(iou,pn,d,Q)
        iou,pn,d,Q=best; info=f'{pn}+{d} iou={iou:.3f}'
        Sf=cv2.GaussianBlur(Q.astype(np.float32),(5,5),0)
        Sf=np.where(_yy<CHIN+12,np.minimum(Sf,PTEE),Sf)  # around the head / neck: the reference body (no cloth beside the jaw)
        inner=mb&(Sf>0.5)
        neck=((NECK>0)|(_yy<CHIN+6))&inner; rgb=rgb.copy(); rgb[neck]=_e[neck]; comp=comp.copy(); comp[...,3][neck]=255; inner&=~neck
        # LaMa context without the green: what is not this item gets its colours diffused in
        bgm=((comp[...,3]<128)|(mb&~inner)).astype(np.uint8)
        src=rgb.copy(); src[sl]=cv2.inpaint(rgb[sl],np.maximum(bgm[sl],inner[sl].astype(np.uint8)),7,cv2.INPAINT_TELEA)
        keep=~(bgm>0)&~inner; src[keep]=rgb[keep]
        res=src.copy(); res[sl]=inpaint(src[sl],inner[sl]); ka=np.where(mb,Sf,1)
    a=np.where(mb,ka*255,comp[...,3]).astype(np.float32)
    out=np.dstack([np.where(mb[...,None],res,comp[...,:3]),a]).clip(0,255).astype(np.uint8)
    print(item,info); return out,m
def bands_of(item,out,m):
    res={}
    for b in ('torso','under','jacket'):
        if b not in M[g]['pieces'][item] or not os.path.exists(f'{B}/{item}-{b}.png'): continue
        im,r=band(item,b); h,w=im.shape[:2]; sl=(slice(r[1],r[1]+h),slice(r[0],r[0]+w))
        o=im.copy(); mm=m[sl]>0; yy=np.mgrid[:h,:w][0]+r[1]
        rowmax=im[...,3].max(1,keepdims=True)/255.  # band seam fades stay
        o[...,:3]=np.where(mm[...,None],out[sl][...,:3],im[...,:3])
        na=out[sl][...,3]*np.minimum(rowmax,1)
        if b=='jacket': na=np.minimum(na,cv2.dilate(im[...,3],np.ones((15,15),np.uint8)))  # cutout: no new cloth far from it
        na=np.where(yy<CHIN-30,0,na)  # beside the face: the Kapsel layer's business
        o[...,3]=np.where(mm,na,im[...,3]).astype(np.uint8); o[...,3][o[...,3]<4]=0
        res[b]=(o,r)
    return res
if __name__=='__main__':
    os.makedirs(OUT,exist_ok=True); info={}
    for item in ALLOW:
        out,m=clean(item)
        for b,(o,r) in bands_of(item,out,m).items():
            q=T.kq(o); q.save(f'{OUT}/{item}-{b}.png',optimize=True,transparency=q.info['transparency']); info.setdefault(item,[]).append(b)
    json.dump(info,open(f'{HERE}/clean.json','w'),indent=1); print(len(info),'items')
