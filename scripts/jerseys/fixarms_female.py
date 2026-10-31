# usage (repo root): fixarms_female.py <item> ...   (after clone_jersey.py + clean_hem.py + a tones.py run; re-run tones.py after)
# Girl clones: the generated arms / chin hand carry a yellow-orange bounce light from the shirt, so tones.py took them
# for blonde hair (hair overlay on the arms). Same silhouette as the base (clone_jersey), so the base's own skin pixels
# (where its skin overlay is) replace them, except where the new image has shirt (saturated / trim) colours.
import json,numpy as np,cv2,sys
from PIL import Image
g='female'; BASE='top-sparta-jersey'
M=json.load(open('scripts/worn-bands/meta.json'))[g]['pieces']; T={f[0]:dict(f[1]) for f in json.load(open('scripts/worn-bands/tones.json'))[g]['files']}
for item in sys.argv[1:]:
    for b in ['torso','under','head']:
        assert M[item][b]==M[BASE][b]
        p=f'assets/avatar-art/worn-bands/{g}/{item}-{b}.png'
        a=np.array(Image.open(p).convert('RGBA')); o=np.array(Image.open(f'assets/avatar-art/worn-bands/{g}/{BASE}-{b}.png').convert('RGBA'))
        x,y,w,h=T[f'{BASE}-{b}']['s-dark']; sk=np.zeros(a.shape[:2],np.uint8)
        sk[y:y+h,x:x+w]=np.array(Image.open(f'assets/avatar-art/worn-tones/{g}/{BASE}-{b}--s-dark.png').convert('RGBA'))[...,3]
        hsv=cv2.cvtColor(a[...,:3],cv2.COLOR_RGB2HSV); S,V=hsv[...,1].astype(int),hsv[...,2].astype(int)
        shirt=(S>170)|(V<70)|((S<40)&(V>200))
        shirt=cv2.dilate(shirt.astype(np.uint8),np.ones((3,3),np.uint8))>0
        m=(sk>128)&~shirt&(o[...,3]>200)&(a[...,3]>0)
        if b=='head':  # head band: only below the chin line (the face is the base's already)
            m[:int(h*0)+int(a.shape[0]*0.55)]=False
        a[m,:3]=o[m,:3]; Image.fromarray(a).save(p,optimize=True); print(item,b,int(m.sum()))
