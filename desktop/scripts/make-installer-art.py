"""Builds the Windows installer artwork from build/icon.png.

  build/installerSidebar.bmp    164x314  welcome + finish pages (and uninstaller)
  build/installerHeader.bmp     150x57   top-right of the inner pages
  build/icon.ico                16-256   app, installer and uninstaller icon

Run: python desktop/scripts/make-installer-art.py   (needs Pillow; Windows fonts if present)
NSIS only accepts 24-bit BMPs at exactly these sizes, so everything is drawn at 4x and
downscaled for smooth edges.
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "..", "build")
ICON = Image.open(os.path.join(BUILD, "icon.png")).convert("RGBA")
S = 4  # supersampling

NAVY = (17, 27, 52)
NIGHT = (9, 12, 22)
INK = (244, 246, 250)
INK_2 = (150, 160, 182)
BLUE = (48, 98, 200)
WHITE = (255, 255, 255)


def font(names, size):
    for name in names:
        for folder in (r"C:\Windows\Fonts", "/usr/share/fonts/truetype/dejavu", "/Library/Fonts"):
            path = os.path.join(folder, name)
            if os.path.exists(path):
                return ImageFont.truetype(path, size)
    return ImageFont.load_default()


BOLD = ["bahnschrift.ttf", "segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"]
REG = ["segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"]
MONO = ["consola.ttf", "DejaVuSansMono.ttf"]


def vertical_gradient(w, h, top, bottom):
    img = Image.new("RGB", (w, h), top)
    px = img.load()
    for y in range(h):
        t = y / (h - 1)
        c = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(w):
            px[x, y] = c
    return img


def sidebar(path):
    w, h = 164 * S, 314 * S
    img = vertical_gradient(w, h, NAVY, NIGHT)
    d = ImageDraw.Draw(img, "RGBA")

    # Dot grid, fading towards the bottom.
    step = 12 * S
    for y in range(step // 2, h, step):
        a = int(34 * (1 - y / h)) + 6
        for x in range(step // 2, w, step):
            r = 0.9 * S
            d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, a))

    # Soft blue glow behind the mark.
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx, cy, gr = 40 * S, 62 * S, 70 * S
    gd.ellipse((cx - gr, cy - gr, cx + gr, cy + gr), fill=(48, 98, 200, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(28 * S))
    img = Image.alpha_composite(img.convert("RGBA"), glow)
    d = ImageDraw.Draw(img, "RGBA")

    # Mark
    mark = ICON.resize((52 * S, 52 * S), Image.LANCZOS)
    img.alpha_composite(mark, (16 * S, 36 * S))

    # Wordmark
    d.text((16 * S, 102 * S), "UTKRISTI", font=font(BOLD, 21 * S), fill=INK)
    d.text((17 * S, 128 * S), "colabs", font=font(MONO, 12 * S), fill=INK_2)
    d.rounded_rectangle((16 * S, 152 * S, 40 * S, 154 * S), radius=S, fill=BLUE)

    # Tagline + footer
    tag = font(REG, 11 * S)
    d.text((16 * S, 166 * S), "Code together,", font=tag, fill=INK)
    d.text((16 * S, 182 * S), "remotely.", font=tag, fill=INK)
    small = font(MONO, 8 * S)
    for i, line in enumerate(["live editing", "voice & video", "local runner + AI"]):
        y = (222 + i * 15) * S
        d.ellipse((16 * S, y + 2 * S, 20 * S, y + 6 * S), fill=BLUE)
        d.text((26 * S, y), line, font=small, fill=INK_2)
    d.text((16 * S, 292 * S), "utkristi.io", font=small, fill=(110, 120, 140))

    img.convert("RGB").resize((164, 314), Image.LANCZOS).save(path, "BMP")


def header(path):
    w, h = 150 * S, 57 * S
    img = Image.new("RGBA", (w, h), WHITE + (255,))
    d = ImageDraw.Draw(img, "RGBA")
    mark = ICON.resize((34 * S, 34 * S), Image.LANCZOS)
    img.alpha_composite(mark, (104 * S, 11 * S))
    d.text((8 * S, 15 * S), "UTKRISTI", font=font(BOLD, 15 * S), fill=NAVY)
    d.text((9 * S, 33 * S), "colabs", font=font(MONO, 9 * S), fill=(90, 102, 128))
    img.convert("RGB").resize((150, 57), Image.LANCZOS).save(path, "BMP")


def ico(path):
    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    ICON.save(path, format="ICO", sizes=sizes)


if __name__ == "__main__":
    sidebar(os.path.join(BUILD, "installerSidebar.bmp"))
    header(os.path.join(BUILD, "installerHeader.bmp"))
    ico(os.path.join(BUILD, "icon.ico"))
    print("wrote installerSidebar.bmp, installerHeader.bmp, icon.ico in", os.path.normpath(BUILD))
