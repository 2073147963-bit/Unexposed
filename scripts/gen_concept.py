# 生成「低多边形平面着色」概念图 —— 独立 HTML，不改任何应用代码。
# 关键：描边（清晰轮廓）+ 明显色阶（亮→暗，flat shading）+ 硬边投影，用平面设计手段表达立体感。

def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def mix(c1, c2, t):
    return tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))

def css(c):
    return '#%02x%02x%02x' % c

# 更亮、更纯的胶卷主色，让它在暗底上「跳」出来
TONES = {
    'mustard': {'base': '#e0b23f', 'ink': '#2a1e06'},
    'red':     {'base': '#cf3a22', 'ink': '#2a0d06'},
    'ivory':   {'base': '#d9cba9', 'ink': '#2a2010'},
    'green':   {'base': '#2f966b', 'ink': '#0d241b'},
}
PAPER = '#efe6cf'
PAPER_INK = '#221a10'
OUTLINE = '#0a0402'
CAP_TOP = '#5a4634'
CAP_SIDE = '#1c120c'
SHADOW = '#000000'


def shade(base, t):
    return css(mix(hexrgb(base), (255, 255, 255), t))


def shade_dark(base, t):
    return css(mix(hexrgb(base), (0, 0, 0), t))


def canister(tone, title, theme, speed='400', scale=1.0):
    # 顶面六边形（屏幕坐标，对称，前缘在下）
    T = [(40, 10), (78, -16), (30, -44), (-30, -44), (-78, -16), (-40, 10)]  # FTR,MR,BR,BL,ML,FTL
    capH, bodyH, rimH = 16, 154, 14
    SW = 2.6

    def shift(pts, dy):
        return [(x, y + dy) for x, y in pts]

    lvl_top = T
    lvl_cap = shift(T, capH)
    lvl_body = shift(T, capH + bodyH)
    lvl_rim = shift(T, capH + bodyH + rimH)

    def quad(ia, ib, lt, lb):
        a, b = lt[ia], lt[ib]
        c, d = lb[ib], lb[ia]
        return (a, b, c, d)

    def poly(pts, fill, sw=SW):
        p = ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts)
        return f'<polygon points="{p}" fill="{fill}" stroke="{OUTLINE}" stroke-width="{sw}" stroke-linejoin="round"/>'

    base = TONES[tone]['base']
    ink = TONES[tone]['ink']
    light = shade(base, 0.42)
    mid = base
    dark = shade_dark(base, 0.44)
    darker = shade_dark(base, 0.62)

    parts = []
    # 硬边投影（长影，右下）：先画 → 被物体盖住
    shadow = []
    for (x, y) in T:
        shadow.append((x * 1.6 + 128, y + capH + bodyH + rimH + 34))
    parts.append(poly(shadow, SHADOW))

    # 顶盖面（受顶光 → 最亮）
    parts.append(poly(lvl_top, CAP_TOP))
    # 顶盖侧棱（3 个可见面）
    parts.append(poly(quad(0, 1, lvl_top, lvl_cap), CAP_SIDE))
    parts.append(poly(quad(4, 5, lvl_top, lvl_cap), CAP_SIDE))
    parts.append(poly(quad(5, 0, lvl_top, lvl_cap), CAP_SIDE))

    # 卷轴柄：顶盖中心的小六角旋钮（画在顶盖面之上，向上凸）
    nub = [(x * 0.28, -18 + (y + 18) * 0.28) for x, y in T]
    parts.append(poly(nub, CAP_SIDE, 2.0))
    # 旋钮顶面受光一点
    parts.append(poly([(x * 0.20, -20 + (y + 20) * 0.20) for x, y in T], CAP_TOP, 1.6))

    # 主体三面：左前（亮）/ 正前（中，留出纸标签） / 右前（暗）
    parts.append(poly(quad(5, 0, lvl_cap, lvl_body), mid))     # front 先铺中色
    parts.append(poly(quad(4, 5, lvl_cap, lvl_body), light))   # left 亮
    parts.append(poly(quad(0, 1, lvl_cap, lvl_body), dark))    # right 暗

    # 底缘三面（更暗，收底 → 体积收束）
    parts.append(poly(quad(5, 0, lvl_body, lvl_rim), darker))
    parts.append(poly(quad(4, 5, lvl_body, lvl_rim), darker))
    parts.append(poly(quad(0, 1, lvl_body, lvl_rim), shade_dark(base, 0.68)))

    # 纸标签：只占正前立面中部，上下留出「中色」体面 → 正面仍是圆柱面，不是整张纸片
    ftl = lvl_cap[5]; ftr = lvl_cap[0]
    fbl = lvl_body[5]; fbr = lvl_body[0]
    lx, rx = ftl[0], ftr[0]
    ty, by = ftl[1], fbr[1]
    lab_t = ty + (by - ty) * 0.18
    lab_b = ty + (by - ty) * 0.82
    parts.append(f'<polygon points="{lx},{lab_t:.1f} {rx},{lab_t:.1f} {rx},{lab_b:.1f} {lx},{lab_b:.1f}" '
                 f'fill="{PAPER}" stroke="{OUTLINE}" stroke-width="{SW}" stroke-linejoin="round"/>')

    cx = (lx + rx) / 2
    lh = lab_b - lab_t
    parts.append(f'<text x="{cx}" y="{lab_t + lh*0.24:.1f}" text-anchor="middle" '
                 f'font-family="Courier New,monospace" font-size="8" letter-spacing="1.5" fill="#7a6c50">UNX / COLOR NEGATIVE</text>')
    parts.append(f'<text x="{cx}" y="{lab_t + lh*0.52:.1f}" text-anchor="middle" '
                 f'font-family="Arial Narrow,Arial,sans-serif" font-weight="900" font-size="19" '
                 f'letter-spacing="-0.5" fill="{PAPER_INK}">{title}</text>')
    parts.append(f'<text x="{cx}" y="{lab_t + lh*0.78:.1f}" text-anchor="middle" '
                 f'font-family="Arial Narrow,Arial,sans-serif" font-weight="900" font-size="25" '
                 f'letter-spacing="-1" fill="{ink}">{speed}</text>')
    parts.append(f'<text x="{cx}" y="{lab_t + lh*0.95:.1f}" text-anchor="middle" '
                 f'font-family="Courier New,monospace" font-size="8" letter-spacing="2" fill="#7a6c50">{theme}</text>')

    xmin, xmax, ymin, ymax = -150, 330, -84, 270
    w = xmax - xmin; h = ymax - ymin
    body = '\n'.join(parts)
    svg = (f'<svg viewBox="{xmin} {ymin} {w} {h}" width="{round(w*scale)}" height="{round(h*scale)}" '
           f'xmlns="http://www.w3.org/2000/svg" style="overflow:visible">{body}</svg>')
    return svg, round(w * scale), round(h * scale)


# ==================== 概念页 HTML ====================
CSS = """
:root{
  --bg:      #1d110b;
  --bg-reel: #150b07;
  --bg-flash:#0c0710;
  --text:    #ece2cf;
  --muted:   #c3ad95;
  --dim:     #8a7460;
  --accent:  #f04a23;
  --rule:    rgba(240,74,35,.22);
  --mono: "Courier New","Consolas",ui-monospace,SFMono-Regular,monospace;
  --cond: "Arial Narrow",Arial,Helvetica,sans-serif;
  --serif: Georgia,"Times New Roman",serif;
}
*{box-sizing:border-box}
html,body{margin:0;background:#060302;color:var(--text);font-family:var(--cond)}
.wrap{max-width:1200px;margin:0 auto;padding:60px 26px 120px}
.doc-title{margin:0 0 6px;font-family:var(--mono);font-size:13px;letter-spacing:.32em;text-transform:uppercase;color:#f0a58f}
.doc-sub{margin:0 0 8px;font-family:var(--mono);font-size:11px;letter-spacing:.18em;color:var(--dim)}
.doc-note{max-width:820px;margin:18px 0 0;font-family:var(--serif);font-size:15px;line-height:1.85;color:#c7b79a}
.doc-note b{color:var(--accent);font-weight:400}
.rule{height:1px;background:var(--rule);margin:22px 0 42px}
.screen-label{display:flex;align-items:baseline;gap:14px;margin:48px 0 16px}
.screen-label .no{font-family:var(--mono);color:var(--accent);font-size:12px;letter-spacing:.2em}
.screen-label h2{margin:0;font-family:var(--cond);font-weight:900;letter-spacing:-.02em;font-size:24px;text-transform:uppercase}
.screen-label .en{font-family:var(--mono);font-size:11px;letter-spacing:.16em;color:var(--dim);text-transform:uppercase}
.frame{position:relative;border:1px solid rgba(240,74,35,.18);overflow:hidden;background:var(--bg)}

.grain::after{content:"";position:absolute;inset:0;z-index:99;pointer-events:none;opacity:.05;mix-blend-mode:soft-light;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E")}

.regmark{position:absolute;width:14px;height:14px;opacity:.4;z-index:5}
.regmark::before,.regmark::after{content:"";position:absolute;background:var(--accent)}
.regmark::before{top:50%;left:0;width:100%;height:1px;transform:translateY(-50%)}
.regmark::after{left:50%;top:0;height:100%;width:1px;transform:translateX(-50%)}
.regmark.tl{top:14px;left:14px}.regmark.tr{top:14px;right:14px}
.regmark.bl{bottom:14px;left:14px}.regmark.br{bottom:14px;right:14px}

.poster-headline{position:absolute;z-index:3;left:26px;top:26px;margin:0;font-family:var(--cond);
  font-weight:900;font-size:64px;letter-spacing:-.04em;line-height:.86;text-transform:uppercase;color:#fff}
.poster-headline .dim{color:rgba(255,255,255,.16)}
.poster-kicker{position:absolute;z-index:3;left:27px;top:118px;font-family:var(--mono);font-size:12px;letter-spacing:.18em;color:var(--accent);text-transform:uppercase}

.meta-top{position:absolute;top:24px;right:26px;z-index:4;display:flex;gap:16px;align-items:center;
  font-family:var(--mono);font-size:13px;letter-spacing:.1em;color:#fff}
.meta-top .on{color:var(--accent)}.meta-top .off{opacity:.45}

.floor{position:absolute;inset:0;z-index:2;display:flex;align-items:flex-end;justify-content:center;gap:48px;padding:0 40px 96px}

.desk-btn{position:absolute;right:26px;bottom:26px;z-index:5;padding:11px 18px;border:1px solid rgba(240,74,35,.65);
  background:transparent;color:#fff;font-family:var(--mono);font-size:14px;letter-spacing:.14em;text-transform:uppercase}
.desk-hint{position:absolute;bottom:28px;left:50%;transform:translateX(-50%);z-index:5;margin:0;
  font-family:var(--mono);font-size:13px;letter-spacing:.16em;color:#fff}
.halftone{position:absolute;right:0;bottom:0;width:220px;height:170px;opacity:.22;z-index:1;
  background-image:radial-gradient(rgba(240,74,35,.5) 1px,transparent 1.5px);background-size:8px 8px}

.reel-top{position:relative;z-index:4;display:flex;align-items:baseline;justify-content:space-between;
  font-family:var(--mono);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);padding:24px 26px 0}
.reel-top .back{color:var(--text)}
.reel-top .mid{text-align:center}.reel-top .mid b{display:block;color:#fff;font-family:var(--cond);font-weight:900;font-size:22px;letter-spacing:-.02em}
.reel-top .dev{color:var(--accent);border-bottom:1px solid rgba(240,74,35,.5);padding-bottom:2px}
.reel-body{position:relative;z-index:3;display:flex;align-items:center;gap:30px;padding:46px 40px 70px}
.film{position:relative;flex:1;min-width:0}
.film .sprock{height:20px;background-image:linear-gradient(90deg,transparent 0 14px,#070302 14px 26px,transparent 26px 38px);
  background-repeat:repeat-x;background-size:38px 20px}
.film .band{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:24px 16px;background:#1c0a06;
  border-top:1px solid rgba(240,74,35,.2);border-bottom:1px solid rgba(240,74,35,.2)}
.film .exp{border:1px solid rgba(240,74,35,.22);background:#0a0504}
.film .exp .ph{aspect-ratio:4/3;display:grid;place-items:center;background:#2a0e08}
.film .exp .ph span{font-family:var(--mono);font-size:9px;letter-spacing:.2em;color:rgba(240,74,35,.5)}
.film .exp .rec{padding:10px 10px 11px}
.film .exp .no{font-family:var(--mono);font-size:9px;letter-spacing:.16em;color:var(--accent)}
.film .exp .cap{margin:6px 0 8px;font-family:var(--serif);font-size:14px;line-height:1.45;color:#fff}
.film .exp .dt{font-family:var(--mono);font-size:10px;letter-spacing:.1em;color:var(--dim)}
.film .tail{position:absolute;right:-6px;top:50%;transform:translateY(-50%) rotate(180deg);writing-mode:vertical-rl;
  font-family:var(--mono);font-size:9px;letter-spacing:.2em;color:rgba(240,74,35,.5)}

.lightbox{min-height:540px;position:relative;background:#070303;padding:60px 40px;display:grid;place-items:center}
.light-card{width:min(920px,100%);display:grid;grid-template-columns:1.5fr 1fr;border:1px solid rgba(240,74,35,.24);background:#100806}
.light-card .ph{display:grid;place-items:center;min-height:380px;padding:26px;background:#120807}
.light-card .ph span{font-family:var(--mono);font-size:10px;letter-spacing:.2em;color:rgba(240,74,35,.45)}
.light-note{padding:44px 38px;border-left:1px solid rgba(240,74,35,.16);display:flex;flex-direction:column}
.light-note .k{font-family:var(--mono);font-size:9px;letter-spacing:.18em;color:var(--accent);text-transform:uppercase}
.light-note .cap{margin:22px 0 14px;font-family:var(--serif);font-size:19px;line-height:1.7;color:#fff}
.light-note .dt{font-family:var(--mono);font-size:13px;letter-spacing:.12em;color:#fff}
.light-note .acts{margin-top:auto;display:flex;flex-direction:column;gap:12px}
.light-note .acts button{text-align:left;padding:13px 15px;border:1px solid rgba(240,74,35,.5);background:transparent;
  color:#fff;font-family:var(--mono);font-size:14px;letter-spacing:.08em}
.light-note .acts button:first-child{background:var(--accent);border-color:var(--accent);color:#120401}
.light-hint{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);font-family:var(--mono);font-size:10px;letter-spacing:.2em;color:var(--dim)}

.chat{width:min(560px,100%);border:1px solid rgba(160,107,208,.3);background:var(--bg-flash)}
.chat-head{display:flex;align-items:baseline;gap:10px;padding:16px 20px;border-bottom:1px solid rgba(160,107,208,.22)}
.chat-head .dot{width:9px;height:9px;background:#a06bd0}
.chat-head b{font-family:var(--cond);font-weight:900;font-size:15px;color:#c9a2e6}
.chat-head small{font-family:var(--mono);font-size:10px;letter-spacing:.14em;color:rgba(160,107,208,.5)}
.chat-body{padding:20px;display:flex;flex-direction:column;gap:14px}
.chat .tag{font-family:var(--mono);font-size:12px;letter-spacing:.14em;color:rgba(205,179,224,.6)}
.chat .line{font-family:var(--serif);font-size:16px;line-height:1.75;color:#cdb3e0;margin:0}
.chat .me{align-self:flex-end;padding:9px 14px;background:#1d2a33;color:#cfe0e8;font-family:var(--serif);font-size:15px}
.chat-input{display:flex;gap:8px;padding:14px 16px;border-top:1px solid rgba(160,107,208,.22)}
.chat-input .box{flex:1;padding:11px 13px;border:1px solid rgba(160,107,208,.28);background:rgba(4,2,6,.5);font-family:var(--serif);font-size:14px;color:#d7cbb5}
.chat-input .go{padding:0 18px;border:1px solid rgba(160,107,208,.4);background:transparent;color:#a06bd0;font-family:var(--mono);font-size:11px;letter-spacing:.14em}

@media(max-width:760px){
  .poster-headline{font-size:40px}
  .floor{flex-wrap:wrap;gap:24px;padding:0 20px 80px}
  .light-card{grid-template-columns:1fr}.light-note{border-left:0;border-top:1px solid rgba(240,74,35,.16)}
  .reel-body{flex-direction:column;align-items:stretch}
}
"""


def can_html(tone, title, theme, speed='400', scale=1.0):
    return canister(tone, title, theme, speed, scale)[0]


def regmarks():
    return ('<span class="regmark tl"></span><span class="regmark tr"></span>'
            '<span class="regmark bl"></span><span class="regmark br"></span>')


html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>UNEXPOSED · 低多边形平面着色概念 (Low-poly Flat-shading Concept)</title>
<style>{CSS}</style>
</head>
<body>
<div class="wrap">

  <p class="doc-title">UNEXPOSED · 低多边形平面渲染</p>
  <p class="doc-sub">LOW-POLY / FLAT-SHADING — CONCEPT · 概念图</p>
  <div class="rule"></div>
  <p class="doc-note">
    保留现有<b>圆柱胶卷、桌面空间关系、胶片条</b>不变，只把「伪 3D 光影」换成<b>低多边形 + 平面着色</b>：
    胶卷筒用<b>描边（清晰轮廓）＋ 明显色阶（亮→暗 flat shading）＋ 硬边投影</b>表达体积感；
    页面是<b>海报式排版</b>——大色块背景承载情绪、无卡片/圆角/阴影面板/玻璃拟态、单一高对比强调色。
  </p>

  <!-- ============ 01 桌面 ============ -->
  <div class="screen-label"><span class="no">01</span><h2>桌面</h2><span class="en">THE TABLE</span></div>
  <div class="frame grain" style="height:680px">
    {regmarks()}
    <h1 class="poster-headline">未显影<span class="dim"> /<br>UNEXPOSED</span></h1>
    <p class="poster-kicker">03 · 密封胶卷 · C–41</p>
    <div class="meta-top"><span class="on">EN</span><span>/</span><span class="off">中</span><span style="opacity:.3">·</span><span class="on">SOUND ON</span></div>
    <div class="halftone"></div>
    <div class="floor">
      {can_html('mustard','那年夏天','盛夏','400',0.92)}
      {can_html('red','外婆的旧屋','归乡','400',1.0)}
      {can_html('green','深夜便利店','城市','400',0.92)}
    </div>
    <button class="desk-btn">+ 新胶卷</button>
    <p class="desk-hint">拖动整理 · 双击展开</p>
  </div>

  <!-- ============ 02 展开胶卷 ============ -->
  <div class="screen-label"><span class="no">02</span><h2>展开胶卷</h2><span class="en">THE REEL</span></div>
  <div class="frame grain" style="min-height:620px;background:#150b07">
    {regmarks()}
    <div class="reel-top">
      <span class="back">← 返回桌面</span>
      <span class="mid">当时 — 2019<b>那年夏天</b></span>
      <span class="dev">重新显影</span>
    </div>
    <div class="reel-body">
      <div style="flex:0 0 auto">{can_html('red','那年夏天','盛夏','400',0.86)}</div>
      <div class="film">
        <div class="sprock"></div>
        <div class="band">
          <div class="exp"><div class="ph"><span>01</span></div><div class="rec"><div class="no">01</div><div class="cap">海风把裙摆吹起来的那一秒。</div><div class="dt">2019 / 07 / 14</div></div></div>
          <div class="exp"><div class="ph"><span>02</span></div><div class="rec"><div class="no">02</div><div class="cap">她回头笑，我按晚了。</div><div class="dt">2019 / 07 / 14</div></div></div>
          <div class="exp"><div class="ph"><span>03</span></div><div class="rec"><div class="no">03</div><div class="cap">天快黑，我们谁都没说话。</div><div class="dt">2019 / 07 / 15</div></div></div>
        </div>
        <div class="sprock"></div>
        <div class="tail">UNEXPOSED · 03 EXP · C–41</div>
      </div>
    </div>
  </div>

  <!-- ============ 03 放大 + 闪回 ============ -->
  <div class="screen-label"><span class="no">03</span><h2>双击放大 · 闪回</h2><span class="en">THE LIGHTBOX &amp; FLASHBACK</span></div>
  <div class="frame grain" style="padding:44px;display:grid;place-items:center">
    <div class="lightbox" style="min-height:0;padding:0;width:100%;background:transparent">
      <div class="light-card">
        <div class="ph"><span>NEGATIVE · 01</span></div>
        <div class="light-note">
          <span class="k">留影 · REFLECTION</span>
          <p class="cap">海风把裙摆吹起来的那一秒，我其实没敢看镜头，只敢看她。</p>
          <span class="dt">2019 年 7 月 14 日</span>
          <div class="acts"><button>进入闪回模式</button><button>对话记录</button></div>
        </div>
      </div>
    </div>
  </div>

  <div class="screen-label"><span class="no">03b</span><h2>闪回对话</h2><span class="en">THE FLASHBACK</span></div>
  <div class="frame grain" style="padding:48px;display:grid;place-items:center;background:#0b050d">
    <div class="chat">
      <div class="chat-head"><span class="dot"></span><b>爬虫脑</b><small>ANCIENT REPTILIAN BRAIN · 显影者</small></div>
      <div class="chat-body">
        <span class="tag">[[哺乳脑]]</span>
        <p class="line">可你心里清楚，你其实不想真的忘了。</p>
        <p class="line">这张底片在抽屉里放了七年，你现在才敢把它拉出来。海是什么味道，你还记得吗？</p>
        <div class="me">那天她穿了条白裙子。</div>
      </div>
      <div class="chat-input"><div class="box">说点什么…</div><div class="go">发送</div></div>
    </div>
  </div>

  <div class="rule" style="margin-top:56px"></div>
  <p class="doc-note">
    确认后我会把这套「低多边形平面着色 + 海报式排版」替换进 <b>three.js 场景与 CSS</b>：
    3D 胶卷改用低多边形几何（<b>flatShading / toon 材质</b>）＋<b>描边与硬边阴影</b>，桌面/展开页/闪回统一为平面大色块 + 海报排版，
    去掉软投影、渐变、圆角与玻璃拟态，只保留一个高对比强调色（显影橙）。
  </p>
</div>
</body>
</html>
"""

with open('concept-lowpoly.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('written concept-lowpoly.html', len(html), 'bytes')
