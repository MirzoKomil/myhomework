import sys, os
os.chdir('/tmp/claude-0/-home-claude/e22d336b-1df2-5eb2-93bb-eeaeb5ebc44b/scratchpad'); P='artifact-files/4ca862e0-d7fb-4492-a28b-ba71c68598aa/project/'
body,jsf,out,title=sys.argv[1:5]
src=open('pages/build.py').read()
i=src.index('extra="""'); j=src.index('"""',i+9); extra=src[i+9:j]
conv=open(P+'RopKL_I.dc.html').read(); a=conv.index('.cvback{'); b=conv.index('</style>',a)
h=open('helmet.txt').read().replace('</style>',conv[a:b]+extra+'</style>',1)
D='pages/sot/'
hdr=open(D+'header.txt').read()
t=open(body).read().replace('__NAV__',open(D+'nav.txt').read()).replace('__HDR__',hdr)
js=open(jsf).read().replace('__NAVJS__',open(D+'navjs.txt').read()).replace('__MKNAV__',open(D+'mknav.txt').read())
o='<!doctype html>\n<html lang="uz">\n<head>\n<meta charset="utf-8">\n<title>'+title+'</title>\n<script src="./support.js"></script>\n</head>\n<body>\n<x-dc>\n'+h+'\n'+t+'</x-dc>\n<script type="text/x-dc" data-dc-script data-props=\'{"$preview":{"width":1440,"height":960}}\'>\n'+js+'</script>\n</body>\n</html>\n'
open(P+out,'w').write(o)
