# -*- coding: utf-8 -*-
"""Domwork lead-magnet PDF generator.

Usage:  python3 make.py [--check] [outdir]
Content lives in content.py (same folder). Russian strings mark stress with "+"
before the stressed vowel; this script renders it as a combining acute (U+0301)
and auto-builds an Uzbek-Latin pronunciation line.
"""
import os, re, sys, unicodedata
from xml.sax.saxutils import escape

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table,
                                TableStyle, KeepTogether, NextPageTemplate, PageBreak, Flowable,
                                CondPageBreak)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import content as C

# ---------------------------------------------------------------- fonts
HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(HERE, "..", "..", "student-app", "public", "fonts") + os.sep
for w in (400, 500, 600, 700, 800):
    pdfmetrics.registerFont(TTFont(f"On{w}", FONT_DIR + f"onest-{w}.ttf"))
pdfmetrics.registerFont(TTFont("DejaVu", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
from reportlab.lib.fonts import addMapping
addMapping("On400", 0, 0, "On400"); addMapping("On400", 1, 0, "On700")
addMapping("On400", 0, 1, "On400"); addMapping("On400", 1, 1, "On700")
addMapping("On500", 1, 0, "On700"); addMapping("On500", 0, 0, "On500")
addMapping("On500", 0, 1, "On500"); addMapping("On500", 1, 1, "On700")

LOGO = os.path.join(HERE, "logo.jpg")

# ---------------------------------------------------------------- colors
BLUE = colors.HexColor("#0A6CFF")
BLUE_D = colors.HexColor("#0753C7")
DARK = colors.HexColor("#0B1220")
TEXT = colors.HexColor("#243049")
MUTED = colors.HexColor("#5E6B85")
TR = colors.HexColor("#2F62C9")      # transliteration
ORANGE = colors.HexColor("#FF7A1A")
TINT = colors.HexColor("#EEF4FF")
TINT2 = colors.HexColor("#F6F9FF")
LINE = colors.HexColor("#DCE5F5")
OTINT = colors.HexColor("#FFF3E9")
WHITE = colors.white

W, H = A4
MX = 17 * mm
CW = W - 2 * MX

# ================================================================ Russian helpers
VOW = "аеёиоуыэюя"
ACC = {"a": "á", "o": "ó", "e": "é", "i": "í", "u": "ú"}
OVR = {  # irregular pronunciations (lowercase, without +)
    "здравствуйте": "zdrástvuyte", "пожалуйста": "pajálusta", "что": "shto", "чтобы": "shtóbi",
    "что-то": "shtó-ta", "что-нибудь": "shtó-nibud", "конечно": "kanéshna", "сегодня": "sevódnya",
    "его": "yevó", "ничего": "nichevó", "чего": "chevó", "кого": "kavó", "счёт": "shyot",
    "пин-код": "PIN-kód", "смс": "SMS", "узи": "UZI", "ндс": "NDS", "экг": "EKG",
    "сейчас": "seychás", "азиз": "Azíz", "азиза": "Azíza", "спасибо": "spasíba", "расчётный": "rashyótniy", "расчётном": "rashyótnam",
    "расчёт": "rashyót", "рассчитываете": "rashítivayete", "лёгким": "lyóxkim", "мягкий": "myáxkiy",
    "здесь": "zdes", "сдачи": "zdáchi", "сдать": "zdat", "сделать": "zdélat", "сделал": "zdélal",
    "сделала": "zdélala", "сделаю": "zdélayu", "сделайте": "zdélayte",
}
NO_OGO = {"много", "немного", "дорого", "строго", "долго", "недорого", "недолго", "того"}
CLITICS = {"по", "до", "о", "об", "от", "со", "во", "ко", "но", "под", "про", "обо"}
NO_DEVOICE = {"из", "без", "под", "над", "перед", "через", "раз"}
DEV = dict(zip("бвгджз", "пфктшс"))
VOICELESS = set("пфктшсхцчщ")

MAP = {"а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "ж": "j", "з": "z", "и": "i", "й": "y",
       "к": "k", "л": "l", "м": "m", "н": "n", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
       "ф": "f", "х": "x", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sh", "ъ": "", "ы": "i", "ь": "",
       "э": "e"}

WARN = []


def parse_word(w):
    """returns (plain_lower, stressed_index or None, has_upper_first)"""
    plain, stress = "", None
    i = 0
    while i < len(w):
        if w[i] == "+":
            stress = len(plain)
        else:
            plain += w[i]
        i += 1
    return plain, stress


def translit_word(w):
    plain, stress = parse_word(w)
    low = plain.lower()
    cap = plain[:1].isupper()
    allcap = len(plain) > 1 and plain.isupper()
    if low in OVR:
        out = OVR[low]
        if allcap and low in ("смс", "узи", "ндс", "экг"):
            return out
        return out[:1].upper() + out[1:] if cap else out
    if "-" in low:
        parts = re.split(r"(-)", w)
        res = "".join(p if p == "-" else translit_word(p) for p in parts)
        return res
    nv = sum(1 for ch in low if ch in VOW)
    if stress is None and "ё" in low:
        stress = low.index("ё")
    if nv >= 2 and stress is None:
        WARN.append(f"no stress: {w}")
    clitic = nv == 1 and low in CLITICS
    mono = nv <= 1
    s = list(low)
    # -ого / -его genitive endings -> v
    if (low.endswith("ого") or low.endswith("его")) and low not in NO_OGO and nv >= 2:
        s[-2] = "в"
    # regressive devoicing inside word
    for i in range(len(s) - 1):
        if s[i] in DEV and s[i + 1] in VOICELESS:
            s[i] = DEV[s[i]]
    # final devoicing
    if nv >= 1 and low not in NO_DEVOICE:
        j = len(s) - 1
        while j >= 0 and s[j] in "ьъ":
            j -= 1
        if j >= 0 and s[j] in DEV:
            s[j] = DEV[s[j]]
    out = []
    for i, ch in enumerate(s):
        prev = s[i - 1] if i > 0 else ""
        st = (i == stress) and not mono
        if ch == "е":
            r = "ye" if (i == 0 or prev in VOW or prev in "ьъ") else "e"
        elif ch == "ё":
            r = "o" if prev in "жшчщц" else "yo"
        elif ch == "я":
            r = "ya"
        elif ch == "ю":
            r = "yu"
        elif ch == "о":
            if mono:
                r = "a" if clitic else "o"
            else:
                r = "o" if i == stress else "a"
        else:
            r = MAP.get(ch, ch)
        if st and r:
            r = r[:-1] + ACC.get(r[-1], r[-1])
        out.append(r)
    res = "".join(out)
    res = re.sub(r"tsya$", "tsa", res)
    res = res.replace("tstv", "stv").replace("vstv", "stv").replace("sch", "sh")
    if cap:
        res = res[:1].upper() + res[1:]
    return res


CYR_WORD = re.compile(r"[А-Яа-яЁё+\-]+")


def translit(text):
    def rep(m):
        w = m.group(0)
        if not re.search(r"[А-Яа-яЁё]", w):
            return w
        lead = re.match(r"^-*", w).group(0)
        trail = re.search(r"-*$", w).group(0)
        core = w[len(lead):len(w) - len(trail)] if trail else w[len(lead):]
        return lead + translit_word(core) + trail
    return CYR_WORD.sub(rep, text)


def ru_fmt(text):
    """'+' before vowel -> vowel + U+0301 (only lowercase, multi-vowel words)."""
    def rep(m):
        w = m.group(0)
        plain = w.replace("+", "")
        nv = sum(1 for ch in plain.lower() if ch in VOW)
        out, i = "", 0
        while i < len(w):
            if w[i] == "+" and i + 1 < len(w):
                v = w[i + 1]
                if nv >= 2 and v.islower() and v != "ё":
                    out += v + "́"
                else:
                    out += v
                i += 2
            else:
                out += w[i]
                i += 1
        return out
    return re.sub(r"[А-Яа-яЁё+]+", rep, text)


def check_text(s, where):
    for m in re.finditer(r"\w+", s.replace("+", "")):
        w = m.group(0)
        if re.search(r"[А-Яа-яЁё]", w) and re.search(r"[A-Za-z]", w):
            WARN.append(f"mixed latin/cyrillic '{w}' in {where}")
    if "+" in s and re.search(r"\+[^аеёиоуыэюяАЕЁИОУЫЭЮЯ]", s):
        WARN.append(f"bad + in: {s}")


# ================================================================ styles
def st(name, font="On400", size=10, leading=None, color=TEXT, **kw):
    return ParagraphStyle(name, fontName=font, fontSize=size, leading=leading or size * 1.32,
                          textColor=color, **kw)

S_RU = st("ru", "On600", 11.5, 14.5, DARK)
S_TR = st("tr", "On400", 9.2, 12, TR)
S_UZ = st("uz", "On400", 10.2, 13.2, TEXT)
S_NUM = st("num", "On700", 9.5, 12, BLUE, alignment=TA_CENTER)
S_BODY = st("body", "On400", 10.2, 14.5, TEXT)
S_SMALL = st("small", "On400", 9, 12.5, MUTED)
S_H3 = st("h3", "On700", 12, 15, DARK)
S_TIPH = st("tiph", "On700", 9.5, 12, ORANGE)
S_TIP = st("tip", "On400", 9.6, 13.2, TEXT)


def P(text, style):
    return Paragraph(text, style)


def uz_markup(t):
    t = ru_fmt(t)
    m = re.match(r"^(.*?)\s*\(([^()]*)\)\s*$", t)
    if m:
        return f'{escape(m.group(1))} <font name="On400" size="8.6" color="#7A879F">({escape(m.group(2))})</font>'
    return escape(t)


# ================================================================ flowables
class SectionHead(Flowable):
    def __init__(self, num, uz, ru):
        super().__init__()
        self.num, self.uz, self.ru = num, uz, ru
        self.height = 15 * mm

    def wrap(self, aw, ah):
        self.width = aw
        return aw, self.height

    def draw(self):
        c = self.canv
        s = 10.5 * mm
        y0 = (self.height - s) / 2
        c.setFillColor(BLUE)
        c.roundRect(0, y0, s, s, 2.6 * mm, stroke=0, fill=1)
        c.setFillColor(WHITE)
        c.setFont("On700", 11.5)
        c.drawCentredString(s / 2, y0 + s / 2 - 4, f"{self.num:02d}" if isinstance(self.num, int) else self.num)
        c.setFillColor(DARK)
        c.setFont("On700", 14.5)
        c.drawString(s + 4 * mm, y0 + s / 2 + 0.6, self.uz)
        c.setFillColor(MUTED)
        c.setFont("On500", 9.5)
        c.drawString(s + 4 * mm, y0 + s / 2 - 11, self.ru)


class NumDot(Flowable):
    def __init__(self, n, r=3.3 * mm, color=None):
        super().__init__(); self.n, self.r, self.color = n, r, color or BLUE

    def wrap(self, aw, ah):
        return 2 * self.r, 2 * self.r

    def draw(self):
        c = self.canv
        c.setFillColor(self.color); c.circle(self.r, self.r, self.r, stroke=0, fill=1)
        c.setFillColor(WHITE); c.setFont("On700", 9.5)
        c.drawCentredString(self.r, self.r - 3.3, str(self.n))


class Bar(Flowable):
    """thin decorative divider"""
    def __init__(self, h=4 * mm):
        super().__init__(); self.h = h

    def wrap(self, aw, ah):
        self.w = aw; return aw, self.h

    def draw(self):
        c = self.canv
        c.setStrokeColor(LINE); c.setLineWidth(0.6)
        c.line(0, self.h / 2, self.w, self.h / 2)


def phrase_table(items, start=1):
    rows, styles = [], []
    for k, it in enumerate(items):
        ru, uz = it[0], it[1]
        check_text(ru, ru)
        ru_cell = [P(escape(ru_fmt(ru)), S_RU), Spacer(1, 1.2), P(escape(translit(ru)), S_TR)]
        rows.append([P(str(start + k), S_NUM), ru_cell, P(uz_markup(uz), S_UZ)])
        if k % 2 == 1:
            styles.append(("BACKGROUND", (0, k), (-1, k), TINT2))
    t = Table(rows, colWidths=[10 * mm, 93 * mm, CW - 103 * mm], cornerRadii=[5, 5, 5, 5])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 6.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (0, -1), 8.2),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
        ("LINEAFTER", (1, 0), (1, -1), 0.4, LINE),
    ] + styles))
    return t


def tip_box(title, text, label="Maslahat", color=ORANGE, bg=OTINT):
    hs = ParagraphStyle("th", parent=S_TIPH, textColor=color)
    inner = [P(f"{escape(label.upper())}  ·  {escape(ru_fmt(title))}", hs), Spacer(1, 2.5),
             P(escape(ru_fmt(text)), S_TIP)]
    t = Table([[inner]], colWidths=[CW], cornerRadii=[4, 4, 4, 4])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LINEBEFORE", (0, 0), (0, -1), 3, color),
        ("LEFTPADDING", (0, 0), (-1, -1), 11), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return t


def dialogue_block(d, idx):
    roles = d["roles"]
    rcol = [BLUE, ORANGE]
    rbg = [TINT2, WHITE]
    head = Table([[[P(f'<font color="#0A6CFF">DIALOG {idx}</font>  ·  {escape(d["title"])}', S_H3),
                    Spacer(1, 2), P(escape(d["context"]), S_SMALL)]]], colWidths=[CW])
    head.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                              ("TOPPADDING", (0, 0), (-1, -1), 0)]))
    rows, styles = [], []
    sr = st("dru", "On600", 10.8, 13.8, DARK)
    stt = st("dtr", "On400", 8.8, 11.4, TR)
    su = st("duz", "On400", 9.6, 12.4, MUTED)
    for k, (who, ru, uz) in enumerate(d["lines"]):
        check_text(ru, ru)
        role_st = st("role", "On700", 8.8, 11, rcol[who])
        rows.append([P(escape(roles[who]), role_st),
                     [P(escape(ru_fmt(ru)), sr), Spacer(1, 1), P(escape(translit(ru)), stt), Spacer(1, 1.5),
                      P(uz_markup(uz), su)]])
        styles += [("BACKGROUND", (0, k), (-1, k), rbg[who]),
                   ("LINEBEFORE", (0, k), (0, k), 2.6, rcol[who])]
    t = Table(rows, colWidths=[25 * mm, CW - 25 * mm], cornerRadii=[5, 5, 5, 5])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (0, -1), 7.5),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
    ] + styles))
    return [CondPageBreak(55 * mm), head, t]


def interview_card(i, q):
    check_text(q["q"], "q"); check_text(q["a"], "a")
    sq = st("q", "On700", 12.2, 15.5, DARK)
    sl = st("lbl", "On700", 7.8, 10, BLUE)
    sa = st("a", "On500", 10.4, 14, DARK)
    sau = st("au", "On400", 9.4, 12.6, MUTED)
    r0 = [P(f"SAVOL {i}", sl), Spacer(1, 2), P(escape(ru_fmt(q["q"])), sq), Spacer(1, 1),
          P(escape(translit(q["q"])), S_TR), Spacer(1, 2), P(escape(q["q_uz"]), st("quz", "On500", 10, 13, TEXT))]
    r1 = [P("JAVOB NAMUNASI", st("lbl2", "On700", 7.8, 10, MUTED)), Spacer(1, 2.5),
          P(escape(ru_fmt(q["a"])), sa), Spacer(1, 2.5), P(escape(q["a_uz"]), sau)]
    r2 = [P(f'<font name="On700" color="#E5650C">Maslahat:</font> {escape(ru_fmt(q["tip"]))}', st("tp", "On400", 9.3, 12.6, TEXT))]
    t = Table([[r0], [r1], [r2]], colWidths=[CW], cornerRadii=[6, 6, 6, 6])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), TINT), ("BACKGROUND", (0, 2), (-1, 2), OTINT),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 11), ("RIGHTPADDING", (0, 0), (-1, -1), 11),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8.5),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, LINE),
    ]))
    return KeepTogether([t, Spacer(1, 5 * mm)])


def howto_block(doc):
    is_int = "interview" in doc
    steps = ([
        ("Ovoz chiqarib o‘qing", "Har bir savol va javobni 3 marta baland ovozda o‘qing — urg‘uli bo‘g‘inga e’tibor bering."),
        ("Javobni o‘zingizga moslang", "Namunadagi ism, yosh va tajribani o‘zingiznikiga almashtiring va yozib chiqing."),
        ("Telefonga yozib oling", "Javobingizni ovozli yozib, eshitib ko‘ring: qayerda to‘xtalyapsiz?"),
        ("Kimdir bilan mashq qiling", "Do‘st yoki ustoz savol bersin — siz javob bering. Bu haqiqiy suhbatga eng yaqin mashq."),
    ] if is_int else [
        ("3 marta ovoz chiqarib o‘qing", "Har bir gapni baland ovozda o‘qing — urg‘uli bo‘g‘inga e’tibor bering."),
        ("Kuniga 5 ta ibora", "Ertalab 5 ta iborani o‘qing, kechqurun tarjimaga qarab ularni yoddan ayting."),
        ("Real vaziyatda ishlating", "Bugun o‘rgangan iborangizni do‘konda, ishda yoki telefonda ayting."),
        ("Takrorlang", "Har hafta oxirida avvalgi iboralarga qayting — takrorlamagan narsa tez unutiladi."),
    ])
    left = [P("Qanday foydalanish", st("hh", "On800", 15, 18, DARK)), Spacer(1, 3 * mm)]
    for n, (h, d) in enumerate(steps, 1):
        cell = Table([[NumDot(n),
                       [P(escape(h), st("sh", "On700", 10.4, 13, DARK)), P(escape(d), st("sd", "On400", 9.4, 12.6, MUTED))]]],
                     colWidths=[9 * mm, 78 * mm - 9 * mm])
        cell.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        left += [cell, Spacer(1, 3.2 * mm)]
    key_rows = [
        ("á", "Urg‘u belgisi. Shu unli kuchliroq va cho‘ziqroq aytiladi: " + ru_fmt("Спас+ибо") + " → spasíba."),
        ("o → a", "Urg‘usiz «о» ko‘pincha «a» kabi o‘qiladi: " + ru_fmt("хорош+о") + " → xarashó."),
        ("ы", "O‘zbek tilida aniq muqobili yo‘q. Talaffuzda «i» deb yozdik — tilni biroz orqaga tortib ayting."),
        ("!", "Ba’zi so‘zlar yozilishidan boshqacha o‘qiladi: что → shto, сег+одня → sevódnya.".replace("сег+одня", ru_fmt("сег+одня"))),
    ]
    right = [P("O‘qish kaliti", st("hh2", "On800", 13, 16, DARK)), Spacer(1, 2.5 * mm),
             P("Har bir ibora uch qatordan iborat:", st("k0", "On400", 9.3, 12.5, MUTED)), Spacer(1, 2)]
    demo = Table([[[P(ru_fmt("Здр+авствуйте!"), S_RU), P("Zdrástvuyte!", S_TR), P("Assalomu alaykum!", st("du", "On400", 9.6, 12.5, TEXT))]]],
                 colWidths=[CW - 92 * mm])
    demo.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), WHITE), ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                              ("LEFTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6),
                              ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
    right += [demo, Spacer(1, 1.5),
              P('<font color="#0B1220">ruscha</font> · <font color="#2F62C9">o‘qilishi</font> · <font color="#243049">tarjima</font>',
                st("k1", "On500", 8.4, 11, MUTED)), Spacer(1, 3 * mm)]
    for sym, txt in key_rows:
        r = Table([[P(escape(sym), st("ks", "On800", 11, 13, BLUE, alignment=TA_CENTER)), P(escape(txt), st("kt", "On400", 9.1, 12.3, TEXT))]],
                  colWidths=[12 * mm, CW - 92 * mm - 12 * mm])
        r.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                               ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
                               ("TOPPADDING", (0, 0), (-1, -1), 0)]))
        right.append(r)
    right += [Spacer(1, 1.5), P("Talaffuz yozuvi — taxminiy yordamchi. Eng aniq talaffuz jonli nutqni eshitib, takrorlab o‘rganiladi.",
                                st("k2", "On400", 8.4, 11.4, MUTED))]
    t = Table([[left, right]], colWidths=[86 * mm, CW - 86 * mm], cornerRadii=[7, 7, 7, 7])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (1, 0), (1, 0), TINT), ("BACKGROUND", (0, 0), (0, 0), WHITE),
        ("BOX", (0, 0), (-1, -1), 0.8, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 11), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


# ================================================================ page painters
def hexagon(c, cx, cy, r, fill=None, stroke=None, lw=1):
    import math
    p = c.beginPath()
    for k in range(6):
        a = math.radians(90 + 60 * k)
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        (p.moveTo if k == 0 else p.lineTo)(x, y)
    p.close()
    if fill is not None:
        c.setFillColor(fill)
    if stroke is not None:
        c.setStrokeColor(stroke); c.setLineWidth(lw)
    c.drawPath(p, fill=1 if fill is not None else 0, stroke=1 if stroke is not None else 0)


def draw_para(c, text, style, x, y_top, w):
    p = Paragraph(text, style)
    _, h = p.wrap(w, 1000)
    p.drawOn(c, x, y_top - h)
    return h


def count_items(doc):
    if "interview" in doc:
        return len(doc["interview"])
    return sum(len(s["items"]) for s in doc["sections"])


def paint_cover(c, doc):
    c.saveState()
    c.setFillColor(WHITE); c.rect(0, 0, W, H, stroke=0, fill=1)
    top_h = H * 0.50
    # blue panel
    c.setFillColor(BLUE)
    c.rect(0, H - top_h, W, top_h, stroke=0, fill=1)
    # decorative hexagons
    c.setFillColor(colors.Color(1, 1, 1, alpha=0.07))
    hexagon(c, W - 28 * mm, H - 40 * mm, 58 * mm, fill=colors.Color(1, 1, 1, alpha=0.06))
    hexagon(c, W - 28 * mm, H - 40 * mm, 40 * mm, fill=colors.Color(1, 1, 1, alpha=0.06))
    hexagon(c, W - 70 * mm, H - top_h + 10 * mm, 22 * mm, stroke=colors.Color(1, 1, 1, alpha=0.18), lw=1.2)
    hexagon(c, W - 14 * mm, H - top_h + 30 * mm, 9 * mm, fill=ORANGE)
    # logo card
    lx, ly, ls = MX, H - 15 * mm - 30 * mm, 30 * mm
    c.setFillColor(WHITE)
    c.roundRect(lx, ly, ls, ls, 5 * mm, stroke=0, fill=1)
    pad = 3.2 * mm
    c.drawImage(LOGO, lx + pad, ly + pad, ls - 2 * pad, ls - 2 * pad, preserveAspectRatio=True, mask="auto")
    # kicker pill
    kick = doc["kicker"]
    c.setFont("On700", 9)
    kw = c.stringWidth(kick, "On700", 9) + 9 * mm
    ky = ly - 13 * mm
    c.setFillColor(ORANGE)
    c.roundRect(MX, ky, kw, 7 * mm, 3.5 * mm, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.drawString(MX + 4.5 * mm, ky + 2.35 * mm, kick)
    # title
    tsize = 34 if len(doc["title"]) <= 26 else 27
    ts = st("ct", "On800", tsize, tsize * 1.08, WHITE)
    y = ky - 6 * mm
    h = draw_para(c, escape(doc["title"]), ts, MX, y, CW - 30 * mm)
    y -= h + 4 * mm
    h = draw_para(c, escape(ru_fmt(doc["title_ru"])), st("ctr", "On500", 15, 19, colors.HexColor("#CFE0FF")), MX, y, CW - 30 * mm)
    # lower part
    y = H - top_h - 13 * mm
    h = draw_para(c, escape(doc["subtitle"]), st("cs", "On400", 12, 17.5, TEXT), MX, y, CW - 8 * mm)
    y -= h + 8 * mm
    # chips
    chips = [ch if ch else (str(count_items(doc)), "ta ibora") for ch in doc["chips"]]
    gap = 4 * mm
    cw3 = (CW - 2 * gap) / 3
    for k, (big, small) in enumerate(chips):
        x = MX + k * (cw3 + gap)
        c.setFillColor(TINT)
        c.roundRect(x, y - 21 * mm, cw3, 21 * mm, 4 * mm, stroke=0, fill=1)
        c.setFillColor(BLUE)
        c.setFont("On800", 22)
        c.drawString(x + 5 * mm, y - 11 * mm, big)
        draw_para(c, escape(small), st("chs", "On500", 9.2, 11.5, TEXT), x + 5 * mm, y - 13.3 * mm, cw3 - 9 * mm)
    y -= 21 * mm + 9 * mm
    # sample phrase preview
    if doc.get("interview"):
        samples = [(q["q"], q["q_uz"]) for q in doc["interview"][:3]]
    else:
        samples = []
        for sec in doc["sections"]:
            for it in sec["items"]:
                uzc = re.sub(r"\s*\([^()]*\)\s*$", "", it[1])
                if len(it[0].replace("+", "")) <= 30 and len(uzc) <= 40 and "—" not in it[0]:
                    samples.append((it[0], uzc)); break
            if len(samples) == 3:
                break
    c.setFillColor(MUTED); c.setFont("On700", 8.5)
    c.drawString(MX, y, "ICHIDA SHUNDAY KO‘RINADI")
    y -= 4 * mm
    avail = y - 26 * mm
    bh = min(19 * mm, (avail - 2 * 3.5 * mm) / 3)
    for k, sample in enumerate(samples):
        c.setFillColor(WHITE if k else TINT2); c.setStrokeColor(LINE); c.setLineWidth(0.8)
        c.roundRect(MX, y - bh, CW, bh, 3.5 * mm, stroke=1, fill=1)
        c.setFillColor(BLUE if k != 1 else ORANGE)
        c.roundRect(MX, y - bh, 2 * mm, bh, 1 * mm, stroke=0, fill=1)
        ru = sample[0]
        size = 13.5 if len(ru) < 34 else 11.5
        draw_para(c, escape(ru_fmt(ru)), st("sr", "On700", size, size * 1.2, DARK), MX + 7 * mm, y - bh / 2 + 6.3 * mm, 104 * mm)
        draw_para(c, escape(translit(ru)), st("st", "On500", 9.8, 12, TR), MX + 7 * mm, y - bh / 2 - 0.6 * mm, 104 * mm)
        draw_para(c, uz_markup(sample[1]), st("su", "On400", 10, 13, TEXT), MX + 114 * mm, y - bh / 2 + 3 * mm, CW - 119 * mm)
        y -= bh + 3.5 * mm
    # footer
    c.setStrokeColor(LINE); c.setLineWidth(0.6)
    c.line(MX, 19 * mm, W - MX, 19 * mm)
    c.setFillColor(DARK); c.setFont("On700", 9.5)
    c.drawString(MX, 12.5 * mm, "Domwork")
    c.setFillColor(MUTED); c.setFont("On400", 9.5)
    c.drawString(MX + c.stringWidth("Domwork ", "On700", 9.5), 12.5 * mm, "— rus tilini shaxsiy ustoz bilan")
    c.setFillColor(BLUE); c.setFont("On600", 9.5)
    c.drawRightString(W - MX, 12.5 * mm, "@Domworkuz_bot")
    c.restoreState()


def paint_inner(c, doc_obj):
    doc = doc_obj._guide
    c.saveState()
    c.setFillColor(WHITE); c.rect(0, 0, W, H, stroke=0, fill=1)
    # header
    c.drawImage(LOGO, MX, H - 17.5 * mm, 9 * mm, 9 * mm, preserveAspectRatio=True, mask="auto")
    c.setFillColor(DARK); c.setFont("On800", 10)
    c.drawString(MX + 11 * mm, H - 13.4 * mm, "Domwork")
    c.setFillColor(MUTED); c.setFont("On500", 8.6)
    c.drawRightString(W - MX, H - 13.4 * mm, doc["short"])
    c.setStrokeColor(LINE); c.setLineWidth(0.6)
    c.line(MX, H - 20 * mm, W - MX, H - 20 * mm)
    c.setFillColor(BLUE)
    c.rect(MX, H - 20.3 * mm, 14 * mm, 0.9, stroke=0, fill=1)
    # footer
    c.line(MX, 17 * mm, W - MX, 17 * mm)
    c.setFillColor(DARK); c.setFont("On700", 8.6)
    c.drawString(MX, 11 * mm, "Domwork")
    c.setFillColor(MUTED); c.setFont("On400", 8.6)
    c.drawString(MX + c.stringWidth("Domwork ", "On700", 8.6), 11 * mm, "— rus tilini shaxsiy ustoz bilan")
    n = str(c.getPageNumber())
    c.setFillColor(BLUE)
    c.roundRect(W - MX - 9 * mm, 9.2 * mm, 9 * mm, 5.6 * mm, 2.8 * mm, stroke=0, fill=1)
    c.setFillColor(WHITE); c.setFont("On700", 8.6)
    c.drawCentredString(W - MX - 4.5 * mm, 10.9 * mm, n)
    c.restoreState()


def paint_cta(c, doc_obj):
    c.saveState()
    c.setFillColor(WHITE); c.rect(0, 0, W, H, stroke=0, fill=1)
    ph = 92 * mm
    c.setFillColor(BLUE); c.rect(0, H - ph, W, ph, stroke=0, fill=1)
    hexagon(c, W - 22 * mm, H - 22 * mm, 42 * mm, fill=colors.Color(1, 1, 1, alpha=0.07))
    hexagon(c, W - 22 * mm, H - 22 * mm, 26 * mm, fill=colors.Color(1, 1, 1, alpha=0.07))
    hexagon(c, W - 14 * mm, H - ph + 12 * mm, 5 * mm, fill=ORANGE)
    # logo chip
    c.setFillColor(WHITE)
    c.roundRect(MX, H - 16 * mm - 16 * mm, 16 * mm, 16 * mm, 3 * mm, stroke=0, fill=1)
    c.drawImage(LOGO, MX + 1.8 * mm, H - 32 * mm + 1.8 * mm, 12.4 * mm, 12.4 * mm, preserveAspectRatio=True, mask="auto")
    y = H - 42 * mm
    c.setFillColor(colors.HexColor("#CFE0FF")); c.setFont("On700", 9)
    c.drawString(MX, y, "KEYINGI QADAM")
    y -= 4 * mm
    h = draw_para(c, "Iboralarni bilish — boshlanish.<br/>Gapirish — mashq bilan keladi.",
                  st("cth", "On800", 23, 27, WHITE), MX, y, CW - 25 * mm)
    y -= h + 4 * mm
    draw_para(c, "Yodlangan ibora jonli suhbatda ishlatilgandagina «sizniki» bo‘ladi. "
                 "Domwork aynan shu mashq uchun qurilgan: siz ustoz bilan gaplashasiz, xatolaringiz shu zahoti tuzatiladi.",
              st("ctl", "On400", 11, 15.5, colors.HexColor("#E6EFFF")), MX, y, CW - 20 * mm)
    # features
    y = H - ph - 10 * mm
    c.setFillColor(DARK); c.setFont("On800", 13.5)
    c.drawString(MX, y, "Domwork — pullik individual kurs. Unda:")
    y -= 5 * mm
    feats = [
        ("Video darslar", "Mavzuni o‘zingizga qulay vaqtda, qayta-qayta ko‘rib o‘rganasiz."),
        ("Ustoz bilan jonli 1:1 dars", "Faqat siz va ustoz: gapirish, talaffuz va xatolar ustida ishlash."),
        ("Ilovada har kungi mashq", "Qisqa topshiriqlar: so‘z, grammatika va tinglash — har kuni oz-ozdan."),
        ("Yordamchi ustoz", "Savollaringizga javob beradi va mashqlaringizni kuzatib boradi."),
    ]
    gw = (CW - 5 * mm) / 2
    fh = 25 * mm
    for k, (t1, t2) in enumerate(feats):
        col, row = k % 2, k // 2
        x = MX + col * (gw + 5 * mm)
        yy = y - row * (fh + 4 * mm) - fh
        c.setFillColor(TINT); c.roundRect(x, yy, gw, fh, 4 * mm, stroke=0, fill=1)
        hexagon(c, x + 9 * mm, yy + fh - 9 * mm, 4.6 * mm, fill=BLUE)
        c.setFillColor(WHITE); c.setFont("On800", 9.5)
        c.drawCentredString(x + 9 * mm, yy + fh - 9 * mm - 3.3, str(k + 1))
        c.setFillColor(DARK); c.setFont("On700", 11)
        c.drawString(x + 17 * mm, yy + fh - 9 * mm - 3.6, t1)
        draw_para(c, escape(t2), st("fd", "On400", 9.4, 12.6, MUTED), x + 6 * mm, yy + fh - 15.5 * mm, gw - 11 * mm)
    y -= 2 * (fh + 4 * mm) + 6 * mm
    # steps
    c.setFillColor(DARK); c.setFont("On800", 13.5)
    c.drawString(MX, y, "Qanday boshlash mumkin")
    y -= 7 * mm
    steps = [
        "Telegramda <b>@Domworkuz_bot</b> ga qayting.",
        "Botdagi shu tugmani bosing:",
        "Menejer darajangizni aniqlaydi va siz uchun shaxsiy o‘quv reja tuzib beradi. "
        "Xohlasangiz, ustoz bilan jonli sinov darsi ham tashkil qilinadi.",
    ]
    for k, s in enumerate(steps):
        c.setFillColor(ORANGE if k == 1 else BLUE)
        c.circle(MX + 3.6 * mm, y - 2.6 * mm, 3.6 * mm, stroke=0, fill=1)
        c.setFillColor(WHITE); c.setFont("On700", 9.5)
        c.drawCentredString(MX + 3.6 * mm, y - 2.6 * mm - 3.3, str(k + 1))
        h = draw_para(c, s, st("sp", "On400", 10.6, 14.5, TEXT), MX + 11 * mm, y + 0.2 * mm, CW - 11 * mm)
        if k == 1:
            # telegram-like button
            bx, bw, bh = MX + 11 * mm + c.stringWidth("Botdagi shu tugmani bosing:  ", "On400", 10.6), 70 * mm, 9.5 * mm
            by = y - 7.4 * mm
            c.setFillColor(colors.HexColor("#E8F0FF")); c.setStrokeColor(BLUE); c.setLineWidth(1)
            c.roundRect(bx, by, bw, bh, 2.8 * mm, stroke=1, fill=1)
            c.setFillColor(BLUE)
            label = "Menejer bilan bog‘lanish"
            c.setFont("On700", 10.5)
            lw = c.stringWidth(label, "On700", 10.5) + 6 * mm
            sx = bx + (bw - lw) / 2
            c.setFont("DejaVu", 12); c.drawString(sx, by + 3 * mm, "☎")
            c.setFont("On700", 10.5); c.drawString(sx + 6 * mm, by + 3.1 * mm, label)
            h = max(h, 10 * mm)
        y -= h + 5 * mm
    y -= 1 * mm
    # channels
    cwid = (CW - 5 * mm) / 2
    chs = [("@domwork", "Asosiy kanal: foydali mini-darslar va yangiliklar"),
           ("@domwork_natijalari", "O‘quvchilarimiz natijalari va fikrlari")]
    for k, (a, b) in enumerate(chs):
        x = MX + k * (cwid + 5 * mm)
        c.setFillColor(WHITE); c.setStrokeColor(LINE); c.setLineWidth(0.8)
        c.roundRect(x, y - 17 * mm, cwid, 17 * mm, 4 * mm, stroke=1, fill=1)
        c.setFillColor(BLUE); c.setFont("On800", 12)
        c.drawString(x + 6 * mm, y - 7.5 * mm, a)
        draw_para(c, escape(b), st("chd", "On400", 9.2, 12, MUTED), x + 6 * mm, y - 9.3 * mm, cwid - 10 * mm)
    y -= 17 * mm + 7 * mm
    draw_para(c, "Bu qo‘llanma sizda qoladi — istalgan vaqtda qaytib o‘qishingiz mumkin. Omad!",
              st("bye", "On500", 10, 13.5, MUTED, alignment=TA_CENTER), MX, y, CW)
    # footer
    c.setStrokeColor(LINE); c.setLineWidth(0.6)
    c.line(MX, 17 * mm, W - MX, 17 * mm)
    c.setFillColor(DARK); c.setFont("On700", 8.6)
    c.drawString(MX, 11 * mm, "Domwork")
    c.setFillColor(MUTED); c.setFont("On400", 8.6)
    c.drawString(MX + c.stringWidth("Domwork ", "On700", 8.6), 11 * mm, "— rus tilini shaxsiy ustoz bilan")
    c.setFillColor(BLUE); c.setFont("On600", 8.6)
    c.drawRightString(W - MX, 11 * mm, "@Domworkuz_bot")
    c.restoreState()


# ================================================================ build
def build(doc, outdir):
    path = os.path.join(outdir, doc["fname"])
    bd = BaseDocTemplate(path, pagesize=A4, leftMargin=MX, rightMargin=MX, topMargin=26 * mm, bottomMargin=23 * mm,
                         title=doc["title"], author="Domwork", subject=doc["subtitle"], creator="Domwork")
    bd._guide = doc
    fr = Frame(MX, 23 * mm, CW, H - 26 * mm - 23 * mm, id="f", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    full = Frame(MX, 20 * mm, CW, H - 40 * mm, id="cf")
    bd.addPageTemplates([
        PageTemplate("Cover", frames=[full], onPage=lambda c, d: paint_cover(c, doc)),
        PageTemplate("Inner", frames=[fr], onPage=paint_inner),
        PageTemplate("CTA", frames=[full], onPage=paint_cta),
    ])
    story = [NextPageTemplate("Inner"), PageBreak()]
    story.append(howto_block(doc))
    story.append(Spacer(1, 6 * mm))
    if doc.get("disclaimer"):
        story += [tip_box(doc["disclaimer"][0], doc["disclaimer"][1], label="Muhim", color=BLUE, bg=TINT), Spacer(1, 6 * mm)]
    num = 1
    if "interview" in doc:
        for i, q in enumerate(doc["interview"], 1):
            story.append(interview_card(i, q))
        ex = doc["extra"]
        story += [CondPageBreak(60 * mm), SectionHead("+", ex["uz"], ex["ru"]), Spacer(1, 2.5 * mm),
                  phrase_table(ex["items"]), Spacer(1, 6 * mm)]
    for si, s in enumerate(doc["sections"], 1):
        story += [CondPageBreak(48 * mm), SectionHead(si, s["uz"], ru_fmt(s["ru"])), Spacer(1, 2.5 * mm),
                  phrase_table(s["items"], num)]
        items = s["items"]
        num += len(items)
        if s.get("tip"):
            story += [Spacer(1, 3 * mm), KeepTogether([tip_box(*s["tip"])])]
        story.append(Spacer(1, 7 * mm))
    if doc.get("dialogues"):
        story += [CondPageBreak(90 * mm), SectionHead(len(doc["sections"]) + 1, "Namunaviy dialoglar", ru_fmt("Диал+оги")),
                  Spacer(1, 3 * mm)]
        for i, d in enumerate(doc["dialogues"], 1):
            story += dialogue_block(d, i)
            story.append(Spacer(1, 7 * mm))
    story += [NextPageTemplate("CTA"), PageBreak(), Spacer(1, 1)]
    bd.build(story)
    return path


def fix_split_corners(t):
    return t


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    outdir = args[0] if args else os.path.join(HERE, "..", "..", "server", "data", "funnel")
    os.makedirs(outdir, exist_ok=True)
    if "--check" in sys.argv:
        for d in C.ALL:
            secs = list(d.get("sections", []))
            if d.get("extra"):
                secs.append(d["extra"])
            for s in secs:
                for ru, uz in s["items"]:
                    print(f"{ru_fmt(ru):55s} | {translit(ru)}")
            for q in d.get("interview", []):
                print(ru_fmt(q["q"]), "|", translit(q["q"]))
                print("   A:", ru_fmt(q["a"]), "|", translit(q["a"]))
            for dd in d.get("dialogues", []):
                for _, ru, _ in dd["lines"]:
                    print(f"  {ru_fmt(ru):55s} | {translit(ru)}")
        print("\n".join(sorted(set(WARN))))
        sys.exit()
    for d in C.ALL:
        p = build(d, outdir)
        print("built", p)
    if WARN:
        print("WARNINGS:\n" + "\n".join(sorted(set(WARN))))
