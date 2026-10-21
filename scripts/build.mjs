import {build} from 'esbuild';
import fs from 'node:fs/promises';
await fs.mkdir('dist/server',{recursive:true});await fs.mkdir('dist/.openai',{recursive:true});
const bundle=await build({entryPoints:['src/app.js'],bundle:true,write:false,format:'esm',minify:true,target:'es2022'});
const assets={
 '/':{type:'text/html; charset=utf-8',data:await fs.readFile('src/index.html','utf8')},
 '/app.js':{type:'text/javascript; charset=utf-8',data:bundle.outputFiles[0].text},
 '/style.css':{type:'text/css; charset=utf-8',data:await fs.readFile('src/style.css','utf8')},
 '/pdf.worker.mjs':{type:'text/javascript; charset=utf-8',data:await fs.readFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs','utf8')}
};
const apiBundle=await build({entryPoints:['worker/api.js'],bundle:true,write:false,format:'esm',target:'es2022'});
const code=apiBundle.outputFiles[0].text+`\nconst assets=${JSON.stringify(assets)};\nexport default {async fetch(request,env={}){const path=new URL(request.url).pathname;if(path.startsWith('/api/'))return api(request,env);const asset=assets[path];if(!asset)return new Response('Niet gevonden',{status:404});return new Response(asset.data,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self' https://*.chatgpt.com https://chatgpt.com"}});}};`;
await fs.writeFile('dist/server/index.js',code);await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');console.log('Leerstap gebouwd: '+Math.round(code.length/1024)+' KB, alle browserassets lokaal gebundeld.');
