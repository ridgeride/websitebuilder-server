// Stops a public deploy while the legal pages or Cloudflare settings still contain placeholders.
import fs from 'node:fs';
const problems=[];
for(const f of ['public/privacy.html','public/voorwaarden.html'])if(fs.readFileSync(f,'utf8').includes('[VUL IN'))problems.push(`${f}: vul de [VUL IN: …]-plekken in (bedrijfsnaam, KvK, e-mail).`);
if(fs.readFileSync('wrangler.toml','utf8').includes('VUL-IN-NA-AANMAKEN'))problems.push('wrangler.toml: vul database_id in (zie UITROL.md, stap 4).');
if(problems.length){console.error('Nog niet klaar om te publiceren:\n- '+problems.join('\n- '));process.exit(1);}
console.log('Publicatiecontrole in orde.');
