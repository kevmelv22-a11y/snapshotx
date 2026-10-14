import cv2,numpy as np,json
from PIL import Image
W='/workspace/snapshotx/assets/avatar-art/worn/'; reg=json.load(open('reg2.json'))
REF={'male':'top-blueberry-white-tee','female':'top-nike-black-tee'}
def bands(cat,g):
    if cat=='hat': return [(0.14,0.85)]
    if cat in('shoes','socks'): return [(0.0,0.84)]
    if cat=='bottom': return [(0.0,0.42 if g=='female' else 0.5)]
    if cat=='dress': return [(0.0,0.17),(0.93,1.0)]
    return [(0.0,0.17),(0.62,1.0)]
def feat(a):
    al=a[...,3:4]/255.; g=cv2.cvtColor((a[...,:3]*al+128*(1-al)).astype(np.uint8),cv2.COLOR_RGB2GRAY).astype(np.float32)
    gx=cv2.Sobel(g,cv2.CV_32F,1,0,ksize=3); gy=cv2.Sobel(g,cv2.CV_32F,0,1,ksize=3); return cv2.GaussianBlur(np.sqrt(gx*gx+gy*gy),(7,7),0)
for g in reg:
    RW,RH=reg[g]['ref']; PX,PT=70,60; CW,CH=RW+140,RH+72
    r=np.array(Image.open(W+f'{g}/{REF[g]}.png').convert('RGBA')); T0=np.array([[1,0,PX],[0,1,PT]],np.float64)
    wr=cv2.warpAffine(r,T0,(CW,CH)); FT=feat(wr)
    for i,it in reg[g]['items'].items():
        if it['how']=='sift': continue
        a=np.array(Image.open(W+f'{g}/{i}.png').convert('RGBA'))
        m=np.zeros((CH,CW),np.uint8)
        for y0,y1 in bands(it['cat'],g): m[int(PT+y0*RH):int(PT+y1*RH)]=1
        m&=(cv2.dilate((wr[...,3]>20).astype(np.uint8),np.ones((15,15),np.uint8)))
        A=np.array(it['A'],np.float64); A[:,2]+=[PX,PT]
        # ECC warps the input (item canvas) onto template coordinates: we need item->canvas map; ECC finds W s.t. T(x) ~ I(W x)
        # so use inverse: I = item in its own canvas, W = inverse of A.
        Ai=cv2.invertAffineTransform(A).astype(np.float32)
        Ia=np.zeros((CH,CW,4),np.uint8); Ia[:a.shape[0],:a.shape[1]]=a; FI=feat(Ia)
        try:
            cc,Wm=cv2.findTransformECC(FT,FI,Ai,cv2.MOTION_AFFINE,(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,300,1e-7),m,5)
            An=cv2.invertAffineTransform(Wm).astype(np.float64); d=np.abs(An-A).max()
            L=An[:,:2]; sx=np.hypot(*L[:,0]); sy=np.hypot(*L[:,1]); sh=abs(L[:,0]@L[:,1])/(sx*sy)
            if d<16 and abs(sx-sy)<0.03 and sh<0.03: An[:,2]-=[PX,PT]; it['A']=An.tolist(); it['how']='ecc'; print(g,i,'ecc cc',round(cc,3),'moved',round(d,1))
            else: print(g,i,'ecc diverged',d)
        except cv2.error as e: print(g,i,"ecc fail",str(e)[-160:])
json.dump(reg,open('reg2.json','w'))
