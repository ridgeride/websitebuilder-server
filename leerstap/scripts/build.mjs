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
// Text recognition on the device: worker, the LSTM-only cores and the language models, all served from this site.
await fs.mkdir(out+'/ocr/core',{recursive:true});await fs.mkdir(out+'/ocr/lang',{recursive:true});
await fs.copyFile('node_modules/tesseract.js/dist/worker.min.js',out+'/ocr/worker.min.js');
for(const f of ['tesseract-core-lstm.wasm.js','tesseract-core-simd-lstm.wasm.js','tesseract-core-relaxedsimd-lstm.wasm.js'])await fs.copyFile('node_modules/tesseract.js-core/'+f,`${out}/ocr/core/${f}`);
for(const l of ['nld','eng','fra','deu','spa'])await fs.copyFile(`node_modules/@tesseract.js-data/${l}/4.0.0_best_int/${l}.traineddata.gz`,`${out}/ocr/lang/${l}.traineddata.gz`);
for(const f of await fs.readdir('public'))await fs.writeFile(`${out}/${f}`,f==='sw.js'?(await fs.readFile('public/sw.js','utf8')).replace('__VERSION__',APP_VERSION):await fs.readFile('public/'+f));
// Sample test for the home page, made with the same PDF function the app uses.
const m=demoModule();for(const answers of [false,true])await fs.writeFile(`${out}/voorbeeld-${answers?'antwoorden':'opgaven'}.pdf`,Buffer.from(makePDF(m,m.questions,answers).output('arraybuffer')));
const lines=h=>Object.entries(h).map(([k,v])=>`  ${k}: ${v}`).join('\n');
await fs.writeFile(out+'/_headers',`/*\n${lines({...SECURITY_HEADERS,...HTTPS_HEADERS})}\n/sw.js\n  Cache-Control: no-cache\n/app.js\n  Cache-Control: no-cache\n/style.css\n  Cache-Control: no-cache\n`);
const size=(await fs.stat(out+'/app.js')).size;console.log(`Leerstap ${APP_VERSION} gebouwd in ${out} (app.js ${Math.round(size/1024)} KB).`);
