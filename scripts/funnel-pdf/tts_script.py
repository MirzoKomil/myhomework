import sys,re
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import content as c
def ru(s): return re.sub(r'\+(.)', lambda m: m.group(1) if m.group(1) in 'ёЁ' else m.group(1)+'\u0301', s)
def uz(s): return re.sub(r'\s*\([^)]*\)\s*$','',s).strip()
out={}
for name in ['SOVGA','UMUMIY','OFFICE','BANK','MED','GOV','SALES','DAILY','SMENA','HUJJAT','KUNDALIK']:
    d=getattr(c,name)
    lines=[f"Assalomu alaykum! Bu — Domwork qo‘llanmasining audio varianti: «{d['title']}». Avval o‘zbekcha ma’nosini aytaman, keyin ruschasini ikki marta — siz ikkinchi marta men bilan birga takrorlang."]
    for q in d.get('interview',[]):
        lines.append(f"\nSavol: {q['q_uz']} — {ru(q['q'])} … {ru(q['q'])}")
        lines.append(f"Javob namunasi: {ru(q['a'])}")
    secs=list(d.get('sections',[]))+([d['extra']] if d.get('extra') else [])
    for sec in secs:
        lines.append(f"\n{sec['uz']}.")
        for it in sec.get('items',[]):
            if isinstance(it,(list,tuple)) and len(it)>=2 and isinstance(it[0],str):
                r,u=it[0],it[1]
                if '/' in r: r=r.split('/')[0].strip()
                lines.append(f"{uz(u)} — {ru(r)} … {ru(r)}")
    lines.append("\nBarakalla! Har kuni 5 ta gapni ovoz chiqarib takrorlang. Shaxsiy ustoz bilan jonli mashq qilmoqchi bo‘lsangiz — Domwork botida «Menejer bilan bog‘lanish» tugmasini bosing.")
    out[name]='\n'.join(lines)
    open(f'{d["fname"].replace(".pdf",".txt")}','w').write(out[name])
for k,v in out.items(): print(k,len(v))
