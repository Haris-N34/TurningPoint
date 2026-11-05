# Converts the captured PNGs to small WebP stills for the landing preview (public/landing/).
import sys
from pathlib import Path
from PIL import Image

src = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/landing-stills")
dst = Path("public/landing")
dst.mkdir(parents=True, exist_ok=True)
total = 0
for p in sorted(src.glob("*.png")):
    im = Image.open(p).convert("RGB").resize((800, 450), Image.LANCZOS)
    out = dst / (p.stem + ".webp")
    im.save(out, "WEBP", quality=72, method=6)
    total += out.stat().st_size
    print(out, out.stat().st_size)
print("total", total)
