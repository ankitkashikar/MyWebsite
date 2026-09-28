import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
export async function startOfflineSite(){
 const root=fileURLToPath(new URL('../',import.meta.url));
 const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png'};
 const server=createServer(async(req,res)=>{
  try{
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
   if(!path.startsWith(resolve(root)+sep)){res.writeHead(403).end();return;}
   const body=await readFile(path);res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'}).end(body);
  }catch{res.writeHead(404).end('Not found');}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return {url:`http://127.0.0.1:${server.address().port}/`,close:()=>new Promise(resolve=>server.close(resolve))};
}
