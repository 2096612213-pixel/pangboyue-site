// Read-only, dependency-free preview of the published site, including media seeking.
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat, realpath} from 'node:fs/promises';
import {dirname, extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=await realpath(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const args=process.argv.slice(2);
if(args.length===1&&args[0]==='--help') {
  console.log('用法：node scripts/preview.mjs [--port 8787]\n浏览器打开终端显示的地址；按 Control+C 停止。');
  process.exit(0);
}
if(args.length && (args.length!==2 || args[0]!=='--port' || !/^\d+$/.test(args[1]))) {
  console.error('用法：node scripts/preview.mjs [--port 8787]');process.exit(1);
}
const port=args.length?Number(args[1]):8787;
if(!Number.isInteger(port)||port<0||port>65535) {
  console.error('端口必须是 0—65535 之间的整数。');process.exit(1);
}
const mime={
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8',
  '.txt':'text/plain; charset=utf-8','.glsl':'text/plain; charset=utf-8',
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.gif':'image/gif',
  '.webp':'image/webp','.avif':'image/avif','.svg':'image/svg+xml','.ico':'image/x-icon',
  '.mp3':'audio/mpeg','.m4a':'audio/mp4','.mp4':'video/mp4','.webm':'video/webm',
  '.ogg':'audio/ogg','.wav':'audio/wav','.pdf':'application/pdf',
  '.wasm':'application/wasm','.woff':'font/woff','.woff2':'font/woff2',
  '.ttf':'font/ttf','.glb':'model/gltf-binary','.gltf':'model/gltf+json',
};
function inside(path) {return path===root||path.startsWith(root+sep);}
function reply(res,status,message,headers={}) {
  res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store',...headers});res.end(message);
}
const server=createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)) {reply(res,405,'只支持读取文件。',{Allow:'GET, HEAD'});return;}
  try {
    const url=new URL(req.url,'http://127.0.0.1');
    let pathname;
    try {pathname=decodeURIComponent(url.pathname);}catch {reply(res,400,'地址编码无效。');return;}
    if(pathname.includes('\0')) {reply(res,400,'地址无效。');return;}
    if(pathname.split('/').some(part=>part.startsWith('.')&&part!=='.'&&part!=='..')) {
      reply(res,403,'不能读取隐藏文件。');return;
    }
    let file=resolve(root,`.${pathname}`);
    if(!inside(file)) {reply(res,403,'文件不在网站目录内。');return;}
    file=await realpath(file);
    if(!inside(file)) {reply(res,403,'文件不在网站目录内。');return;}
    let info=await stat(file);
    if(info.isDirectory()) {
      if(!url.pathname.endsWith('/')) {
        res.writeHead(301,{Location:`${url.pathname}/${url.search}`,'Cache-Control':'no-store'});res.end();return;
      }
      file=await realpath(resolve(file,'index.html'));
      if(!inside(file)) {reply(res,403,'文件不在网站目录内。');return;}
      info=await stat(file);
    }
    if(!info.isFile()) {reply(res,404,'找不到该文件。');return;}
    let start=0,end=info.size-1,status=200;
    const headers={'Content-Type':mime[extname(file).toLowerCase()]||'application/octet-stream',
      'Cache-Control':'no-store','Accept-Ranges':'bytes'};
    if(req.headers.range) {
      const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if(!match||(!match[1]&&!match[2])||info.size===0) {
        reply(res,416,'请求的范围无效。',{'Content-Range':`bytes */${info.size}`});return;
      }
      if(match[1]) {start=Number(match[1]);if(match[2])end=Math.min(Number(match[2]),end);}
      else {const suffix=Number(match[2]);start=Math.max(0,info.size-suffix);}
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=info.size) {
        reply(res,416,'请求的范围无效。',{'Content-Range':`bytes */${info.size}`});return;
      }
      status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
    }
    headers['Content-Length']=info.size===0?0:end-start+1;
    res.writeHead(status,headers);
    if(req.method==='HEAD'||info.size===0) {res.end();return;}
    const stream=createReadStream(file,{start,end});
    stream.on('error',()=>res.destroy());
    res.on('close',()=>stream.destroy());stream.pipe(res);
  } catch(error) {
    if(!res.headersSent)reply(res,['ENOENT','ENOTDIR'].includes(error.code)?404:500,
      ['ENOENT','ENOTDIR'].includes(error.code)?'找不到该文件；请确认资源已经保存在本地。':'读取文件失败。');
    else res.destroy();
  }
});
server.on('error',error=>{
  console.error(error.code==='EADDRINUSE'
    ?`端口 ${port} 已被占用。停止旧预览，或运行：node scripts/preview.mjs --port ${port===8788?8789:8788}`
    :`无法启动预览：${error.message}`);
  process.exitCode=1;
});
server.listen(port,'127.0.0.1',()=>{
  const address=`http://127.0.0.1:${server.address().port}/`;
  console.log(`本地预览：${address}\n根目录：${root}\n保留此终端窗口；按 Control+C 停止。无需网络。`);
});
