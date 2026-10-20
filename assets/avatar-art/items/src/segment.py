"""Step 1: rembg mask per sheet (cached in /workspace/sx-shots/kast/work) + item segmentation.
Items = connected components of the alpha mask after a dilation (merges shoe/sock pairs and loose parts),
sorted by row (y-centre clustering) then column. Writes <sheet>.boxes.json + an annotated preview."""
import glob, json, os, sys
import numpy as np, cv2
from PIL import Image, ImageDraw
W = '/workspace/sx-shots/kast/work'; os.makedirs(W, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
def mask_of(f):
    out = f'{W}/{os.path.basename(f)[:-4]}.png'
    if not os.path.exists(out):
        from rembg import remove, new_session
        global SESS
        SESS = globals().get('SESS') or new_session('isnet-general-use')
        remove(Image.open(f).convert('RGB'), session=SESS).save(out)
    return Image.open(out)
GRID = {'sheet03': (3, 4), 'sheet11': (1, 2)}  # (rows, cols); default 3x3
DIL = {'sheet03': 1}  # sheet03: cream wrap + black slip nearly touch -> no dilation
def km1(v, w, k, it=30):
    """1-D weighted k-means → sorted centres."""
    c = np.quantile(v, (np.arange(k) + 0.5) / k)
    for _ in range(it):
        lab = np.argmin(np.abs(v[:, None] - c[None]), 1)
        c = np.array([np.average(v[lab == j], weights=w[lab == j]) if (lab == j).any() else c[j] for j in range(k)])
    return np.sort(c)
def grid_boxes(cut, rows, cols, dil=7, min_area=250):
    """Components (small dilation), assigned to the nearest row/col centre; one union box per cell (reading order)."""
    a = (np.array(cut)[..., 3] > 40).astype(np.uint8)
    n, lab, st, cen = cv2.connectedComponentsWithStats(cv2.dilate(a, np.ones((dil, dil), np.uint8)))
    ids = [i for i in range(1, n) if st[i, 4] > min_area]
    cx, cy, ar = cen[ids, 0], cen[ids, 1], st[ids, 4].astype(float)
    rc, cc = km1(cy, ar, rows), km1(cx, ar, cols)
    # A component that covers two row centres (items touching vertically) is split at the row midpoint.
    for i in list(ids):
        y0, h = st[i, 1], st[i, 3]
        inside = [r for r in rc if y0 < r < y0 + h]
        if len(inside) < 2: continue
        yy = np.arange(lab.shape[0])[:, None]
        near = np.argmin(np.abs(yy - rc[None, :]), 1)[:, None]  # per row of pixels: nearest row centre
        sel = lab == i
        for k in range(1, rows):
            nl = lab.max() + 1; part = sel & (near == k)
            if not part.any(): continue
            lab[part] = nl; ys, xs = np.nonzero(part)
            st = np.vstack([st, [xs.min(), ys.min(), np.ptp(xs) + 1, np.ptp(ys) + 1, part.sum()]]); cen = np.vstack([cen, [xs.mean(), ys.mean()]])
            ids.append(nl)
        rest = lab == i; ys, xs = np.nonzero(rest)
        st[i] = [xs.min(), ys.min(), np.ptp(xs) + 1, np.ptp(ys) + 1, rest.sum()]; cen[i] = [xs.mean(), ys.mean()]
    cx, cy = cen[ids, 0], cen[ids, 1]
    cells = {}
    for i, x, y in zip(ids, cx, cy):
        key = (int(np.argmin(abs(rc - y))), int(np.argmin(abs(cc - x))))
        cells.setdefault(key, []).append(i)
    out = []
    for r in range(rows):
        for c in range(cols):
            m = cells.get((r, c), [])
            if not m: out.append(None); continue
            x0 = min(st[i, 0] for i in m); y0 = min(st[i, 1] for i in m)
            x1 = max(st[i, 0] + st[i, 2] for i in m); y1 = max(st[i, 1] + st[i, 3] for i in m)
            out.append([int(x0), int(y0), int(x1 - x0), int(y1 - y0), [int(i) for i in m]])
    return out, lab
def boxes(cut, dil=25, min_area=1500):
    a = (np.array(cut)[..., 3] > 40).astype(np.uint8)
    d = cv2.dilate(a, np.ones((dil, dil), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(d)
    bs = [tuple(int(v) for v in st[i, :4]) for i in range(1, n) if st[i, 4] > min_area]
    bs.sort(key=lambda b: b[1] + b[3] / 2)
    rows, cur = [], []
    for b in bs:
        cy = b[1] + b[3] / 2
        if cur and cy - (cur[-1][1] + cur[-1][3] / 2) > 90: rows.append(cur); cur = []
        cur.append(b)
    if cur: rows.append(cur)
    return [b for r in rows for b in sorted(r, key=lambda b: b[0])]
if __name__ == '__main__':
    for f in sorted(glob.glob(f'{HERE}/sheet*.jpg')):
        cut = mask_of(f); key = os.path.basename(f)[:7]
        bs, _ = grid_boxes(cut, *GRID.get(key, (3, 3)), dil=DIL.get(key, 7))
        json.dump(bs, open(f'{W}/{os.path.basename(f)[:-4]}.boxes.json', 'w'))
        im = Image.open(f).convert('RGB'); dr = ImageDraw.Draw(im)
        for i, b in enumerate(bs):
            if b is None: continue
            x, y, w, h = b[:4]; dr.rectangle((x, y, x + w, y + h), outline='red', width=3); dr.text((x + 6, y + 4), str(i), fill='red', font_size=36)
        im.resize((640, 360)).save(f'{W}/{os.path.basename(f)[:-4]}.ann.png'); print(os.path.basename(f), len(bs))
