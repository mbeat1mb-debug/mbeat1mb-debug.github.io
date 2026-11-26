# Builds one self-contained page so the page and its code can never be out of step.
import re, sys
src=__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/'
h=open(src+'page.html').read()
for f in ['logic.js','swing.js','games.js','dynasty.js','mp4mux.js','media.js','app.js']:
    tag='<script src="%s"></script>' % f
    assert h.count(tag)==1, tag
    code=open(src+f).read()
    assert '</script' not in code.lower(), f+' contains a closing script tag'
    h=h.replace(tag, '<script>\n'+code+'\n</script>')
# version the 3D games file so iPads never run a stale cached copy next to a new page
import hashlib, os
d3=os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])),'derby3d.js')
if os.path.exists(d3):
    v=hashlib.md5(open(d3,'rb').read()).hexdigest()[:10]
    assert h.count("import('./derby3d.js')")>=1
    h=h.replace("import('./derby3d.js')", "import('./derby3d.js?v=%s')" % v)
open(sys.argv[1],'w').write(h)
# offline helper, stamped with this build so the iPad picks up each new version
sw=os.path.join(os.path.dirname(os.path.abspath(__file__)),'sw.js')
if os.path.exists(sw):
    swv=open(sw).read().replace('__VERSION__', hashlib.md5(h.encode()).hexdigest()[:10]).replace('__D3__', v if os.path.exists(d3) else '')
    open(os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])),'sw.js'),'w').write(swv)
print('built', sys.argv[1], len(h.encode())//1024, 'KB')
