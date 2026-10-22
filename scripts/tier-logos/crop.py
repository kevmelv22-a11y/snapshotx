"""Crop /workspace/sx-assets/tier-logos.png (4 rows on black) into transparent wordmark + icon PNGs in assets/tiers/.
The X+ row gets a synthesized '+' (add_plus.py). Black is unmatted: alpha = max(R,G,B), colour divided by alpha, so neon glows keep their soft edge on any background."""
import sys
from PIL import Image
import numpy as np
import os
sys.path.insert(0, os.path.dirname(__file__))
from add_plus import add_plus
SRC = sys.argv[1] if len(sys.argv) > 1 else '/workspace/sx-assets/tier-logos.png'
im = np.asarray(Image.open(SRC).convert('RGB')).astype(float)
def unmatte(c):
    a = c.max(2); a = np.where(a < 10, 0, a); al = a / 255.0
    rgb = np.where(al[..., None] > 0, c / np.maximum(al[..., None], 1e-6), 0).clip(0, 255)
    return np.dstack([rgb, a]).astype(np.uint8)
def crop(y0, y1, x0, x1, name, h, src=None):
    reg = (im if src is None else src)[y0:y1, x0:x1]; m = reg.max(2) > 14; ys = np.where(m.any(1))[0]; xs = np.where(m.any(0))[0]; p = 6
    a, b, c, d = max(ys[0]-p, 0), ys[-1]+p+1, max(xs[0]-p, 0), xs[-1]+p+1
    out = Image.fromarray(unmatte(reg[a:b, c:d]), 'RGBA'); out = out.resize((round(out.width*h/out.height), h), Image.LANCZOS)
    out.save(f'assets/tiers/{name}.png', optimize=True); print(name, out.size)
# rows (y0, y1) and icon column span, measured on the 2752x1536 source
ROWS = {'x': (60, 436, (650, 960)), 'lens': (436, 780, (320, 670)), 'platinum': (780, 1110, (330, 575)), 'family': (1110, 1470, (310, 780))}
for k, (a, b, (i0, i1)) in ROWS.items():
    if k == 'x':  # Snapshot X+: wordmark gets a matching neon '+' after the X
        plus = add_plus(im); crop(0, b - a, 0, plus.shape[1], 'x-wordmark', 160, plus)
    else: crop(a, b, 0, im.shape[1], f'{k}-wordmark', 160)
    crop(a, b, i0, i1, f'{k}-icon', 192)
