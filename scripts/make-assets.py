"""Builds every derived image asset from the three source images in assets-src/.

  assets-src/keyart.jpg      golden Pirate Token key art (1600x900)
  assets-src/logo.webp       transparent Pirate Token logo (250x250)
  assets-src/background.jpg  blue background (1920x1080)

Run: python3 scripts/make-assets.py
"""
from pathlib import Path
from PIL import Image, ImageFilter, ImageChops
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets-src'
PUB = ROOT / 'src' / 'assets' / 'brand'
IOS = ROOT / 'ios' / 'App' / 'App' / 'Assets.xcassets'
PUB.mkdir(parents=True, exist_ok=True)

art = Image.open(SRC / 'keyart.jpg').convert('RGB')
logo = Image.open(SRC / 'logo.webp').convert('RGBA')
bg = Image.open(SRC / 'background.jpg').convert('RGB')


def locate(scale_range, cx_range, cy_range):
    A = np.asarray(art.convert('L'), dtype=np.float32)
    best = None
    for scale in scale_range:
        s = int(round(250 * scale))
        l = logo.resize((s, s), Image.LANCZOS)
        la = np.asarray(l, dtype=np.float32)
        g = np.asarray(l.convert('RGB').convert('L'), dtype=np.float32)
        m = la[:, :, 3] > 200
        gv = g[m]; gv = (gv - gv.mean()) / (gv.std() + 1e-6)
        for cy in cy_range:
            for cx in cx_range:
                y0, x0 = cy - s // 2, cx - s // 2
                patch = A[y0:y0 + s, x0:x0 + s][m]
                pv = (patch - patch.mean()) / (patch.std() + 1e-6)
                c = float((gv * pv).mean())
                if best is None or c > best[0]:
                    best = (c, s, cx, cy)
    return best


# --- 1. High-resolution logo: key-art pixels cut out with the supplied logo's own alpha ---
corr, size, cx, cy = locate(np.arange(2.73, 2.77, 0.004), range(798, 807), range(416, 425))
print(f'logo match corr={corr:.4f} size={size} centre=({cx},{cy})')
x0, y0 = cx - size // 2, cy - size // 2
crop = art.crop((x0, y0, x0 + size, y0 + size))
alpha = logo.resize((size, size), Image.LANCZOS).getchannel('A')
# pull the edge in ~1px so key-art rays behind the rim don't leak into the cut-out
alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
hi = crop.convert('RGBA'); hi.putalpha(alpha)
hi.save(PUB / 'logo.webp', 'WEBP', quality=92, method=6)
hi.resize((256, 256), Image.LANCZOS).save(PUB / 'logo-256.webp', 'WEBP', quality=90, method=6)
hi.save(ROOT / 'scripts' / '.logo-preview.png')

# --- 2. Backgrounds ---
# The supplied background, recoloured to the Pirate Token's gold with a luminance
# gradient map (keeps its radial glow and light spikes; a plain hue rotation would turn
# the darker blues green).
def gold_map(img):
    a = np.asarray(img, dtype=np.float32) / 255
    lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    stops = np.array([0.20, 0.30, 0.42, 0.60, 0.72, 0.80])
    cols = np.array([
        [196, 112, 4],    # deep amber (edges)
        [226, 146, 8],
        [246, 180, 23],   # token gold
        [255, 205, 52],
        [255, 226, 110],
        [255, 240, 170],  # pale highlight (light spikes)
    ], dtype=np.float32)
    out = np.stack([np.interp(lum, stops, cols[:, c]) for c in range(3)], axis=-1)
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))

gold_bg = gold_map(bg)
gold_bg.save(PUB / 'background.webp', 'WEBP', quality=88, method=6)
gold_bg.resize((480, 270), Image.LANCZOS).save(ROOT / 'scripts' / '.bg-preview.png')
bg = gold_bg  # the launch screen below uses the gold version too
art.save(PUB / 'keyart.webp', 'WEBP', quality=86, method=6)
# pre-blurred key art for the reward overlay (avoids a live CSS blur on iOS)
art.resize((800, 450), Image.LANCZOS).filter(ImageFilter.GaussianBlur(6)).save(
    PUB / 'keyart-soft.webp', 'WEBP', quality=82, method=6)

# --- 3. App icon (1024, opaque): square crop of the key art centred on the token ---
side = 860
icon = art.crop((cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)).resize((1024, 1024), Image.LANCZOS)
icon_dir = IOS / 'AppIcon.appiconset'
if icon_dir.exists():
    icon.save(icon_dir / 'AppIcon-512@2x.png')
icon.resize((180, 180), Image.LANCZOS).save(ROOT / 'public' / 'apple-touch-icon.png')
icon.resize((64, 64), Image.LANCZOS).save(ROOT / 'public' / 'favicon.png')

# --- 4. Launch screen (2732 square, aspect-fill): blue background + centred logo ---
S = 2732
bw, bh = bg.size
sc = S / bh
splash = bg.resize((int(bw * sc), S), Image.LANCZOS)
left = (splash.width - S) // 2
splash = splash.crop((left, 0, left + S, S)).convert('RGBA')
L = 620
lg = hi.resize((L, L), Image.LANCZOS)
splash.alpha_composite(lg, ((S - L) // 2, (S - L) // 2))
splash = splash.convert('RGB')
splash_dir = IOS / 'Splash.imageset'
if splash_dir.exists():
    for name in ('splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'):
        splash.save(splash_dir / name, optimize=True)
splash.resize((683, 683), Image.LANCZOS).save(ROOT / 'scripts' / '.splash-preview.png')
print('assets written')
