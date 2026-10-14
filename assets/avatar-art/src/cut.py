import glob, os
from PIL import Image
from rembg import remove, new_session
sess = new_session('isnet-general-use')
W = '/workspace/sx-shots/avatar-art/work'
for f in sorted(glob.glob('src/*.jpg')):
    n = os.path.basename(f)[:-4]
    im = Image.open(f).convert('RGB')
    out = remove(im, session=sess, alpha_matting=False)
    bb = out.getchannel('A').point(lambda a: 255 if a > 12 else 0).getbbox()
    out = out.crop((max(0, bb[0] - 6), max(0, bb[1] - 6), min(im.width, bb[2] + 6), min(im.height, bb[3] + 6)))
    out.save(f'{W}/{n}.png'); print(n, out.size)
