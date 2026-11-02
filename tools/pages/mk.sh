cd /tmp/claude-0/-home-claude/e22d336b-1df2-5eb2-93bb-eeaeb5ebc44b/scratchpad; D=$PWD
python3 pages/build.py $D/pages/$1/body.html $D/pages/$1/js.txt $2 "$3" && cp artifact-files/4ca862e0-d7fb-4492-a28b-ba71c68598aa/project/$2 rr/ && python3 chk.py rr/$2
python3 -c "
s=open('rr/$2').read(); i=s.index('class Component'); j=s.index('</script>',i); open('pages/t.js','w').write(s[i:j])"; node --check pages/t.js && echo syntax ok
