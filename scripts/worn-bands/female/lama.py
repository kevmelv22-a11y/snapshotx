import numpy as np, onnxruntime as ort, cv2
_s=None
def inpaint(rgb,mask):
    """rgb HxWx3 uint8, mask HxW bool -> HxWx3 uint8 (works at 512x512 by resizing the padded square)."""
    global _s
    if _s is None: _s=ort.InferenceSession('/workspace/tools/lama/lama_fp32.onnx',providers=['CPUExecutionProvider'])
    H,W=mask.shape; S=max(H,W)
    pad=np.zeros((S,S,3),np.uint8); pad[:]=rgb[0,0]; pad[:H,:W]=rgb; pm=np.zeros((S,S),np.uint8); pm[:H,:W]=mask
    im=cv2.resize(pad,(512,512),interpolation=cv2.INTER_AREA); m=(cv2.resize(pm.astype(np.float32),(512,512))>0.01).astype(np.float32)
    x=im.transpose(2,0,1)[None].astype(np.float32)/255; mm=m[None,None]
    names=[i.name for i in _s.get_inputs()]
    out=_s.run(None,{names[0]:x,names[1]:mm})[0][0].transpose(1,2,0)
    if out.max()<=1.5: out=out*255
    out=cv2.resize(np.clip(out,0,255).astype(np.uint8),(S,S),interpolation=cv2.INTER_CUBIC)[:H,:W]
    return np.where(mask[...,None],out,rgb)
