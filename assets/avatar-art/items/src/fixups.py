"""Step 3: paint out brand-like marks (cv2.inpaint) and remove the overlapping yellow clog. Boxes are in the
384 px output coordinates of ../<id>.png; the mask inside each box is picked by colour."""
import numpy as np, cv2
from PIL import Image
D = __import__('os').path.dirname(__import__('os').path.abspath(__file__)) + '/..'
def load(n): return np.array(Image.open(f'{D}/{n}.png').convert('RGBA'))
def save(n, a): Image.fromarray(a).save(f'{D}/{n}.png')
def paint(n, boxes, pick, grow=3, radius=5):
    a = load(n); rgb = np.ascontiguousarray(a[..., :3]); m = np.zeros(rgb.shape[:2], np.uint8)
    for x0, y0, x1, y1 in boxes:
        sub = rgb[y0:y1, x0:x1].astype(int); sel = pick(sub) & (a[y0:y1, x0:x1, 3] > 200)
        m[y0:y1, x0:x1][sel] = 255
    m = cv2.dilate(m, np.ones((grow, grow), np.uint8))
    a[..., :3] = cv2.inpaint(rgb, m, radius, cv2.INPAINT_TELEA); save(n, a); return int((m > 0).sum())
lum = lambda s: s[..., 0] * .3 + s[..., 1] * .59 + s[..., 2] * .11
print('cap', paint('hat-nike-cap', [(125, 155, 190, 200)], lambda s: lum(s) < 150, grow=5))
print('bucket', paint('hat-klompz-bucket', [(210, 155, 278, 208)], lambda s: lum(s) < 120, grow=5))
print('olive', paint('outer-ploeg-olive-jacket', [(225, 115, 275, 148)], lambda s: lum(s) > 120, grow=5))
# cream swooshes on white sneakers: warmer (r-b) than the white leather
print('sneaker', paint('shoes-nike-white', [(140, 135, 215, 200), (260, 158, 328, 232)], lambda s: (s[..., 0] - s[..., 2] > 14) & (lum(s) > 150), grow=5, radius=7))
# pink clogs: drop the yellow clog in front (yellow/lime pixels + its shadow), keep the pink pair only
a = load('shoes-klompz-pink'); r, g, b = (a[..., i].astype(int) for i in range(3))
yel = (g > 140) & (b < 150) & (g - b > 60) & (r - b > 20)
yel = cv2.morphologyEx(yel.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
yel = cv2.dilate(yel, np.ones((5, 5), np.uint8)) > 0
a[..., 3][yel] = 0
n, lab, st, _ = cv2.connectedComponentsWithStats((a[..., 3] > 40).astype(np.uint8))
big = [i for i in range(1, n) if st[i, 4] > 1500]; a[..., 3][~np.isin(lab, big)] = 0
ys, xs = np.nonzero(a[..., 3] > 20); im = Image.fromarray(a).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
side = int(max(im.size) * 1.16); can = Image.new('RGBA', (side, side)); can.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
can.resize((384, 384), Image.LANCZOS).save(f'{D}/shoes-klompz-pink.png'); print('clogs ok')
