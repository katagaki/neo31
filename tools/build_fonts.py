#!/usr/bin/env python3
"""Build Windows 31's pixel webfonts from bitmap sources.

Every glyph is emitted as a union of 1x1 pixel squares, so at
font-size == cell height each font unit square maps to exactly one CSS
pixel and the browser draws the original bitmap.

Sources (passed as paths, never executed):
  * Wine's bitmap clones of the Windows system fonts (.sfd, LGPL-2.1+):
    system.sfd, ms_sans_serif.sfd, fixedsys.sfd, courier.sfd, small_fonts.sfd
    https://gitlab.winehq.org/wine/wine/-/tree/master/fonts
  * The IBM VGA 8x16 ROM font as shipped in Linux lib/fonts/font_8x16.c (GPL-2.0)
  * Liberation Sans (SIL OFL 1.1, metric-compatible with Arial) for the large
    display sizes. Windows 3.1 drew big text with TrueType Arial and no
    anti-aliasing; we rasterise it the same way (1-bit) at each pixel size.
    Per the OFL Reserved Font Name rule the derived fonts are named "W31 Sans".

Usage:
  python3 -E tools/build_fonts.py <wine-fonts-dir> <font_8x16.c> <out-dir> [<liberation-ttf-dir>]
"""
import base64
import re
import sys
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

U = 64  # font units per pixel


def parse_sfd(path):
    """Return {pixel_size: {'ascent', 'descent', 'glyphs': {codepoint: (adv, xmin, ymax, rows)}}}"""
    lines = Path(path).read_text(encoding='latin-1').splitlines()
    orig_to_uni = {}
    for ln in lines:
        m = re.match(r'^Encoding: (-?\d+) (-?\d+) (\d+)$', ln)
        if m:
            uni = int(m.group(2))
            orig_to_uni[int(m.group(3))] = uni if uni >= 0 else int(m.group(1))
    strikes = {}
    cur = None
    i = 0
    while i < len(lines):
        ln = lines[i]
        m = re.match(r'^BitmapFont: (\d+) \d+ (\d+) (\d+) 1', ln)
        if m:
            cur = {'ascent': int(m.group(2)), 'descent': int(m.group(3)), 'glyphs': {}}
            strikes[int(m.group(1))] = cur
            i += 1
            continue
        m = re.match(r'^BDFChar: (\d+) (-?\d+) (\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+)', ln)
        if m and cur is not None:
            orig, adv, xmin, xmax, ymin, ymax = (int(m.group(k)) for k in (1, 3, 4, 5, 6, 7))
            data = ''
            i += 1
            while i < len(lines) and not re.match(r'^(BDFChar|BDFEndProperties|EndBitmapFont|BitmapFont)', lines[i]):
                data += lines[i].strip()
                i += 1
            w, h = xmax - xmin + 1, ymax - ymin + 1
            bpr = (w + 7) // 8
            raw = decode85(data, bpr * h)
            rows = []
            for r in range(h):
                bits = []
                for x in range(w):
                    byte = raw[r * bpr + x // 8] if r * bpr + x // 8 < len(raw) else 0
                    bits.append((byte >> (7 - x % 8)) & 1)
                rows.append(bits)
            uni = orig_to_uni.get(orig)
            if uni is not None and uni >= 0:
                cur['glyphs'][uni] = (adv, xmin, ymax, rows)
            continue
        i += 1
    return strikes


def decode85(s, need):
    if not s:
        return b'\0' * need
    out = bytearray()
    group = []
    for ch in s:
        if ch == 'z' and not group:
            out += b'\0\0\0\0'
            continue
        if ch < '!' or ch > 'u':
            continue
        group.append(ord(ch) - 33)
        if len(group) == 5:
            v = 0
            for g in group:
                v = v * 85 + g
            out += v.to_bytes(4, 'big')
            group = []
    if group:
        n = len(group)
        group += [84] * (5 - n)
        v = 0
        for g in group:
            v = v * 85 + g
        out += v.to_bytes(4, 'big')[:n - 1]
    out = bytes(out[:need])
    return out + b'\0' * (need - len(out))


def parse_vga(path):
    """Linux font_8x16.c -> {codepoint: (8, 0, 12, rows)} using CP437 mapping, baseline 4px above bottom."""
    txt = Path(path).read_text(encoding='latin-1')
    body = txt[txt.index('{ 0, 0, FONTDATAMAX, 0 }'):]
    nums = [int(x, 16) for x in re.findall(r'0x([0-9a-fA-F]{2})\s*,', body)]
    assert len(nums) >= 4096, len(nums)
    ctrl = '\u0000☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼'
    glyphs = {}
    for c in range(256):
        if c < 32:
            ch = ctrl[c]
        elif c == 127:
            ch = '⌂'
        else:
            ch = bytes([c]).decode('cp437')
        rows = [[(nums[c * 16 + r] >> (7 - x)) & 1 for x in range(8)] for r in range(16)]
        glyphs[ord(ch)] = (8, 0, 11, rows)
        if c == 0:
            glyphs[0xA0] = glyphs[ord(ch)]
    return {'ascent': 12, 'descent': 4, 'glyphs': glyphs}


def embolden(strike):
    """GDI-style simulated bold: OR each row with itself shifted right by 1px, advance +1."""
    out = {}
    for cp, (adv, xmin, ymax, rows) in strike['glyphs'].items():
        nrows = []
        for r in rows:
            nr = r + [0]
            nrows.append([nr[x] | (nr[x - 1] if x else 0) for x in range(len(nr))])
        out[cp] = (adv + 1, xmin, ymax, nrows)
    return {**strike, 'glyphs': out}


def raster_strike(ttf, px):
    """Render a TrueType face 1-bit (no anti-aliasing) at px pixels per em."""
    from PIL import Image, ImageDraw, ImageFont
    from fontTools.ttLib import TTFont
    cmap = TTFont(ttf).getBestCmap()
    font = ImageFont.truetype(str(ttf), size=px)
    asc, desc = font.getmetrics()
    chars = list(range(32, 127)) + list(range(160, 256)) + [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026, 0x20AC, 0x2122, 0x00D7, 0x25B2, 0x25BC, 0x25BA, 0x25C4]
    glyphs = {}
    for cp in chars:
        if cp not in cmap:
            continue
        ch = chr(cp)
        adv = round(font.getlength(ch))
        pad = px // 4
        img = Image.new('1', (adv + pad * 2, asc + desc), 0)
        d = ImageDraw.Draw(img)
        d.fontmode = '1'
        d.text((pad, 0), ch, font=font, fill=1)
        w, h = img.size
        rows = [[1 if img.getpixel((x, y)) else 0 for x in range(w)] for y in range(h)]
        glyphs[cp] = (adv, -pad, asc - 1, rows)
    return {'ascent': asc, 'descent': desc, 'glyphs': glyphs, 'em': px}


def build(strike, family, style, out_path):
    asc, desc = strike['ascent'], strike['descent']
    em = strike.get('em', asc + desc) * U
    glyphs = strike['glyphs']
    order = ['.notdef'] + [f'u{cp:04X}' for cp in sorted(glyphs)]
    cmap = {cp: f'u{cp:04X}' for cp in glyphs}
    fb = FontBuilder(em, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    ttglyphs, metrics = {}, {}
    pen = TTGlyphPen(None)
    ttglyphs['.notdef'] = pen.glyph()
    metrics['.notdef'] = (U * 4, 0)
    for cp, (adv, xmin, ymax, rows) in glyphs.items():
        pen = TTGlyphPen(None)
        minx = None
        for r, bits in enumerate(rows):
            y = ymax - r
            x = 0
            while x < len(bits):
                if bits[x]:
                    x0 = x
                    while x < len(bits) and bits[x]:
                        x += 1
                    px0, px1 = (xmin + x0) * U, (xmin + x) * U
                    py0, py1 = y * U, (y + 1) * U
                    pen.moveTo((px0, py0)); pen.lineTo((px0, py1)); pen.lineTo((px1, py1)); pen.lineTo((px1, py0)); pen.closePath()
                    minx = px0 if minx is None else min(minx, px0)
                else:
                    x += 1
        name = f'u{cp:04X}'
        ttglyphs[name] = pen.glyph()
        metrics[name] = (adv * U, minx or 0)
    fb.setupGlyf(ttglyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=asc * U, descent=-desc * U, lineGap=0)
    fb.setupNameTable({'familyName': family, 'styleName': style})
    fb.setupOS2(version=4, sTypoAscender=asc * U, sTypoDescender=-desc * U, sTypoLineGap=0, usWinAscent=asc * U, usWinDescent=desc * U,
                usWeightClass=700 if style == 'Bold' else 400, fsSelection=(0x20 if style == 'Bold' else 0x40) | 0x80)
    if style == 'Bold':
        fb.updateHead(macStyle=1)
    fb.setupPost()
    fb.save(str(out_path))
    print(f'{out_path.name}: {len(glyphs)} glyphs, cell {asc + desc}px (ascent {asc})')


def main():
    wine, vga, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    out.mkdir(parents=True, exist_ok=True)
    sysf = parse_sfd(wine / 'system.sfd')
    mss = parse_sfd(wine / 'ms_sans_serif.sfd')
    fix = parse_sfd(wine / 'fixedsys.sfd')
    cou = parse_sfd(wine / 'courier.sfd')
    sml = parse_sfd(wine / 'small_fonts.sfd')
    build(sysf[16], 'W31 System', 'Regular', out / 'w31-system.ttf')
    build(mss[13], 'W31 MS Sans Serif', 'Regular', out / 'w31-mssans-8.ttf')
    build(embolden(mss[13]), 'W31 MS Sans Serif', 'Bold', out / 'w31-mssans-8-bold.ttf')
    build(mss[16], 'W31 MS Sans Serif 10', 'Regular', out / 'w31-mssans-10.ttf')
    build(embolden(mss[16]), 'W31 MS Sans Serif 10', 'Bold', out / 'w31-mssans-10-bold.ttf')
    build(fix[15], 'W31 Fixedsys', 'Regular', out / 'w31-fixedsys.ttf')
    build(cou[13], 'W31 Courier', 'Regular', out / 'w31-courier.ttf')
    build(sml[11], 'W31 Small Fonts', 'Regular', out / 'w31-smallfonts.ttf')
    build(parse_vga(vga), 'W31 VGA', 'Regular', out / 'w31-vga.ttf')
    if len(sys.argv) > 4:
        lib = Path(sys.argv[4])
        for px in (24, 32, 48, 64, 96):
            build(raster_strike(lib / 'LiberationSans-Regular.ttf', px), f'W31 Sans {px}', 'Regular', out / f'w31-sans-{px}.ttf')
        for px in (24, 32, 64):
            build(raster_strike(lib / 'LiberationSans-Bold.ttf', px), f'W31 Sans {px}', 'Bold', out / f'w31-sans-{px}-bold.ttf')


if __name__ == '__main__':
    main()
