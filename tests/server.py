# Test-only stand-in for the hub's database, upload function and file storage, plus a results inbox.
# Uses a fake family code (TESTCODE1234). No real family data is ever involved.
import json, os, re, uuid, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
ROOT=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(ROOT,'..','out'); os.makedirs(OUT+'/files',exist_ok=True)
CODE='TESTCODE1234'; BASE='http://127.0.0.1:8080'; MB=1048576; LOCK=threading.Lock()
EXT={'mp4':'video/mp4','mov':'video/quicktime','webm':'video/webm','jpg':'image/jpeg','png':'image/png','pdf':'application/pdf'}
DB={'entries':[],'settings':{'player':'Jaxson','jersey':'7','team':'Anglers'}}; FILES={}
norm=lambda k: re.sub('[^A-Za-z0-9]','',str(k or '')).upper()
TYPES={'.html':'text/html','.js':'text/javascript','.mov':'video/quicktime','.mp4':'video/mp4','.jpg':'image/jpeg','.heic':'image/heic','.pdf':'application/pdf','.png':'image/png','.woff2':'font/woff2','.webmanifest':'application/manifest+json'}
class H(BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def cors(self):
        self.send_header('Access-Control-Allow-Origin','*'); self.send_header('Access-Control-Allow-Headers','*'); self.send_header('Access-Control-Allow-Methods','GET,POST,PUT,OPTIONS')
    def do_OPTIONS(self): self.send_response(200); self.cors(); self.end_headers()
    def J(self,st,obj):
        b=json.dumps(obj).encode(); self.send_response(st); self.cors(); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b)
    def body(self):
        n=int(self.headers.get('Content-Length',0)); d=b''
        while len(d)<n: d+=self.rfile.read(n-len(d))
        return d
    def send_bytes(self,data,ct):
        rng=self.headers.get('Range')
        if rng:
            a,b=rng.split('=')[1].split('-'); a=int(a or 0); b=int(b) if b else len(data)-1; b=min(b,len(data)-1)
            self.send_response(206); self.cors(); self.send_header('Content-Range','bytes %d-%d/%d'%(a,b,len(data))); part=data[a:b+1]
        else: self.send_response(200); self.cors(); part=data
        self.send_header('Content-Type',ct); self.send_header('Accept-Ranges','bytes'); self.send_header('Content-Length',str(len(part))); self.end_headers(); self.wfile.write(part)
    def do_GET(self):
        path=self.path.split('?')[0]
        if '/object/sign/media/' in path:
            p=path.split('/object/sign/media/')[1]
            return self.send_bytes(FILES[p][1],FILES[p][0]) if p in FILES else self.J(404,{})
        f=os.path.normpath(os.path.join(ROOT,path.lstrip('/')))
        if not f.startswith(ROOT) or not os.path.isfile(f): return self.J(404,{})
        self.send_bytes(open(f,'rb').read(), TYPES.get(os.path.splitext(f)[1],'application/octet-stream'))
    def do_PUT(self):
        p=self.path.split('/upload/sign/media/')[1].split('?')[0]; data=self.body()
        with LOCK:
            FILES[p]=(self.headers.get('Content-Type'),data); fn=OUT+'/files/'+p.replace('/','_'); open(fn,'wb').write(data)
        self.J(200,{'Key':'media/'+p})
    def do_POST(self):
        path=self.path.split('?')[0]; raw=self.body()
        if path=='/__result':
            q=dict(x.split('=',1) for x in self.path.split('?')[1].split('&'))
            with LOCK: open(OUT+'/results.jsonl','a').write(json.dumps({'dev':q.get('dev'),'case':q.get('case'),'data':json.loads(raw or b'{}')})+'\n')
            print('RESULT',q.get('dev'),q.get('case'),raw[:400].decode(errors='replace'),flush=True); return self.J(200,{})
        b=json.loads(raw or b'{}')
        if path.endswith('/functions/v1/hub-media'):
            if norm(b.get('k'))!=CODE: return self.J(401,{'error':'denied'})
            used=sum(len(v[1]) for v in FILES.values()); a=b.get('action')
            if a=='usage': return self.J(200,{'used':used,'quota':950*MB,'maxFile':45*MB})
            if a=='sign_upload':
                if b.get('ext') not in EXT: return self.J(400,{'error':'That file type is not allowed.'})
                if not (0<b.get('size',0)<=45*MB): return self.J(400,{'error':'That file is too big. The limit is 45 MB.'})
                p='2026-11/'+str(uuid.uuid4())+'.'+b['ext']
                return self.J(200,{'path':p,'signedUrl':BASE+'/storage/v1/object/upload/sign/media/'+p+'?token=up','token':'up','contentType':EXT[b['ext']]})
            if a=='sign_read': return self.J(200,{'urls':{p:BASE+'/storage/v1/object/sign/media/'+p+'?token=rd' for p in b.get('paths',[]) if p in FILES}})
            if a=='delete': FILES.pop(b.get('path'),None); return self.J(200,{'ok':True})
            return self.J(400,{})
        fn=path.split('/rpc/')[-1]; ok=norm(b.get('k'))==CODE
        if fn=='hub_check': return self.J(200,ok)
        if not ok: return self.J(403,{'code':'28000'})
        if fn=='hub_load': return self.J(200,{'entries':[{'id':r['id'],'ts':r['ts'],'data':r['data']} for r in sorted(DB['entries'],key=lambda r:-r['ts'])],'settings':DB['settings']})
        if fn=='hub_media': ids=b.get('p_ids') or []; return self.J(200,{'rows':[{'id':r['id'],'media':r['media']} for r in DB['entries'] if r['id'] in ids]})
        if fn=='hub_add': r={'id':str(uuid.uuid4()),'ts':b['p_ts'],'data':b['p_data'],'media':b.get('p_media')}; DB['entries'].append(r); return self.J(200,{'id':r['id']})
        if fn=='hub_remove': DB['entries']=[r for r in DB['entries'] if r['id']!=b.get('p_id')]; return self.J(200,{'ok':True})
        if fn=='hub_save_settings': DB['settings']=b['p_data']; return self.J(200,{'ok':True})
        self.J(404,{})
print('serving on 8080',flush=True); ThreadingHTTPServer(('0.0.0.0',8080),H).serve_forever()
