// Builds the static site for Cloudflare (dist/public). The API runs from worker/index.js; Wrangler bundles that itself.
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import {SECURITY_HEADERS,HTTPS_HEADERS} from '../worker/headers.js';
import {APP_VERSION} from '../worker/server.js';
import {demoModule} from '../src/core.js';
import {makePDF} from '../src/pdf.js';
const out='dist/public';
await fs.rm('dist',{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
await build({entryPoints:['src/app.js'],bundle:true,outfile:out+'/app.js',format:'esm',minify:true,target:'es2022',logLevel:'warning'});
await fs.copyFile('src/index.html',out+'/index.html');
await fs.copyFile('src/style.css',out+'/style.css');
await fs.copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs',out+'/pdf.worker.mjs');
for(const f of await fs.readdir('public'))await fs.writeFile(`${out}/${f}`,f==='sw.js'?(await fs.readFile('public/sw.js','utf8')).replace('__VERSION__',APP_VERSION):await fs.readFile('public/'+f));
// Sample test for the home page, made with the same PDF function the app uses.
const m=demoModule();for(const answers of [false,true])await fs.writeFile(`${out}/voorbeeld-${answers?'antwoorden':'opgaven'}.pdf`,Buffer.from(makePDF(m,m.questions,answers).output('arraybuffer')));
const lines=h=>Object.entries(h).map(([k,v])=>`  ${k}: ${v}`).join('\n');
await fs.writeFile(out+'/_headers',`/*\n${lines({...SECURITY_HEADERS,...HTTPS_HEADERS})}\n/sw.js\n  Cache-Control: no-cache\n/app.js\n  Cache-Control: no-cache\n/style.css\n  Cache-Control: no-cache\n`);
const size=(await fs.stat(out+'/app.js')).size;console.log(`Leerstap ${APP_VERSION} gebouwd in ${out} (app.js ${Math.round(size/1024)} KB).`);
