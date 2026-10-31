import {readFile,writeFile,open} from 'node:fs/promises';
import vm from 'node:vm';
import {songs} from '../favorsongs/songs.js';
// Reuse the player's ID3 SYLT/USLT parser without downloading songs in browsers.
const root=new URL('../favorsongs/',import.meta.url);
const html=await readFile(new URL('vinyl-player.html',root),'utf8');
const start=html.indexOf('const EmbeddedLyrics=(()=>{');
const end=html.indexOf("if(typeof module!=='undefined')module.exports=EmbeddedLyrics;",start);
if(start<0||end<start)throw Error('Embedded lyrics parser not found');
const parser=vm.runInNewContext(html.slice(start,end)+';EmbeddedLyrics',{TextDecoder});
let timed=0,plain=0;
for(const song of songs){
 const handle=await open(new URL(song.file,root));
 try{
  const embedded=await parser.read({slice(start,end){return {async arrayBuffer(){const buffer=Buffer.alloc(end-start);const {bytesRead}=await handle.read(buffer,0,buffer.length,start);return buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+bytesRead);}}}});
  const path=new URL('details/'+song.file.replace(/\.(?:mp3|m4a)$/i,'.json'),root);
  const data=JSON.parse(await readFile(path,'utf8'));
  data.embedded=embedded;
  if(!data.lyrics)data.lyrics=embedded.plain||'';
  if(embedded.entries)timed++;if(data.lyrics)plain++;
  await writeFile(path,JSON.stringify(data)+'\n');
 }finally{await handle.close();}
}
console.log(`Preserved embedded lyrics: ${timed} timed, ${plain} text, ${songs.length} songs checked.`);
