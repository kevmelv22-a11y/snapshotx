# Worn art for a jersey that a gender is missing, from a regenerated image of an existing jersey of that gender
# (same pose / base). usage: clone_jersey.py <gender> <base-item> <new-item> <gen.jpg> [magenta]
# 1) green-key the generated image and register it onto the base worn image (ECC affine on head + legs);
# 2) bands: same rects as the base item, the base band's alpha (identical silhouette / band cuts),
#    colours from the new image (nearest new pixel where the new silhouette is a hair narrower).
import sys, json, cv2, numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt
g, base, new, gen = sys.argv[1:5]
WB = 'scripts/worn-bands'; A = 'assets/avatar-art'
M = json.load(open(f'{WB}/meta.json')); REG = json.load(open(f'{WB}/registration.json'))
o = np.array(Image.open(f'{A}/worn/{g}/{base}.png').convert('RGBA')).astype(np.float32); H, W = o.shape[:2]
x = np.array(Image.open(gen).convert('RGB')).astype(np.float32)
R, G, B = x[..., 0], x[..., 1], x[..., 2]
if len(sys.argv) > 5 and sys.argv[5] == 'magenta':   # green shirts: generated on magenta
    gk = np.minimum(R, B) - G; al = np.clip(1 - (gk - 30) / 50, 0, 1)
    x[..., 0] = np.where(gk > 0, np.minimum(R, G + 0), R); x[..., 2] = np.where(gk > 0, np.minimum(B, G + 0), B)
    x[..., 0] = np.where(gk > 0, np.maximum(G, R - gk), R); x[..., 2] = np.where(gk > 0, np.maximum(G, B - gk), B)
else:
    gk = G - np.maximum(R, B); al = np.clip(1 - (gk - 18) / 36, 0, 1); x[..., 1] = np.where(gk > 0, np.maximum(R, B), G)
gi = np.dstack([x, al * 255])
ys = np.where(al.max(1) > .5)[0]; oy = np.where(o[..., 3].max(1) > 128)[0]
s = (oy[-1] - oy[0]) / (ys[-1] - ys[0])
xs = np.where(al.max(0) > .5)[0]; ox = np.where(o[..., 3].max(0) > 128)[0]
M0 = np.array([[s, 0, (ox[0] + ox[-1]) / 2 - s * (xs[0] + xs[-1]) / 2], [0, s, oy[0] - s * ys[0]]], np.float32)
w0 = cv2.warpAffine(gi, M0, (W, H), flags=cv2.INTER_AREA)
gray = lambda a: cv2.cvtColor((a[..., :3] * a[..., 3:] / 255).astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
mask = np.zeros((H, W), np.uint8); mask[:int(H * .24)] = 255; mask[int(H * .6):] = 255
Aff = np.eye(2, 3, dtype=np.float32)
_, Aff = cv2.findTransformECC(gray(o), gray(w0), Aff, cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6), mask, 5)
nw = cv2.warpAffine(w0, Aff, (W, H), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP).clip(0, 255)
Image.fromarray(nw.astype(np.uint8), 'RGBA').save(f'{A}/worn/{g}/{new}.png', optimize=True)
# worn -> canvas: registration A of the base + offset found by matching the base legs band
Ab = np.array(REG[g]['items'][base]['A']); CW, CH = M[g]['canvas']; P = M[g]['pieces'][base]
def canvas(img, off):
    a = img.copy(); a[..., :3] *= a[..., 3:] / 255
    T = Ab.copy(); T[0, 2] += off[0]; T[1, 2] += off[1]
    c = cv2.warpAffine(a, T, (CW, CH), flags=cv2.INTER_LINEAR); c[..., :3] /= np.maximum(c[..., 3:], 1e-3) / 255
    return c.clip(0, 255)
c0 = canvas(o, (0, 0)); lb = np.array(Image.open(f'{A}/worn-bands/{g}/{base}-legs.png').convert('RGBA')).astype(np.float32)
r = cv2.matchTemplate(c0[..., :3].astype(np.float32), lb[..., :3], cv2.TM_SQDIFF, mask=np.repeat(lb[..., 3:], 3, 2))
_, _, loc, _ = cv2.minMaxLoc(r); off = (P['legs'][0] - loc[0], P['legs'][1] - loc[1]); print('offset', off)
cn = canvas(nw, off)
have = cn[..., 3] > 200
_, (iy, ix) = distance_transform_edt(~have, return_indices=True)
near = cn[iy, ix, :3]
# where the new figure is missing (a hair narrower / hand a bit elsewhere) the base pixels are the same boy/girl;
# only shirt cloth would show the base colours there, so those few px take the nearest new pixel
base_shirt = np.zeros((CH, CW), bool)
cb = canvas(o, off)
lab = cv2.cvtColor(cb[..., :3].astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
skin_hair = (lab[..., 0] > 120) & (lab[..., 1] > 132) & (lab[..., 1] < 165) & (lab[..., 2] > 140)   # skin (not red cloth)
dark_hair = (cb[..., :3].max(-1) < 70) & (np.arange(CH)[:, None] < P['torso'][1] + 10)
use_base = (~have) & (cb[..., 3] > 128) & (skin_hair | dark_hair)
fill = np.where(have[..., None], cn[..., :3], np.where(use_base[..., None], cb[..., :3], near))
for band, rect in P.items():
    if not isinstance(rect, list): continue
    bx, by, bw, bh = rect
    ob = np.array(Image.open(f'{A}/worn-bands/{g}/{base}-{band}.png').convert('RGBA'))
    nb = ob.copy(); nb[..., :3] = fill[by:by + bh, bx:bx + bw].astype(np.uint8)
    keep = (cv2.dilate((cn[..., 3] > 60).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) | use_base
    nb[..., 3] = np.where(keep[by:by + bh, bx:bx + bw], ob[..., 3], 0)   # no nearest-colour streaks outside the new figure
    if band == 'sole': nb = ob.copy()
    if band == 'head':   # face / hair from the base (same boy); below the collar line the new shirt
        yy = np.arange(bh)[:, None] + by; top = yy < P['torso'][1]
        sk = skin_hair[by:by + bh, bx:bx + bw] & (cb[by:by + bh, bx:bx + bw, 3] > 128)
        nb = np.where((top | sk)[..., None], ob, nb)
    Image.fromarray(nb).save(f'{A}/worn-bands/{g}/{new}-{band}.png', optimize=True); print(band, rect)
M[g]['pieces'][new] = json.loads(json.dumps(P)); REG[g]['items'][new] = json.loads(json.dumps(REG[g]['items'][base]))
pass
M[g]['pieces'] = dict(sorted(M[g]['pieces'].items())); REG[g]['items'] = dict(sorted(REG[g]['items'].items()))
json.dump(M, open(f'{WB}/meta.json', 'w'))
open(f'{WB}/registration.json', 'w').write(json.dumps(REG))
