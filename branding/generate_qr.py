"""Generate FlowTwin QR artwork. Install qrcode[pil], zxing-cpp, arabic-reshaper, python-bidi."""
from pathlib import Path
from io import BytesIO
from base64 import b64encode
from html import escape
import json
import math
import qrcode
import zxingcpp
import arabic_reshaper
from bidi.algorithm import get_display
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
FONTS = OUT.parent / 'dist' / 'fonts'
URL = 'https://flowtwin-naklthon-lab.woodsy-curry-9308.chatgpt.site/'
BG, INK, GREEN, MUTED, LIME, LINE = '#f4f5f0', '#17272b', '#315d45', '#687576', '#d0edaa', '#dce1db'
W, H = 2400, 3200
canvas = Image.new('RGB', (W, H), BG)
draw = ImageDraw.Draw(canvas)
svg = []

def rect(x, y, w, h, fill, stroke=None, width=1):
    draw.rectangle((x, y, x+w-1, y+h-1), fill=fill, outline=stroke, width=width)
    svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}"'+(f' stroke="{stroke}" stroke-width="{width}"' if stroke else '')+'/>')

def line(x1, y1, x2, y2, color, width=2):
    draw.line((x1,y1,x2,y2), fill=color, width=width)
    svg.append(f'<path d="M{x1} {y1}H{x2}" stroke="{color}" stroke-width="{width}"/>')

def text(value, x, top, size, color=INK, font='latin', align='left', ar=False):
    file = {'latin':'font-4.ttf', 'brand':'font-6.ttf', 'arabic':'font-2.ttf'}[font]
    f = ImageFont.truetype(str(FONTS/file), size)
    rendered = get_display(arabic_reshaper.reshape(value)) if ar else value
    length = draw.textlength(rendered, font=f)
    left = x-length/2 if align=='center' else x-length if align=='right' else x
    draw.text((left,top), rendered, font=f, fill=color, anchor='lt')
    family = {'latin':'FlowLatin','brand':'FlowBrand','arabic':'FlowArabic'}[font]
    anchor = {'left':'start','center':'middle','right':'end'}[align]
    svg.append(f'<text x="{x}" y="{top}" font-family="{family}" font-size="{size}" fill="{color}" text-anchor="{anchor}" dominant-baseline="hanging">{escape(value)}</text>')
    return length

def logo(x, y):
    # The same four skewed bars used by the site's header, scaled 4x.
    for bx,by in [(0,0),(48,-24),(0,96),(48,72)]:
        points=[(x+px,y+py-math.tan(math.radians(20))*px) for px,py in [(bx,by),(bx+36,by),(bx+36,by+60),(bx,by+60)]]
        draw.polygon(points,fill=GREEN)
        svg.append('<polygon fill="'+GREEN+'" points="'+' '.join(f'{a:.3f},{b:.3f}' for a,b in points)+'"/>')

rect(0,0,W,H,BG)
logo(260,250)
brand_width=text('flowtwin',400,213,174,font='brand')
text('AI',400+brand_width+16,216,52,font='brand')
text('URBAN MOBILITY INTELLIGENCE',405,390,23,GREEN)
text('EXPLORE / 01',2140,256,30,GREEN,align='right')
line(260,480,2140,480,LINE,3)
text('اختبر أثر القرار.',1200,580,108,GREEN,font='arabic',align='center',ar=True)
text('FlowTwin AI  /  EcoTwin  /  SafeCross',1200,745,40,MUTED,align='center')

qr=qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H,border=6,box_size=1)
qr.add_data(URL)
qr.make(fit=True)
matrix=qr.get_matrix()
module=1600//len(matrix)
side=module*len(matrix)
qx=(W-side)//2
qy=900+(1800-side)//2
rect(300,900,1800,1800,'#ffffff',LINE,3)
standalone=Image.new('RGB',(side,side),'#ffffff')
qd=ImageDraw.Draw(standalone)
qrpaths=[]
for row,values in enumerate(matrix):
    for col,dark in enumerate(values):
        if dark:
            x,y=col*module,row*module
            draw.rectangle((qx+x,qy+y,qx+x+module-1,qy+y+module-1),fill=GREEN)
            qd.rectangle((x,y,x+module-1,y+module-1),fill=GREEN)
            qrpaths.append(f'M{x} {y}h{module}v{module}h-{module}z')
path=''.join(qrpaths)
svg.append(f'<path transform="translate({qx} {qy})" fill="{GREEN}" shape-rendering="crispEdges" d="{path}"/>')

rect(0,2800,W,400,INK)
text('امسح الرمز لاستكشاف المنصة',1200,2865,74,LIME,font='arabic',align='center',ar=True)
text(URL.replace('https://','').rstrip('/'),1200,3020,31,'#ffffff',align='center')
text('FLOWTWIN / INTERACTIVE LAB',1200,3115,25,'#a8b9af',align='center')

font_css=''.join(f'@font-face{{font-family:{name};src:url(data:font/ttf;base64,{b64encode((FONTS/file).read_bytes()).decode()}) format("truetype");}}' for name,file in [('FlowLatin','font-4.ttf'),('FlowBrand','font-6.ttf'),('FlowArabic','font-2.ttf')])
title='<title>FlowTwin AI — Scan to explore the platform</title>'
description='<desc>Branded QR card linking to '+escape(URL)+'</desc>'
card=f'<svg xmlns="http://www.w3.org/2000/svg" width="8in" height="10.666667in" viewBox="0 0 {W} {H}">{title}{description}<style>{font_css}</style>'+''.join(svg)+'</svg>'
(OUT/'flowtwin-qr-card.svg').write_text(card,encoding='utf-8')
canvas.save(OUT/'flowtwin-qr-card.png',dpi=(300,300))
standalone.save(OUT/'flowtwin-qr.png',dpi=(300,300))
(OUT/'flowtwin-qr.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {side} {side}">{title}<rect width="{side}" height="{side}" fill="white"/><path fill="{GREEN}" shape-rendering="crispEdges" d="{path}"/></svg>',encoding='utf-8')

checks=[]
small=canvas.resize((600,800),Image.Resampling.LANCZOS)
jpeg=BytesIO();small.save(jpeg,format='JPEG',quality=70);jpeg.seek(0)
for name,image in [('card-original',canvas),('card-600x800',small),('card-jpeg-quality-70',Image.open(jpeg)),('qr-300x300',standalone.resize((300,300),Image.Resampling.LANCZOS)),('card-rotated',small.rotate(12,expand=True,fillcolor=BG))]:
    result=zxingcpp.read_barcode(image)
    assert result is not None and result.text==URL, f'QR decoding failed: {name}'
    checks.append({'case':name,'decoded':result.text,'passed':True})
manifest={'url':URL,'card_pixels':[W,H],'print_dpi':300,'correction':'H','quiet_zone_modules':6,'qr_version':qr.version,'checks':checks}
(OUT/'qr-validation.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps(manifest,indent=2))
