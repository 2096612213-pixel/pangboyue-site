from pathlib import Path
import concurrent.futures,hashlib,json,os,re,shutil,subprocess,time
ROOT=Path(__file__).resolve().parent.parent
BASE=ROOT/'favorsongs'
FFMPEG=os.environ.get('FFMPEG') or shutil.which('ffmpeg')
if not FFMPEG: raise SystemExit('Install ffmpeg or set FFMPEG to its executable path')
VERSION=1

def unescape(s):return re.sub(r'\\(.)',r'\1',s)
def build(song):
 src=BASE/song['file'];stem=src.stem
 out=BASE/'streams'/f'{stem}.m4a';detail=BASE/'details'/f'{stem}.json';cover=BASE/'details'/f'{stem}.jpg'
 digest=hashlib.sha256(src.read_bytes()).hexdigest()
 if out.exists() and detail.exists():
  old=json.loads(detail.read_text())
  if old.get('sourceHash')==digest and old.get('buildVersion')==VERSION and old.get('streamBytes')==out.stat().st_size:return out.stat().st_size,False
 meta=subprocess.run([FFMPEG,'-hide_banner','-i',str(src),'-f','ffmetadata','-'],capture_output=True,check=True)
 # Preserve escaped newlines inside lyrics rather than treating them as new keys.
 text=meta.stdout.decode('utf8','replace').replace('\\\n','\x00')
 tags={unescape(k).lower():unescape(v).replace('\x00','\n') for row in text.splitlines() if not row.startswith((';','[')) and '=' in row for k,v in [row.split('=',1)]}
 hascover=b'(attached pic)' in meta.stderr
 temp=out.with_suffix('.tmp.m4a')
 args=[FFMPEG,'-v','error','-nostdin','-y','-i',str(src),'-map','0:a:0','-vn','-map_metadata','-1','-c:a','aac','-b:a','80k','-ar','44100','-ac','2','-movflags','+faststart',str(temp)]
 if hascover:args+=['-map','0:v:0','-frames:v','1','-vf','scale=192:192:force_original_aspect_ratio=decrease','-q:v','6','-update','1',str(cover)]
 subprocess.run(args,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,check=True)
 temp.replace(out)
 data={'buildVersion':VERSION,'sourceHash':digest,'streamBytes':out.stat().st_size,'title':tags.get('title',''),'artist':tags.get('artist',''),'album':tags.get('album',''),'lyrics':tags.get('lyrics',tags.get('unsyncedlyrics','')),'cover':f'details/{stem}.jpg' if hascover else None}
 detail.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
 return out.stat().st_size,True

def main():
 for d in ['streams','details']:(BASE/d).mkdir(exist_ok=True)
 songs=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {songs} from './favorsongs/songs.js';console.log(JSON.stringify(songs))"],cwd=ROOT))
 start=time.time();size=0
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
  for n,(b,changed) in enumerate(pool.map(build,songs),1):
   size+=b
   if n%25==0 or n==len(songs):print(f'{n}/{len(songs)} | {size/1e6:.1f} MB | {time.time()-start:.0f}s',flush=True)
 print('DONE',flush=True)
if __name__=='__main__':main()
