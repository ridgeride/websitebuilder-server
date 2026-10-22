import http from 'node:http';
import worker from '../dist/server/index.js';
const port=Number(process.env.PORT||4173);
const server=http.createServer(async(req,res)=>{try{const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>17000000){res.writeHead(413);res.end('Te groot');return;}chunks.push(c);}const url=`http://127.0.0.1:${port}${req.url}`;const headers=new Headers(req.headers);headers.delete('oai-authenticated-user-id');const request=new Request(url,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});const result=await worker.fetch(request,{OPENAI_API_KEY:process.env.OPENAI_API_KEY,OPENAI_MODEL:process.env.OPENAI_MODEL,LOCAL_DEV:'1'});res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));}catch{res.writeHead(500);res.end('Serverfout');}});
server.listen(port,'127.0.0.1',()=>console.log(`Leerstap: http://127.0.0.1:${port}`));
