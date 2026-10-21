"""Step 2: crop every manifest item from the sheets (see segment.py) into a transparent square PNG
(~384 px, 8 % padding) at ../<id>.png, then fixups.py paints out marks, then pngquant.
MAP: sheet -> list of manifest indices per cell in reading order (None = unused cell)."""
import json, os
import numpy as np, cv2
from PIL import Image
from segment import DIL, GRID, grid_boxes, mask_of, HERE
MAP = {
  'sheet01': list(range(0, 9)), 'sheet02': list(range(9, 18)),
  'sheet03': [18, 19, 20, 21, 22, None, 23, 24, None, None, 25, 26],
  # fur-lined boot (cell 5) = shoes-ugg-classic (30); plain lace work boot (cell 3) = shoes-carhartt-work (32)
  'sheet04': [27, 28, 29, 32, 31, 30, 33, 34, 35],
  'sheet05': list(range(36, 45)), 'sheet06': list(range(45, 54)), 'sheet07': list(range(54, 63)),
  'sheet08': list(range(63, 72)), 'sheet09': list(range(72, 81)),
  'sheet10': [81, 82, 83, 85, 86, 87, None, 88, 89],
  'sheet11': [90, 91],
}
REUSE = {}  # outer-strideon-black-jacket (84) has its own art now: strideon_jacket.py (run after this script)
SIZE, PAD = 384, 0.08
items = json.load(open('/workspace/sx-shots/kast/needed-thumbnails.json'))['items']
OUT = os.path.normpath(f'{HERE}/..')
def square(rgba):
    a = np.array(rgba); ys, xs = np.nonzero(a[..., 3] > 20)
    im = rgba.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    side = int(max(im.size) * (1 + 2 * PAD)); can = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    can.paste(im, ((side - im.width) // 2, (side - im.height) // 2)); return can.resize((SIZE, SIZE), Image.LANCZOS)
done = {}
for f in sorted(os.listdir(HERE)):
    if not f.endswith('.jpg'): continue
    key = f[:7]; cut = mask_of(f'{HERE}/{f}')
    cells, lab = grid_boxes(cut, *GRID.get(key, (3, 3)), dil=DIL.get(key, 7))
    arr = np.array(cut)
    for cell, idx in zip(cells, MAP[key]):
        if idx is None or cell is None: continue
        keep = np.isin(lab, cell[4]); x, y, w, h = cell[:4]
        a = arr.copy(); a[..., 3] = np.where(keep, a[..., 3], 0)
        img = square(Image.fromarray(a[y:y + h, x:x + w]))
        img.save(f'{OUT}/{items[idx]["id"]}.png'); done[idx] = items[idx]['id']
for dst, src in REUSE.items():
    Image.open(f'{OUT}/{items[src]["id"]}.png').save(f'{OUT}/{items[dst]["id"]}.png'); done[dst] = items[dst]['id']
missing = [i['id'] for n, i in enumerate(items) if n not in done]
print(len(done), 'items; missing:', missing)
