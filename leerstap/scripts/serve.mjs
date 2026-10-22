// Local server: same API code as Cloudflare, with a SQLite file and a folder for uploads in ./data (or LEERSTAP_DATA).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {handleApi} from '../worker/server.js';
import {SECURITY_HEADERS} from '../worker/headers.js';
import {localEnv} from './local-env.mjs';
const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1',publicDir=path.resolve('dist/public');
if(!fs.existsSync(path.join(publicDir,'index.html'))){console.error('Bouw eerst de app: npm run build');process.exit(1);}
const dataDir=path.resolve(process.env.LEERSTAP_DATA||'data');
const env=localEnv({dataDir,OPENAI_API_KEY:process.env.OPENAI_API_KEY,OPENAI_MODEL:process.env.OPENAI_MODEL,OPENAI_BASE_URL:process.env.OPENAI_BASE_URL,AI_MONTHLY_LIMIT:process.env.AI_MONTHLY_LIMIT,AI_CHECK_LIMIT:process.env.AI_CHECK_LIMIT,INVITE_CODE:process.env.INVITE_CODE,INVITE_ONLY:process.env.INVITE_ONLY,ADMIN_EMAILS:process.env.ADMIN_EMAILS});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.pdf':'application/pdf','.txt':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,`http://${req.headers.host||host+':'+port}`);
 if(url.pathname.startsWith('/api/')){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>45000000){res.writeHead(413);res.end('Te groot');return;}chunks.push(c);}
  const request=new Request(url,{method:req.method,headers:new Headers(Object.entries(req.headers).filter(([k])=>!k.startsWith(':')&&k.toLowerCase()!=='cf-connecting-ip').map(([k,v])=>[k,[v].flat().join(', ')])),body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
  const result=await handleApi(request,env);const headers=Object.fromEntries(result.headers);const cookie=result.headers.getSetCookie?.();if(cookie?.length)headers['set-cookie']=cookie;
  res.writeHead(result.status,{...SECURITY_HEADERS,...headers});res.end(Buffer.from(await result.arrayBuffer()));return;}
 let file=path.join(publicDir,decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(publicDir+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404,SECURITY_HEADERS);res.end('Niet gevonden');return;}
 res.writeHead(200,{...SECURITY_HEADERS,'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});fs.createReadStream(file).pipe(res);
}catch(e){console.error(e);res.writeHead(500);res.end('Serverfout');}});
server.listen(port,host,()=>console.log(`Leerstap draait op http://${host==='0.0.0.0'?'127.0.0.1':host}:${port}  (gegevens: ${dataDir})`));
