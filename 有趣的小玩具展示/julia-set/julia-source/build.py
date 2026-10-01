from pathlib import Path
import json
src=Path(__file__).resolve().parent
root=src.parent
css=(src/'style.css').read_text()
shaders='// 3. SHADERS — GLSL sources embedded for offline file:// operation.\n'
shaders+='const VERTEX_SHADER='+json.dumps((src/'shaders/julia.vert').read_text())+';\n'
shaders+='const FRAGMENT_SHADER='+json.dumps((src/'shaders/julia.frag').read_text())+';\n'
js='(()=>{\n'+(src/'constants.js').read_text()+'\n'+shaders+'\n'
for name in ['juliaRenderer.js','controls.js','main.js']:js+=(src/name).read_text()+'\n'
js+='})();'
html=(src/'page.html').read_text().replace('<!-- BUILD:STYLE -->','<style>\n'+css+'\n</style>').replace('<!-- BUILD:SCRIPTS -->','<script>\n'+js+'\n</script>')
(root/'index.html').write_text(html)
# The delivered HTML contains the complete offline bundle.
print('Built',len(html.encode()),'bytes; fully offline')
