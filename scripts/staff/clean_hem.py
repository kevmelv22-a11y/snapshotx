# Staff shirts (generated shorter than the base jersey): below the shirt hem the cloned bands still carried the
# generated image's white cargo (waistband, pocket edge, light halos next to the hand). Those pixels are cut
# from every band of the item (head / torso / under) below the hem, so the chosen bottoms show instead.
# usage: clean_hem.py <gender> <item> ...   (edits assets/avatar-art/worn-bands/<g>/<item>-*.png in place)
import sys, json, numpy as np, cv2
from PIL import Image
g = sys.argv[1]
BASE = {'male': 'top-acmilan-jersey', 'female': 'top-sparta-jersey'}[g]   # base the staff shirts were cloned from
REACH = 45   # also this many rows above the hem (pocket / hip beside the shirt)
M = json.load(open('scripts/worn-bands/meta.json'))[g]['pieces']
for item in sys.argv[2:]:
    P = M[item]
    x, y, w, h = P['torso']
    t = np.array(Image.open(f'assets/avatar-art/worn-bands/{g}/{item}-torso.png').convert('RGBA')).astype(np.float32)
    core = t[int(h * .35):int(h * .5), int(w * .3):int(w * .7)]
    col = np.median(core[core[..., 3] > 200][:, :3], axis=0)
    d = np.linalg.norm(t[..., :3] - col, axis=2)
    rows = ((d < 45) & (t[..., 3] > 128)).sum(1)
    hem = y + int(np.nonzero(rows > 0.25 * w)[0].max())          # canvas row of the hem
    print(item, 'shirt', col.astype(int), 'hem y', hem)
    for b in ['head', 'torso', 'under']:
        if b not in P: continue
        bx, by, bw, bh = P[b]
        p = f'assets/avatar-art/worn-bands/{g}/{item}-{b}.png'
        a = np.array(Image.open(p).convert('RGBA')).astype(np.float32)
        yy = np.arange(bh)[:, None] + by
        r, gg, bl = a[..., 0], a[..., 1], a[..., 2]
        mx, mn = a[..., :3].max(2), a[..., :3].min(2)
        light = ((mn > 115) & (mx - mn < 45)) | ((mn > 85) & (mx - mn < 40) & (yy > hem - 6))                       # white / light-grey cargo and its halo
        skin = (r > gg + 12) & (gg > bl + 4) & (r > 110)
        low = yy > hem - REACH
        dd = np.linalg.norm(a[..., :3] - col, axis=2)
        pale = (mn > 125) & (mx - mn < 85)                        # whitish halo even when it reads a bit warm
        tskin = skin & ~pale                                       # real (saturated) skin only
        cut = (light & ~skin & low) | (pale & low) | ((yy > hem - 3) & ~tskin & (dd > 60))   # below the hem: only shirt or skin
        cut = cv2.dilate(cut.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & ~tskin & low & (mn > 70)
        n = int((cut & (a[..., 3] > 0)).sum())
        a[..., 3] = np.where(cut, 0, a[..., 3])
        # where the base jersey's band has arm / hand skin at a cut pixel, use it (no floating hand, no hole in the wrist)
        bp = np.array(Image.open(f'assets/avatar-art/worn-bands/{g}/{BASE}-{b}.png').convert('RGBA')).astype(np.float32)
        if bp.shape == a.shape:
            R2, G2, B2 = bp[..., 0], bp[..., 1], bp[..., 2]
            bskin = (R2 > G2 + 12) & (G2 > B2 + 4) & (R2 > 110) & (G2 > 0.58 * R2) & (B2 > 0.38 * R2) & (bp[..., 3] > 128)
            use = cut & bskin
            a = np.where(use[..., None], bp, a)
        Image.fromarray(a.astype(np.uint8)).save(p)
        print(' ', b, 'cut', n)
