# X (Twitter) header 1500x500 for Vibe Strikers, lobby palette. Writes docs/brand/vibe-strikers-x-banner.svg
import base64, random

font = base64.b64encode(open('D:/voxel-arena/client/game/fonts/LilitaOne.ttf', 'rb').read()).decode()
INK = '#253644'; CREAM = '#FFFCF4'; ACC = '#FFB83D'; TEAL = '#68C9D0'; PINK = '#E8459A'
W, H = 1500, 500
out = []


def poly(ps, fill, w=6, extra=''):
    return f'<polygon points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in ps)}" fill="{fill}" stroke="{INK}" stroke-width="{w}" stroke-linejoin="round" {extra}/>'


def shade(hexc, f):
    c = [int(hexc[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{max(0, min(255, int(v * f))):02x}' for v in c)


def cube(cx, cy, a, h, top, left, right, face=True, prongs=None, w=6):
    """Isometric cube; (cx, cy) = top vertex of the front edge (B)."""
    q = a * 0.58
    B = (cx, cy); T = (cx, cy - 2 * q); L = (cx - a, cy - q); Rt = (cx + a, cy - q)
    Ld = (L[0], L[1] + h); Bd = (cx, cy + h); Rd = (Rt[0], Rt[1] + h)
    s = [f'<polygon points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in [T, Rt, Rd, Bd, Ld, L])}" fill="{INK}" transform="translate(4,8)"/>']
    s += [poly([T, Rt, B, L], top, w), poly([L, B, Bd, Ld], left, w), poly([B, Rt, Rd, Bd], right, w)]
    if prongs:
        for (u, v, ph, col) in prongs:
            bx = T[0] + u * (L[0] - T[0]) + v * (Rt[0] - T[0]); by = T[1] + u * (L[1] - T[1]) + v * (Rt[1] - T[1])
            pw = a * 0.16; d = pw * 0.58
            s += [poly([(bx - pw, by - ph), (bx, by - ph + d), (bx, by + d), (bx - pw, by)], col, w * 0.7),
                  poly([(bx, by - ph + d), (bx + pw, by - ph), (bx + pw, by), (bx, by + d)], shade(col, .75), w * 0.7),
                  poly([(bx, by - ph - d), (bx + pw, by - ph), (bx, by - ph + d), (bx - pw, by - ph)], shade(col, 1.25), w * 0.7)]
    if face:
        F = lambda u, v: (L[0] + u * (B[0] - L[0]), L[1] + u * (B[1] - L[1]) + v * h)
        quad = lambda u0, u1, v0, v1: [F(u0, v0), F(u1, v0), F(u1, v1), F(u0, v1)]
        for (u0, u1) in [(0.14, 0.44), (0.56, 0.86)]:
            s.append(poly(quad(u0, u1, 0.22, 0.62), CREAM, w * 0.6))
            s.append(poly(quad(u0 + 0.09, u1 - 0.09, 0.32, 0.56), INK, 0))
        s.append(poly(quad(0.3, 0.7, 0.72, 0.84), INK, w * 0.4))
    return ''.join(s)


# sky
out.append(f'<rect width="{W}" height="{H}" fill="url(#sky)"/>')
# sun glow
out.append(f'<circle cx="1180" cy="120" r="260" fill="url(#glow)"/>')
# blocky clouds
random.seed(7)
for (x, y, s_) in [(90, 70, 1.0), (520, 40, 0.8), (980, 85, 1.1), (1330, 230, 0.7), (300, 210, 0.6)]:
    for i, (dx, dy, w_, h_) in enumerate([(0, 20, 150, 40), (30, 0, 80, 30), (110, 8, 70, 32)]):
        out.append(f'<rect x="{x + dx * s_:.0f}" y="{y + dy * s_:.0f}" width="{w_ * s_:.0f}" height="{h_ * s_:.0f}" fill="#FFFFFF" opacity=".75" rx="3"/>')
# big faint crosshair behind the title
cx0, cy0 = 760, 215
out.append(f'<g stroke="{CREAM}" stroke-width="10" opacity=".55" fill="none" stroke-linecap="round">'
           f'<circle cx="{cx0}" cy="{cy0}" r="185"/><circle cx="{cx0}" cy="{cy0}" r="150" stroke-dasharray="26 20" stroke-width="6"/>'
           f'<line x1="{cx0}" y1="{cy0 - 215}" x2="{cx0}" y2="{cy0 - 150}"/><line x1="{cx0}" y1="{cy0 + 150}" x2="{cx0}" y2="{cy0 + 215}"/>'
           f'<line x1="{cx0 - 215}" y1="{cy0}" x2="{cx0 - 150}" y2="{cy0}"/><line x1="{cx0 + 150}" y1="{cy0}" x2="{cx0 + 215}" y2="{cy0}"/></g>')
# ground: voxel island strip
out.append(f'<rect x="-10" y="400" width="{W + 20}" height="120" fill="#E8D3A6" stroke="{INK}" stroke-width="6"/>')
out.append(f'<rect x="-10" y="400" width="{W + 20}" height="16" fill="#F3E4BF"/>')
for x in range(0, W, 75):
    out.append(f'<line x1="{x}" y1="416" x2="{x - 30}" y2="500" stroke="{INK}" stroke-width="3" opacity=".18"/>')
out.append(f'<rect x="-10" y="470" width="{W + 20}" height="40" fill="{TEAL}" stroke="{INK}" stroke-width="6"/>')
# characters on the right (cubes with faces), varied colours
chars = [
    (1095, 340, 64, 72, '#9BD36A', '#3F8F55', '#2F6E43', [(0.3, 0.2, 36, '#7A5434')]),
    (1240, 322, 80, 90, ACC, PINK, TEAL, [(0.3, 0.18, 46, '#7A5434'), (0.22, 0.62, 46, '#7A5434')]),
    (1395, 340, 64, 72, '#C8B6FF', '#7E63D8', '#5B45AE', [(0.25, 0.4, 30, '#253644')]),
]
for (x, y, a, h, t, l, r, pr) in chars:
    out.append(cube(x, y, a, h, t, l, r, True, pr))
# small loot blocks on the left-middle (kept clear of the avatar, which sits bottom-left)
out.append(cube(470, 372, 24, 26, ACC, shade(ACC, .8), shade(ACC, .65), False))
out.append(cube(520, 382, 18, 20, TEAL, shade(TEAL, .8), shade(TEAL, .65), False))


def word(x, y, size, text, anchor='middle', fill=CREAM):
    sw = size * 0.16
    return (f'<text x="{x + 6}" y="{y + 9}" font-size="{size}" class="word" text-anchor="{anchor}" style="fill:{INK}" stroke-width="{sw:.0f}">{text}</text>'
            f'<text x="{x}" y="{y}" font-size="{size}" class="word" text-anchor="{anchor}" style="fill:{fill}" stroke-width="{sw:.0f}">{text}</text>')


out.append(word(760, 200, 132, 'VIBE STRIKERS'))
# tagline chip
out.append(f'<rect x="505" y="236" width="510" height="56" rx="14" fill="{ACC}" stroke="{INK}" stroke-width="6"/>'
           f'<rect x="505" y="236" width="510" height="56" rx="14" fill="none" stroke="{INK}" stroke-width="0"/>')
out.append(f'<text x="760" y="275" font-size="30" class="word" text-anchor="middle" style="fill:{INK};stroke:none">VOXEL FPS · PLAY IN YOUR BROWSER</text>')
out.append(f'<rect x="608" y="306" width="304" height="40" rx="11" fill="{CREAM}" stroke="{INK}" stroke-width="5"/>')
out.append(f'<text x="760" y="334" font-size="21" class="word" text-anchor="middle" style="fill:{INK};stroke:none">ROBINHOOD CHAIN TESTNET</text>')

defs = f'''<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7EC3E3"/><stop offset=".7" stop-color="#BFE3EF"/><stop offset="1" stop-color="#E6F3F2"/></linearGradient>
<radialGradient id="glow"><stop offset="0" stop-color="#FFF4D2" stop-opacity=".9"/><stop offset="1" stop-color="#FFF4D2" stop-opacity="0"/></radialGradient>
<style>@font-face{{font-family:'Lilita One';src:url(data:font/ttf;base64,{font}) format('truetype');}}
.word{{font-family:'Lilita One',sans-serif;stroke:{INK};paint-order:stroke fill;stroke-linejoin:round;}}</style></defs>'''
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{defs}{"".join(out)}</svg>'
open('D:/voxel-arena/docs/brand/vibe-strikers-x-banner.svg', 'w', encoding='utf-8', newline='\n').write(svg)
print('ok', len(svg) // 1024, 'KB')
