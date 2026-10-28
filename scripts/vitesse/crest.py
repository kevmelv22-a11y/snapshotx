# Replace the badge on a yellow/black vertically striped Vitesse shirt with the real crest
# (reference PNG). The old badge = non-yellow/non-black pixels in the search box; it is covered by
# rebuilding the stripes column-wise (they are vertical), then the crest is placed over it, sized to
# the old badge height, shaded like the cloth. usage: crest.py <img> <x0,y0,x1,y1> <crest.png> [scale] [out]
import sys, numpy as np, cv2
from PIL import Image
p, box, cp = sys.argv[1], [int(v) for v in sys.argv[2].split(',')], sys.argv[3]
sc = float(sys.argv[4]) if len(sys.argv) > 4 else 1.05
out = sys.argv[5] if len(sys.argv) > 5 else p
im = np.array(Image.open(p).convert('RGBA')).astype(np.float32)
x0, y0, x1, y1 = box
reg = im[y0:y1, x0:x1]
r, g, b = reg[..., 0], reg[..., 1], reg[..., 2]
yellow = (r > 140) & (g > 120) & (b < 130) & (np.abs(r - g) < 70)
black = reg[..., :3].max(axis=2) < 85
skin = (r > g + 20) & (g > b + 10) & (r > 130) & (np.abs(r - g) > 30) & (b > 60)
odd = (~yellow & ~black & ~skin & (reg[..., 3] > 128)).astype(np.uint8)
odd = cv2.morphologyEx(odd, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(odd)
keep = [i for i in range(1, n) if st[i, 4] > 6]
big = 1 + np.argmax(st[1:, 4]); bx, by, bw, bh = st[big, :4]
# union of components overlapping the main one's (padded) bbox
sel = np.zeros_like(odd)
for i in keep:
    X, Y, W, H = st[i, :4]
    if X < bx + bw + 3 and X + W > bx - 3 and Y < by + bh + 3 and Y + H > by - 3: sel |= (lab == i).astype(np.uint8)
ys_, xs_ = np.nonzero(sel); bx, by, bw, bh = xs_.min(), ys_.min(), xs_.max() - xs_.min() + 1, ys_.max() - ys_.min() + 1
bx += x0; by += y0
print(p, 'old badge', bx, by, bw, bh)
# rebuild stripes: per column, linear blend between rows just above and below the badge
pad = 2; ta, tb = by - pad - 1, by + bh + pad
fill = im.copy()
for x in range(bx - pad, bx + bw + pad):
    A, B = im[ta, x], im[tb, x]
    for yy in range(ta + 1, tb):
        t = (yy - ta) / (tb - ta); fill[yy, x] = A * (1 - t) + B * t
msk = np.zeros(im.shape[:2], np.float32); msk[ta + 1:tb, bx - pad:bx + bw + pad] = 1
msk = cv2.GaussianBlur(msk, (0, 0), 0.8)[..., None]
im = im * (1 - msk) + fill * msk
# crest, sized to the old badge height, centred on it
c = np.array(Image.open(cp).convert('RGBA')).astype(np.float32)
H = int(round(bh * sc)); W = int(round(H * c.shape[1] / c.shape[0]))
cw = cv2.resize(c, (W, H), interpolation=cv2.INTER_AREA)
cw[..., :3] = cv2.GaussianBlur(cw[..., :3], (0, 0), 0.35)
cx, cy = bx + bw / 2, by + bh / 2
X, Y = int(round(cx - W / 2)), int(round(cy - H / 2))
patch = im[Y:Y + H, X:X + W]
# shading: cloth brightness (rebuilt stripes) relative to its median, low-passed
L = patch[..., :3].max(axis=2); ref = np.median(L[L > 120]) if (L > 120).sum() > 5 else 255
yl = L > 120
Lb = cv2.GaussianBlur(np.where(yl, L, ref).astype(np.float32), (0, 0), max(2, W / 3))
shade = np.clip(Lb / ref, 0.82, 1.08)[..., None]
a = cw[..., 3:] / 255.0
patch[..., :3] = patch[..., :3] * (1 - a) + cw[..., :3] * shade * 0.97 * a
patch[..., 3:] = np.maximum(patch[..., 3:], a * 255)
im[Y:Y + H, X:X + W] = patch
Image.fromarray(np.clip(im, 0, 255).astype(np.uint8)).save(out)
