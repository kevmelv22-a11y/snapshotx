import cv2, numpy as np, json, os, sys
from PIL import Image
from rembg import remove, new_session
W='/workspace/snapshotx/assets/avatar-art/worn/'
OUT=sys.argv[1] if len(sys.argv)>1 else '/workspace/scripts_tmp/combo/bands/'
reg=json.load(open('/workspace/scripts_tmp/combo/reg2.json'))
BANDS={'male':dict(h=0.225,b=0.585,f=0.87,s=0.94),'female':dict(h=0.185,b=0.455,f=0.89,s=0.95)}
D=0.008
LONG={'outer-rossano-trench','outer-bf-fur-coat','outer-paramount-emperor-robe'}
PIECES={'hat':['head'],'shoes':['feet'],'socks':['feet'],'bottom':['legs'],'top':['head','torso','legs'],'outerwear':['head','torso','legs'],'dress':['head','torso','legs']}
seg=new_session('u2net_cloth_seg')
cache='/workspace/scripts_tmp/combo/seg/'; os.makedirs(cache,exist_ok=True)
meta={}
def ramp(y,c,up):  # 0..1 crossing at c over 2D; up=True: 0 above c, 1 below
    t=np.clip((y-(c-D))/(2*D),0,1); return t if up else 1-t
for g in ['male','female']:
    RW,RH=reg[g]['ref']; PX,PT,PB=70,60,70; CW,CH=RW+2*PX,RH+PT+PB
    B=BANDS[g]; meta[g]={'canvas':[CW,CH],'pieces':{}}
    os.makedirs(OUT+g,exist_ok=True)
    yy=((np.arange(CH)-PT)/RH)[:,None]*np.ones((1,CW))
    _r=np.array(Image.open(W+f"{g}/{ {'male':'top-blueberry-white-tee','female':'top-nike-black-tee'}[g]}.png").convert('RGBA'))
    REFC=cv2.warpAffine(_r,np.array([[1,0,PX],[0,1,PT]],np.float64),(CW,CH)).astype(np.float32)
    for i,it in sorted(reg[g]['items'].items()):
        cat=it['cat']; ps=PIECES.get(cat)
        if not ps: continue
        a=np.array(Image.open(W+f'{g}/{i}.png').convert('RGBA'))
        A=np.array(it['A'],np.float64); A[:,2]+= [PX,PT]
        warp=lambda x: cv2.warpAffine(x,A,(CW,CH),flags=cv2.INTER_LINEAR,borderValue=0)
        sm=np.load(cache+f'{g}-{i}.npy')
        img=warp(a).astype(np.float32); al=img[...,3]/255.
        hb,bb,fb=B['h'],B['b'],B['f']
        long_=i in LONG
        dn=lambda c: 1-np.clip((yy-c)/(2*D),0,1)   # 1 above c, fades out just below
        M={}
        HD=0.03 if g=='female' else D
        if 'head' in ps: M['head']=1-np.clip((yy-hb)/(2*HD),0,1)
        if 'torso' in ps: M['torso']=(yy>=hb-2*D)*dn(bb)
        if 'legs' in ps: M['legs']=(yy>=bb-2*D)*dn(B['s']); M['sole']=(yy>=B['s'])*1.0
        if 'feet' in ps: M['feet']=(yy>=fb-2*D)*1.0
        k=np.ones((7,7),np.uint8)
        up=cv2.GaussianBlur(cv2.dilate((warp(np.maximum(sm[0],sm[2]))>128).astype(np.float32),k),(5,5),0)
        lo=cv2.GaussianBlur(cv2.dilate((warp(np.maximum(sm[1],sm[2]))>128).astype(np.float32),k),(5,5),0)
        if 'torso' in ps and cat=='outerwear': M['torso']=(yy>=hb-2*D)*np.maximum(dn(bb),up*(yy<bb+0.08))
        if 'feet' in ps:
            # drop the shoe image's own trouser hem: low-saturation mid-grey pixels connected to the band top
            hsv=cv2.cvtColor(img[...,:3].clip(0,255).astype(np.uint8),cv2.COLOR_RGB2HSV)
            grey=((hsv[...,1]<60)&(hsv[...,2]>35)&(hsv[...,2]<205)&(img[...,3]>40)&(yy>=fb-2*D)).astype(np.uint8)
            n,lab=cv2.connectedComponents(grey); top=int(np.argmax(yy[:,0]>=fb-2*D))
            ids=set(np.unique(lab[top:top+6][grey[top:top+6]>0]))-{0}
            pants=np.isin(lab,list(ids)).astype(np.uint8); pants=cv2.dilate(pants,np.ones((3,3),np.uint8))
            M['feet']=(yy>=fb-2*D)*cv2.GaussianBlur((1-pants).astype(np.float32),(3,3),0)
        hemy=0
        meta[g]['pieces'][i]={'cat':cat,'long':bool(long_ or cat=='dress'),'hem':round(float(hemy),3)}
        for n,m in M.items():
            o=img.copy(); o[...,3]=al*m*255
            o=o.clip(0,255).astype(np.uint8); ys,xs=np.where(o[...,3]>3)
            if not len(ys): continue
            x0,y0,x1,y1=xs.min(),ys.min(),xs.max()+1,ys.max()+1
            Image.fromarray(o[y0:y1,x0:x1]).save(OUT+f'{g}/{i}-{n}.png')
            meta[g]['pieces'][i][n]=[int(x0),int(y0),int(x1-x0),int(y1-y0)]
        print(g,i,list(M),'hem',round(hemy,2),'long' if long_ else '',flush=True)
json.dump(meta,open(OUT+'meta.json','w'))
