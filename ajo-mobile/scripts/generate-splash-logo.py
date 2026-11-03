"""Build the themed splash logo from the existing Ajo mark.

`assets/ajo.png` is drawn in the retired clay-terracotta palette (a #C0402x
red ring beside gold). The app's design tokens are the forest-green + gold
theme (src/theme/theme.ts), so the ring is re-mapped onto the forest ramp and
the gold onto the theme gold ramp — same silhouette, on-brand colour.

Run from the `ajo-mobile` app root (`python3 scripts/generate-splash-logo.py`,
requires Pillow). Outputs, all sized the way expo-splash-screen's own
generator sizes them, so `npx expo prebuild` stays a visual no-op:

  assets/splash-logo.png                                  JS splash + Expo config
  ios/.../SplashScreenLogo.imageset/image[@2x,@3x].png    iOS launch storyboard
  ios/.../SplashScreenBackground.colorset/Contents.json   launch background
  android/.../drawable-*/splashscreen_logo.png             Android launch window
"""

import colorsys
import os

from PIL import Image

SRC = "assets/ajo.png"

# Theme tokens (src/theme/theme.ts).
FOREST_DEEP = (10, 46, 34)      # colors.forestDeep   #0A2E22
FOREST_ACTION = (30, 154, 95)   # lifted from colors.forestAction #157A4A
GOLD_DARK = (168, 104, 20)      # colors.goldPressed  #AC7A26, deepened
GOLD_LIGHT = (246, 214, 132)    # colors.gold highlight
BACKGROUND = (247, 248, 243)    # colors.forestLightCanvas #F7F8F3


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def classify(hd):
    """Split the mark's two hues: the terracotta ring vs the gold accents."""
    if hd < 30 or hd > 340:
        return "red"
    if hd < 70:
        return "gold"
    return "other"


src = Image.open(SRC).convert("RGBA")
w, h = src.size

# Pass 1 — collect each band's brightness range so the recolor keeps contrast.
bands = {"red": [], "gold": []}
for r, g, b, a in src.getdata():
    if a < 8:
        continue
    hd = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[0] * 360
    band = classify(hd)
    if band != "other":
        bands[band].append(max(r, g, b) / 255)

ramp = {}
for band, values in bands.items():
    values.sort()
    n = len(values)
    ramp[band] = (values[int(n * 0.05)], values[int(n * 0.95)])
    print("%s band: n=%d value %.2f..%.2f" % (band, n, *ramp[band]))

# Pass 2 — remap onto the theme ramps, preserving each pixel's own shading.
out = Image.new("RGBA", (w, h))
pixels = []
for r, g, b, a in src.getdata():
    if a < 8:
        pixels.append((0, 0, 0, 0))
        continue
    hd = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[0] * 360
    band = classify(hd)
    if band == "other":
        pixels.append((r, g, b, a))
        continue
    low, high = ramp[band]
    t = 0.0 if high <= low else (max(r, g, b) / 255 - low) / (high - low)
    t = min(1.0, max(0.0, t))
    colour = lerp(FOREST_DEEP, FOREST_ACTION, t) if band == "red" else lerp(GOLD_DARK, GOLD_LIGHT, t)
    pixels.append(colour + (a,))

out.putdata(pixels)

# Trim the transparent margin, then centre the mark on a square canvas so every
# consumer (JS, iOS storyboard, Android launch window) can size it as a plain
# square without re-deriving the aspect ratio.
bbox = out.getbbox()
mark = out.crop(bbox)
pad = round(max(mark.size) * 0.04)
side = max(mark.size) + pad * 2
canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))

# ---------------------------------------------------------------- iOS (pt)
IOS_DIR = "ios/SmartAjo/Images.xcassets/SplashScreenLogo.imageset"
os.makedirs(IOS_DIR, exist_ok=True)
for scale, name in ((1, "image.png"), (2, "image@2x.png"), (3, "image@3x.png")):
    width = 200 * scale
    canvas.resize((width, width), Image.LANCZOS).save(os.path.join(IOS_DIR, name))
    print("ios", name, (width, width))

with open(os.path.join(IOS_DIR, "Contents.json"), "w") as fh:
    fh.write(
        "{\n"
        '  "images" : [\n'
        '    { "filename" : "image.png", "idiom" : "universal", "scale" : "1x" },\n'
        '    { "filename" : "image@2x.png", "idiom" : "universal", "scale" : "2x" },\n'
        '    { "filename" : "image@3x.png", "idiom" : "universal", "scale" : "3x" }\n'
        "  ],\n"
        '  "info" : { "author" : "xcode", "version" : 1 }\n'
        "}\n"
    )

# Launch-screen background colour, matched to colors.forestLightCanvas.
COLORSET_DIR = "ios/SmartAjo/Images.xcassets/SplashScreenBackground.colorset"
os.makedirs(COLORSET_DIR, exist_ok=True)
red, green, blue = (component / 255 for component in BACKGROUND)
with open(os.path.join(COLORSET_DIR, "Contents.json"), "w") as fh:
    fh.write(
        "{\n"
        '  "colors" : [\n'
        "    {\n"
        '      "color" : {\n'
        '        "color-space" : "srgb",\n'
        '        "components" : {\n'
        '          "alpha" : "1.000",\n'
        '          "blue" : "%.15f",\n'
        '          "green" : "%.15f",\n'
        '          "red" : "%.15f"\n'
        "        }\n"
        "      },\n"
        '      "idiom" : "universal"\n'
        "    }\n"
        "  ],\n"
        '  "info" : { "author" : "xcode", "version" : 1 }\n'
        "}\n" % (blue, green, red)
    )

# ------------------------------------------------------------- Android (dp)
# A 288dp transparent square with the mark at `imageWidth` (200dp), centred —
# the same shape expo-splash-screen produces. That drawable is both the pre-12
# window background and the Android 12+ splash icon.
ANDROID_ROOT = "android/app/src/main/res"
for density, multiplier in (
    ("mdpi", 1),
    ("hdpi", 1.5),
    ("xhdpi", 2),
    ("xxhdpi", 3),
    ("xxxhdpi", 4),
):
    canvas_px = round(288 * multiplier)
    logo_px = round(200 * multiplier)
    logo = canvas.resize((logo_px, logo_px), Image.LANCZOS)
    sheet = Image.new("RGBA", (canvas_px, canvas_px), (0, 0, 0, 0))
    sheet.paste(logo, ((canvas_px - logo_px) // 2, (canvas_px - logo_px) // 2))
    sheet.save(os.path.join(ANDROID_ROOT, "drawable-%s" % density, "splashscreen_logo.png"))
    print("android", density, sheet.size, "logo", logo.size)

canvas.paste(mark, ((side - mark.width) // 2, (side - mark.height) // 2))
print("mark", mark.size, "-> canvas", canvas.size)

# 3x render for the JS splash (displayed at 200pt) so the mark stays crisp on
# high-density screens instead of being upscaled at runtime.
canvas.resize((600, 600), Image.LANCZOS).save("assets/splash-logo.png")
