"""Contact sheet of all item PNGs in manifest order, labelled 'idx id' (on the Kast card grey)."""
import json, sys
from PIL import Image, ImageDraw
items = json.load(open('/workspace/sx-shots/kast/needed-thumbnails.json'))['items']
D = '/workspace/snapshotx/assets/avatar-art/items'; T = 150; C = 12
rows = (len(items) + C - 1) // C
m = Image.new('RGB', (C * T, rows * (T + 30)), (28, 28, 30)); dr = ImageDraw.Draw(m)
for n, it in enumerate(items):
    x, y = (n % C) * T, (n // C) * (T + 30)
    dr.rectangle((x + 3, y + 3, x + T - 3, y + T - 3), fill=(44, 44, 47))
    im = Image.open(f'{D}/{it["id"]}.png').convert('RGBA').resize((T - 10, T - 10)); m.paste(im, (x + 5, y + 5), im)
    dr.text((x + 4, y + T), f'{n} {it["id"][:22]}', fill='white', font_size=11)
m.save(sys.argv[1] if len(sys.argv) > 1 else '/workspace/sx-shots/kast/items-contact.png')
