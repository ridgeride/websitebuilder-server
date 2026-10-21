import fs from 'node:fs/promises';import path from 'node:path';import JSZip from 'jszip';
const zip=new JSZip(),root=process.cwd();
async function add(dir=''){for(const e of await fs.readdir(path.join(root,dir),{withFileTypes:true})){if(['.git','node_modules','.env','site.tar.gz'].includes(e.name)||e.name.endsWith('.log'))continue;const p=path.join(dir,e.name);if(e.isDirectory())await add(p);else zip.file('leerstap/'+p.replaceAll('\\','/'),await fs.readFile(path.join(root,p)));}}
await add();await fs.writeFile('../leerstap-v0.1.0.zip',await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));console.log('Lokaal pakket gemaakt, inclusief build; geen gebruikersdata of geheimen.');
