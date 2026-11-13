import json,random,re,collections,unicodedata
d=json.load(open('/tmp/mc.json'));L=d['lessons'];C=d['lessonContents'];EX=d['examContents']
strip=lambda s:unicodedata.normalize('NFD',s).replace('́','').lower() if s else ''
lesson={}
for i,l in enumerate(L,1):
    c=C.get(l['id'],{});lesson[i]=c
def parts(n,kind): return [p for p in lesson[n].get('homeworkParts',[]) if p.get('kind')==kind]
def vocab(n): return [v for v in lesson[n].get('vocabulary',[]) if vru(v)]
import glob
STRESS={}
for f in glob.glob('/home/claude/ru/content/ru/L*.json'):
    for v in json.load(open(f)).get('vocab',[]): STRESS[v.get('vocabId')]=v['ru']
def vru(v): return STRESS.get(v.get('id')) or v.get('russian') or v.get('word') or v.get('ru') or v.get('english')
def vuz(v): return v.get('translation') or v.get('uz')
def vimg(v): return v.get('image') or v.get('imageUrl')
# token index for lessonRef
tok=lambda s:set(re.findall(r'[а-яё]{3,}',strip(s)))
ltok={}
for n in range(1,73):
    s=json.dumps(lesson[n],ensure_ascii=False); ltok[n]=tok(s)
def guess_ref(text,lo,hi):
    t=tok(text); best=max(range(lo,hi+1),key=lambda n:(len(t&ltok[n]),-n)); return best
SPEAKERS=['Абдулази́з','Нигора́','Ти́мур','Дильно́за','Бобу́р','Анто́н','Сардо́р','Маржо́на']
def build(key,lo,hi,counts,seed):
    R=random.Random(seed);bank=[];warn=[]
    rng=range(lo,hi+1);V=3
    # LUG'AT
    words=[(n,v) for n in rng for v in vocab(n) if vimg(v) and vuz(v)]
    R.shuffle(words);need=counts['vocab']*V
    if len(words)<need: warn.append(f'vocab {len(words)}<{need}')
    used=words[:need]
    for i,(n,v) in enumerate(used):
        others=[w for m,w in words if strip(vru(w))!=strip(vru(v)) and vuz(w)!=vuz(v)]
        dist=R.sample(others,3)
        if i%2==0:
            opts=[vru(v)]+[vru(w) for w in dist];R.shuffle(opts)
            q={'kind':'vocabImage','image':vimg(v),'imageAlt':'1-rasm','question':'Rasmda nima?','options':opts,'correctIndex':opts.index(vru(v))}
        else:
            opts=[vuz(v)]+[vuz(w) for w in dist];R.shuffle(opts)
            q={'kind':'multipleChoice','question':f'«{vru(v)}» so\'zining tarjimasi qaysi?','options':opts,'correctIndex':opts.index(vuz(v))}
        q.update(section='vocab',lessonRef=n,slot=i//V+0,variant=i%V);bank.append(q)
    # GRAMMATIKA
    g=[]
    for q in EX.get(key,{}).get('questions',[]):
        if q['kind'] in('multipleChoice','fillBlank'):
            txt=(q.get('question') or q.get('sentence') or '')
            if re.search(r'matn|Matn',txt): continue
            qq=dict(q);qq['lessonRef']=guess_ref(json.dumps(q,ensure_ascii=False),lo,hi);g.append(qq)
    for n in rng:
        for p in parts(n,'multipleChoice'):
            for q in p['questions']:
                if 'Matn' in q['question']: continue
                g.append({'kind':'multipleChoice','question':q['question'],'options':q['options'],'correctIndex':q['correctIndex'],'lessonRef':n,'fromHomework':True})
        for p in parts(n,'fillBlank'):
            for b in p['blanks']:
                g.append({'kind':'fillBlank','sentence':b['sentence'],'options':b['options'],'answer':b['answer'],'lessonRef':n,'fromHomework':True})
    def dd(xs):
        seen=set();o=[]
        for x in xs:
            k=strip(json.dumps([x.get('question'),x.get('sentence'),x.get('options')],ensure_ascii=False))
            if k in seen: continue
            seen.add(k);o.append(x)
        return o
    g=dd(g)
    exam_first=[x for x in g if not x.get('fromHomework')];hw=[x for x in g if x.get('fromHomework')];R.shuffle(hw)
    pool=exam_first+hw;need=counts['grammar']*V
    if len(pool)<need: warn.append(f'grammar {len(pool)}<{need}')
    R.shuffle(exam_first);pool=exam_first+hw
    for i,q in enumerate(pool[:need]):
        q=dict(q);q.pop('id',None);q.pop('fromHomework',None);q.update(section='grammar',slot=i%counts['grammar'],variant=i//counts['grammar']);bank.append(q)
    # O'QISH
    texts=[]
    for n in rng:
        rp=parts(n,'reading');mcq=[q for p in parts(n,'multipleChoice') for q in p['questions'] if 'Matn' in q['question']]
        if rp and len(mcq)>=4:
            par=rp[0].get('paragraph',{});texts.append((n,par.get('russianText'),par.get('uzbekText'),mcq))
    R.shuffle(texts);ntext=counts['reading']//4
    if len(texts)<ntext*V: warn.append(f'reading texts {len(texts)}<{ntext*V}')
    for t,(n,ru,uz,mcq) in enumerate(texts[:ntext*V]):
        qs=R.sample(mcq,4)
        for k,q in enumerate(qs):
            bank.append({'kind':'reading','passageId':f'{key}-p{t}','passage':ru,'question':q['question'].replace('Matn bo\'yicha: ',''),'options':q['options'],'correctIndex':q['correctIndex'],'section':'reading','lessonRef':n,'slot':(t%ntext)*4+k,'variant':t//ntext})
    # GAP TUZISH
    sb=[]
    for q in EX.get(key,{}).get('questions',[]):
        if q['kind']=='sentenceBuild': qq=dict(q);qq['lessonRef']=guess_ref(' '.join(q['answer']),lo,hi);sb.append(qq)
    hwsb=[]
    for n in rng:
        for p in parts(n,'sentenceBuild'):
            for it in p['items']: hwsb.append({'kind':'sentenceBuild','words':it['words'],'answer':it['answer'],'translation':it.get('translation'),'lessonRef':n})
    R.shuffle(sb);R.shuffle(hwsb);need=counts['build']*V
    pool=[];seen=set()
    for x in sb+hwsb:
        k=strip(' '.join(x['answer']))
        aw=[strip(w) for w in x['answer'] if re.search(r'\w',w)];ww=[strip(w) for w in x['words']]
        if k in seen or not all(ww.count(w)>=aw.count(w) for w in set(aw)): continue
        seen.add(k);pool.append(x)
    if len(pool)<need: warn.append(f'build {len(pool)}<{need}')
    for i,q in enumerate(pool[:need]):
        q=dict(q);q.pop('id',None);ans=[w for w in q['answer'] if re.search(r'\w',w)];words=[w for w in q['words'] if re.search(r'\w',w)]
        punct=''.join(w for w in q['answer'] if not re.search(r'\w',w))
        q.update(answer=ans,words=words,punct=punct or '.',accepted=[ans],section='build',slot=i%counts['build'],variant=i//counts['build']);bank.append(q)
    # TINGLASH
    dl=[(n,a) for n in rng for a in lesson[n].get('audioDialogs',[]) if a.get('audioUrl') and len(a.get('lines',[]))>=4]
    R.shuffle(dl);nd=counts['listen']//3
    if len(dl)<nd*V: warn.append(f'dialogs {len(dl)}<{nd*V}')
    titles=[a['title'].split(' — ')[-1] for n,a in dl]
    alluz=[ln['uz'] for n,a in dl for ln in a['lines']]
    for t,(n,a) in enumerate(dl[:nd*V]):
        base={'kind':'listening','audioUrl':a['audioUrl'],'durationSec':a.get('durationSec'),'playUntil':a.get('repeatFrom'),'dialogId':a['id'],'maxPlays':2,'section':'listen','lessonRef':n,'variant':t//nd}
        tt=a['title'].split(' — ')[-1];o=[tt]+R.sample([x for x in titles if x!=tt],2);R.shuffle(o)
        q1=dict(base,question='Dialog nima haqida?',options=o,correctIndex=o.index(tt),slot=(t%nd)*3)
        sp=sorted({ln['speaker'] for ln in a['lines']});ln=R.choice(a['lines'])
        so=sp+[x for x in SPEAKERS if strip(x) not in {strip(s) for s in sp}][:3-len(sp)];so=so[:3]
        if ln['speaker'] not in so: so[0]=ln['speaker']
        R.shuffle(so)
        q2=dict(base,question=f'«{ln["uz"]}» — buni kim aytdi?',options=so,correctIndex=so.index(ln['speaker']),slot=(t%nd)*3+1)
        ln3=R.choice([x for x in a['lines'] if x is not ln]);mine={x['uz'] for x in a['lines']}
        o3=[ln3['uz']]+R.sample([x for x in alluz if x not in mine],2);R.shuffle(o3)
        q3=dict(base,question='Dialogda qaysi gap eshitildi?',options=o3,correctIndex=o3.index(ln3['uz']),slot=(t%nd)*3+2)
        bank+= [q1,q2,q3]
    for i,q in enumerate(bank): q['id']=f'{key}-{q["section"]}-{q["slot"]:02d}-v{q["variant"]}'
    total=sum(counts.values())
    return {'id':key,'lessons':[lo,hi],'sections':[{'key':k,'count':counts[k]} for k in ['vocab','grammar','reading','build','listen']],'totalQuestions':total,'durationSec':35*60 if total<=46 else 45*60,'passPercent':65,'sectionMinPercent':50,'variants':3,'cooldownHours':24,'bank':bank},warn
CNT={'vocab':8,'grammar':14,'reading':8,'build':10,'listen':6}
out={};W={}
for k in range(1,7):
    out[f'interval-{k}'],W[k]=build(f'interval-{k}',12*k-11,12*k,CNT,k)
out['final'],W['final']=build('final',1,72,{'vocab':10,'grammar':18,'reading':12,'build':11,'listen':9},99)
import os;os.makedirs('/home/claude/exam/out',exist_ok=True)
for k,v in out.items():
    json.dump(v,open(f'/home/claude/exam/out/{k}.json','w'),ensure_ascii=False,indent=1)
    c=collections.Counter((q['section'],q['variant']) for q in v['bank'])
    print(k,len(v['bank']),dict(c) if W.get(k.split('-')[-1] if k!='final' else 'final') else '', W)
