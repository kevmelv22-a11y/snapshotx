# Repair ragged hems on selected club jerseys and recolour the girl's Volendam HSB corners to magenta.
# Works on worn-bands torso+under (and optionally worn sprites). usage:
#   python scripts/jerseys/fix_hems_hsb.py
import json, os, numpy as np, cv2
from PIL import Image

ROOT = 'assets/avatar-art'
M = json.load(open('scripts/worn-bands/meta.json'))
MAGENTA = np.array([228, 24, 89], np.float32)  # official HSB corner colour
BOY_HEM = ['top-mvv-jersey', 'top-fortuna-jersey', 'top-nac-jersey', 'top-volendam-jersey']
GIRL_HEM = ['top-mvv-jersey', 'top-fortuna-jersey', 'top-nac-jersey', 'top-volendam-jersey']

def skin_mask(a):
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    mx, mn = a[..., :3].max(2), a[..., :3].min(2)
    light = (mn > 110) & (mx - mn < 55)
    return (a[..., 3] > 80) & (r > g + 12) & (g > b + 4) & (r > 110) & (g > 0.58 * r) & (b > 0.38 * r) & ~light

def load(g, item, band):
    return np.array(Image.open(f'{ROOT}/worn-bands/{g}/{item}-{band}.png').convert('RGBA'))

def save(g, item, band, a):
    Image.fromarray(a).save(f'{ROOT}/worn-bands/{g}/{item}-{band}.png', optimize=True)

def template_hem_y(g, item, y0_frac=0.55):
    """Per-column last shirt (non-skin) y in the torso, canvas coords, median-filtered."""
    x, y, w, h = M[g]['pieces'][item]['torso']
    a = load(g, item, 'torso')
    shirt = (a[..., 3] > 128) & ~skin_mask(a)
    ys = np.where(shirt, np.arange(h)[:, None], -1).max(0)  # -1 if empty
    # median filter over 9 cols
    out = ys.copy()
    for i in range(w):
        win = ys[max(0, i - 4):i + 5]
        win = win[win >= 0]
        if len(win):
            out[i] = int(np.median(win))
    return x, y, out  # torso origin + per-col hem in torso coords

def smooth_target(ys, lo, hi):
    """Clamp and smooth a hem polyline; fill missing with interpolation."""
    w = len(ys)
    y = ys.astype(np.float32)
    # ignore arms: columns with no shirt stay -1
    xs = np.where(ys >= 0)[0]
    if len(xs) < 8:
        return ys
    # body is the longest central run; drop short arm columns at the sides by using percentiles
    # fit a quadratic to the central 70% of shirt columns
    x0, x1 = xs[int(0.08 * len(xs))], xs[int(0.92 * len(xs))]
    mid = np.arange(x0, x1 + 1)
    src = y[mid]
    src = np.clip(src, lo, hi)
    # rolling median
    k = 11
    pad = np.pad(src, (k // 2, k // 2), mode='edge')
    med = np.array([np.median(pad[i:i + k]) for i in range(len(src))])
    # slight downward bow (football shirt hem)
    t = (mid - mid.mean()) / max((mid[-1] - mid[0]) / 2, 1)
    bow = 1.2 * (t ** 2 - 0.2)
    med = np.clip(med + bow, lo, hi)
    out = np.full(w, -1, np.int32)
    out[mid] = np.round(med).astype(np.int32)
    # extend a few cols at sides with the edge value (not arms)
    return out

def repair_item(g, item, template, target_canvas_y, lo_slack=18):
    x, y, w, h = M[g]['pieces'][item]['torso']
    a = load(g, item, 'torso').copy()
    skin = skin_mask(a)
    shirt = (a[..., 3] > 128) & ~skin
    # current hem
    cur = np.where(shirt, np.arange(h)[:, None], -1).max(0)
    # template hem in this torso's coords
    tx, ty, t_hem = template_hem_y(g, template)
    # map template columns: same pose / similar torso x
    # use our own smoothed hem, but take the template's *shape* (relative) if available
    lo = target_canvas_y - y - lo_slack
    hi = min(h - 1, target_canvas_y - y + 4)
    tgt = smooth_target(cur, lo, hi)
    # blend with template hem shape (shifted to our median)
    if template != item:
        # template torso may have a slightly different x origin; align by centre
        t_item_x, t_item_y, _tw, _th = M[g]['pieces'][template]['torso']
        shift = x - t_item_x
        # t_hem is in template torso coords; canvas_hem = t_item_y + t_hem
        # our coord = canvas - y
        mapped = np.full(w, -1, np.int32)
        for i in range(w):
            j = i + shift
            if 0 <= j < len(t_hem) and t_hem[j] >= 0:
                mapped[i] = t_hem[j] + t_item_y - y
        use = (mapped >= 0) & (tgt >= 0)
        if use.sum() > 20:
            # match medians, then use template shape
            d = np.median(tgt[use].astype(float) - mapped[use].astype(float))
            aligned = mapped + int(round(d))
            # only use template in the body (where both exist)
            tgt = np.where(use, np.clip(aligned, lo, hi), tgt)

    filled = 0
    # precompute source colour per column: mean of last 6 shirt rows
    src = a.copy()
    for i in range(w):
        if tgt[i] < 0:
            continue
        rows = np.where(shirt[:, i])[0]
        if len(rows) == 0:
            continue
        # source rows: last solid rows above the lower third, preferably above holes
        good = rows[rows <= max(int(rows.max() - 2), rows[0])]
        if len(good) == 0:
            good = rows
        take = good[-6:]
        col = src[take, i].astype(np.float32).mean(0)
        # start fill from just below the last contiguous block above mid-hem
        # find first hole below 55% height, or the current hem
        start = int(np.percentile(good, 70))
        for ry in range(start, tgt[i] + 1):
            if skin[ry, i]:
                continue
            # fill holes and anything short of the target
            if a[ry, i, 3] < 128 or ry > cur[i] - 1:
                a[ry, i] = np.clip(col, 0, 255).astype(np.uint8)
                a[ry, i, 3] = 255
                filled += 1
        # taper 1px antialias at the hem
        hy = tgt[i]
        if 0 < hy + 1 < h and not skin[hy, i]:
            a[hy, i, 3] = max(a[hy, i, 3], 220)
    Image.fromarray(a).save(f'{ROOT}/worn-bands/{g}/{item}-torso.png', optimize=True)
    # under band: fill the same canvas rows where the under band covers
    ux, uy, uw, uh = M[g]['pieces'][item]['under']
    u = load(g, item, 'under').copy()
    uskin = skin_mask(u)
    uf = 0
    for i in range(w):
        if tgt[i] < 0:
            continue
        canvas_hy = y + int(tgt[i])
        # column in under
        ui = (x + i) - ux
        if ui < 0 or ui >= uw:
            continue
        rows = np.where((u[:, ui, 3] > 128) & ~uskin[:, ui])[0]
        if len(rows) == 0:
            continue
        take = rows[-5:]
        col = u[take, ui].astype(np.float32).mean(0)
        uy0 = max(0, (y + max(0, int(np.percentile(rows, 70)) if False else rows[int(0.7 * (len(rows) - 1))])) - uy)
        # start from 70% of existing under shirt in this col
        start = int(rows[int(0.7 * (len(rows) - 1))])
        end = canvas_hy - uy
        end = min(uh - 1, end)
        for ry in range(start, end + 1):
            if ry < 0 or uskin[ry, ui]:
                continue
            if u[ry, ui, 3] < 128:
                u[ry, ui] = np.clip(col, 0, 255).astype(np.uint8)
                u[ry, ui, 3] = 255
                uf += 1
    Image.fromarray(u).save(f'{ROOT}/worn-bands/{g}/{item}-under.png', optimize=True)
    print(f'  {g} {item} filled torso {filled} under {uf} target median canvas y {y + np.median(tgt[tgt>=0]):.0f}')
    return filled

def fix_hsb_girl():
    """Recolour the black HSB corner marks on the girl's Volendam shirt to official magenta."""
    item = 'top-volendam-jersey'
    g = 'female'
    # HSB box on canvas from earlier measurement: roughly x 150-248, y 300-338
    # We'll locate white 'HSB' letters and dark blobs at their four corners.
    changed = 0
    for band in ('torso', 'under'):
        x, y, w, h = M[g]['pieces'][item][band]
        a = load(g, item, band).copy().astype(np.float32)
        rgb, al = a[..., :3], a[..., 3]
        # white letters
        mx, mn = rgb.max(2), rgb.min(2)
        white = (al > 160) & (mn > 170) & (mx - mn < 50)
        # dark marks (black corners), not orange shirt
        dark = (al > 160) & (rgb.max(2) < 70) & (rgb.mean(2) < 50)
        if white.sum() < 30 or dark.sum() < 10:
            print(f'  HSB {band}: skip white={white.sum()} dark={dark.sum()}')
            continue
        # bounding box of the main white mass (the wordmark)
        ys, xs = np.where(white)
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        # expand a little to include corners
        pad = 10
        x0p, x1p = max(0, x0 - pad), min(w - 1, x1 + pad)
        y0p, y1p = max(0, y0 - pad), min(h - 1, y1 + pad)
        # four corner regions (outside the letter box, inside the padded box)
        regions = {
            'tl': (x0p, x0 + 3, y0p, y0 + 4),
            'tr': (x1 - 3, x1p, y0p, y0 + 4),
            'bl': (x0p, x0 + 6, y1 - 4, y1p),
            'br': (x1 - 6, x1p, y1 - 4, y1p),
        }
        # also allow dark pixels that sit on the letter-box corners
        corner = np.zeros((h, w), bool)
        for xa, xb, ya, yb in regions.values():
            xa, xb = int(xa), int(xb); ya, yb = int(ya), int(yb)
            if xb < xa or yb < ya:
                continue
            corner[ya:yb + 1, xa:xb + 1] = True
        # dark connected components that overlap a corner region and are small
        mask = dark.astype(np.uint8)
        n, lab, st, _ = cv2.connectedComponentsWithStats(mask, 8)
        pick = np.zeros((h, w), bool)
        for k in range(1, n):
            area, cx, cy = st[k, cv2.CC_STAT_AREA], int(st[k, cv2.CC_STAT_LEFT] + st[k, cv2.CC_STAT_WIDTH] / 2), int(st[k, cv2.CC_STAT_TOP] + st[k, cv2.CC_STAT_HEIGHT] / 2)
            if area < 4 or area > 400:
                continue
            if corner[lab == k].any() or corner[cy, cx] if (0 <= cy < h and 0 <= cx < w) else False:
                pick[lab == k] = True
        if not pick.any():
            print(f'  HSB {band}: no corner blobs (white box {x0,y0,x1,y1})')
            continue
        # recolour: keep luminance shading, map mean dark to magenta
        lum = rgb[pick].mean(1, keepdims=True)
        mean_lum = max(float(lum.mean()), 1.0)
        shade = np.clip(lum / mean_lum, 0.55, 1.35)
        rgb[pick] = np.clip(MAGENTA * shade, 0, 255)
        a[..., :3] = rgb
        Image.fromarray(a.astype(np.uint8)).save(f'{ROOT}/worn-bands/{g}/{item}-{band}.png', optimize=True)
        print(f'  HSB {band}: recoloured {int(pick.sum())} px, letters box {(x0,y0,x1,y1)}')
        changed += int(pick.sum())
    return changed

if __name__ == '__main__':
    print('Boy hems (template pec):')
    for item in BOY_HEM:
        repair_item('male', item, 'top-pec-jersey', 497, lo_slack=22)
    print('Girl hems (template heracles):')
    for item in GIRL_HEM:
        repair_item('female', item, 'top-heracles-jersey', 411, lo_slack=16)
    print('Girl Volendam HSB corners:')
    fix_hsb_girl()
    print('done')
