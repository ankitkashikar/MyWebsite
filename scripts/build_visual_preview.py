"""Export a standalone visual preview; never modify the production configuration."""
from pathlib import Path
import subprocess, shutil, json, re
root=Path(__file__).resolve().parents[1]
out=root.parent/'TCB-visual-preview'
if out.exists(): raise SystemExit('Preview folder already exists; choose a fresh output directory before rebuilding.')
out.mkdir()
files=subprocess.check_output(['git','ls-files'],cwd=root,text=True).splitlines()
allowed={'.html','.css','.js','.svg','.png','.jpg','.jpeg','.webp','.ico','.woff','.woff2','.gif'}
for name in files:
 p=Path(name)
 if len(p.parts)>1 and p.parts[0] not in {'images','assets','fonts'}:continue
 if p.suffix.lower() not in allowed:continue
 target=out/p;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/p,target)
p=out/'supabase-config.js'
s=p.read_text().replace('https://ncbyfovvetvmkrlzapku.supabase.co','https://preview-disabled.invalid')
s=re.sub(r'const SUPABASE_ANON_KEY = "[^"]+";', 'const SUPABASE_ANON_KEY = "preview-disabled";',s)
p.write_text(s)
for p in out.glob('*.html'):
 s=p.read_text().replace('<head>','<head>\n<meta name="robots" content="noindex,nofollow">\n<script src="preview-only.js"></script>',1)
 s=s.replace('yourbusiness@upi','preview-disabled')
 p.write_text(s)
(out/'preview-only.js').write_text('''document.addEventListener('DOMContentLoaded',()=>{
 const note=document.createElement('div');
 note.textContent='Visual preview — orders, payments and account access are disabled.';
 note.setAttribute('role','status');note.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:999999;background:#fff3cd;color:#332700;text-align:center;padding:8px;font:13px sans-serif;';document.body.append(note);
 document.addEventListener('click',e=>{const el=e.target.closest('#btnPayUpiApp,#btnConfirmPayment,#btnConfirmCod,#btnPlaceOrder,#btnLogin,#signInButton,a[href^="upi:"]');if(el){e.preventDefault();e.stopImmediatePropagation();alert('Visual preview only. This action needs the isolated staging backend.');}},true);
});
''')
(out/'vercel.json').write_text(json.dumps({'version':2,'framework':None,'buildCommand':None,'outputDirectory':'.','cleanUrls':True,'headers':[{'source':'/(.*)','headers':[{'key':'Content-Security-Policy','value':"connect-src 'self' https://cdn.jsdelivr.net; form-action 'none'; object-src 'none'; base-uri 'self'"},{'key':'X-Robots-Tag','value':'noindex, nofollow'}]}]},indent=2)+'\n')
assert not any('ncbyfovvetvmkrlzapku' in p.read_text() for p in out.glob('*.js'))
assert not (out/'supabase').exists()
print('Visual preview exported:',out)
print('No production API configuration, backend source, credentials or QA database files exported.')
