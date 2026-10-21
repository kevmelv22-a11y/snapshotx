# Mimics components/avatar/OutfitArt ComboStack for female top+bottom (+ style) to preview offline.
import sys,json,os
from PIL import Image
R='/workspace/snapshotx'; g='female'
M=json.load(open(f'{R}/scripts/worn-bands/meta.json')); TON=json.load(open(f'{R}/scripts/worn-bands/tones.json'))
BANDS=os.environ.get('BANDS',f'{R}/assets/avatar-art/worn-bands'); TDIR=os.environ.get('TDIR',f'{R}/assets/avatar-art/worn-tones')
WS=os.environ.get('WS','/tmp/ws'); SJ=json.load(open(os.environ.get('SJ',f'{WS}/styles.json')))
def tones(name): return dict(next((f[1] for f in TON[g]['files'] if f[0]==name),[]))
def comp(top,bottom='bottom-basisbes-grey-jeans',style=None,skin='warm',hair='blonde',bg=(236,236,244,255)):
    CW,CH=M[g]['canvas']; c=Image.new('RGBA',(CW,CH),bg)
    keys=([f's-{skin}'] if skin!='warm' else [])+([f'h-{hair}'] if hair!='blonde' else [])
    P=M[g]['pieces']
    for item,band in [(bottom,'legs'),(top,'torso'),(top,'head')]:
        r=P[item][band]
        if style and band=='head':
            S=SJ[g]; k=S['keep'].get(item); st=S['styles'][style]; sk=[f's-{skin}'] if skin!='warm' else []
            if k:
                c.alpha_composite(Image.open(f'{WS}/{g}/{item}-keep.png').convert('RGBA'),(r[0]+k['rect'][0],r[1]+k['rect'][1]))
                for t in sk:
                    if t in k['tones']: o=k['tones'][t]; c.alpha_composite(Image.open(f'{WS}/{g}/{item}-keep--{t}.png').convert('RGBA'),(r[0]+o[0],r[1]+o[1]))
            c.alpha_composite(Image.open(f'{WS}/{g}/style-{style}.png').convert('RGBA'),tuple(st['rect'][:2]))
            for t in sk+[f'h-{hair}']:
                if t in st['tones']: o=st['tones'][t]; c.alpha_composite(Image.open(f'{WS}/{g}/style-{style}--{t}.png').convert('RGBA'),(st['rect'][0]+o[0],st['rect'][1]+o[1]))
            continue
        c.alpha_composite(Image.open(f'{BANDS}/{g}/{item}-{band}.png').convert('RGBA'),(r[0],r[1]))
        tt=tones(f'{item}-{band}')
        for k in keys:
            if k in tt: o=tt[k]; c.alpha_composite(Image.open(f'{TDIR}/{g}/{item}-{band}--{k}.png').convert('RGBA'),(r[0]+o[0],r[1]+o[1]))
    return c
if __name__=='__main__':
    out=sys.argv[1]; specs=json.loads(sys.argv[2]); crop=tuple(map(int,os.environ.get('CROP','40,0,340,460').split(','))); sc=float(os.environ.get('SC','1.5'))
    ims=[comp(**s).crop(crop) for s in specs]
    W,H=ims[0].size; S=Image.new('RGB',(W*len(ims),H))
    for i,im in enumerate(ims): S.paste(im.convert('RGB'),(i*W,0))
    S.resize((int(S.width*sc),int(S.height*sc)),Image.LANCZOS).save(out)
