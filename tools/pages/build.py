import sys
import os; os.chdir('/tmp/claude-0/-home-claude/e22d336b-1df2-5eb2-93bb-eeaeb5ebc44b/scratchpad'); P='artifact-files/4ca862e0-d7fb-4492-a28b-ba71c68598aa/project/'
body,jsf,out,title=sys.argv[1:5]
conv=open(P+'RopKL_I.dc.html').read(); i=conv.index('.cvback{'); j=conv.index('</style>',i)
extra=""".box h2{margin:0;font-size:15px;font-weight:800}
.tag{font-size:12px;font-weight:800;color:#0057B8;background:#EAF3FF;border-radius:999px;padding:4px 10px}
.qq-g3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.qq-tl{display:flex;flex-direction:column;gap:6px}.qq-tlbar{display:flex;border-radius:10px;overflow:hidden;height:34px;font-size:12px;font-weight:700}
.qq-seg{display:flex;align-items:center;padding:0 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qq-seg.qq-ok{background:#ECFDF3;color:#067647}.qq-seg.qq-warn{background:#FFFAEB;color:#93370D}.qq-seg.qq-lock{background:#FEF3F2;color:#B42318}
.qq-prev{padding:10px 12px;border-radius:12px;background:#F8FAFC;border:1px solid #E6EAF2;font-size:13px}
.qq-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;font-size:13px;color:#3A4456}.qq-steps li{display:flex;gap:10px}
.qq-dot{flex:none;width:10px;height:10px;border-radius:50%;margin-top:4px}.qq-dot.qq-ok{background:#12B76A}.qq-dot.qq-warn{background:#F79009}.qq-dot.qq-lock{background:#D92D20}.qq-dot.qq-mute{background:#94A3B8}
.qq-t{display:flex;flex-direction:column;font-size:13px}.qq-tr{display:grid;grid-template-columns:2fr 1fr 1fr 1.4fr;align-items:center;padding:10px 8px;border-bottom:1px solid #EEF2F6}.qq-th{font-size:12px;color:#4B5563;font-weight:700}
.qq-mn{font-weight:700;display:flex;align-items:center;gap:8px}.qq-av{width:26px;height:26px;border-radius:50%;display:inline-grid;place-items:center;font-size:11px;font-weight:800;flex:none}
.qq-pill{display:inline-block;min-width:24px;text-align:center;border-radius:999px;padding:2px 8px;font-weight:800}.qq-pw{background:#FEF0C7;color:#93370D}.qq-pl{background:#FEE4E2;color:#B42318}.qq-pz{color:#64748B}.qq-prev.qq-bad{background:#FEF3F2;border-color:#FECDCA;color:#B42318;font-weight:700}
.sk{height:14px;border-radius:7px;background:#E9EEF5;margin:6px 0}
.malert{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:#FEF3F2;border:1px solid #FECDCA;color:#B42318;font-size:13px;font-weight:700}
"""
h=open('helmet.txt').read().replace('</style>',conv[i:j]+extra+'</style>',1)
t=open(body).read().replace('__NAV__',open('nav.txt').read())
js=open(jsf).read().replace('__NAVJS__',open('navjs.txt').read()).replace('__MKNAV__',open('mknav.txt').read())
o='<!doctype html>\n<html lang="uz">\n<head>\n<meta charset="utf-8">\n<title>'+title+'</title>\n<script src="./support.js"></script>\n</head>\n<body>\n<x-dc>\n'+h+'\n'+t+'</x-dc>\n<script type="text/x-dc" data-dc-script data-props=\'{"$preview":{"width":1440,"height":960}}\'>\n'+js+'</script>\n</body>\n</html>\n'
open(P+out,'w').write(o)
