// End-to-end check in a real browser: parent signs up, uploads, analyses (stub AI), approves, gives a child a login,
// exports PDFs; the child logs in on another "device", practises, and the parent sees the result.
// Run: npm run build && npm run test:e2e   (screenshots land in E2E_SHOTS or a temp folder)
import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const shots=process.env.E2E_SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'leerstap-shots-'));fs.mkdirSync(shots,{recursive:true});
const data=fs.mkdtempSync(path.join(os.tmpdir(),'leerstap-e2e-'));
const TEXT='Een vierkantswortel is de niet-negatieve waarde die in het kwadraat het getal onder het wortelteken oplevert. Zo is de wortel van 49 gelijk aan 7 en de wortel van 121 gelijk aan 11.';

// Stand-in for the OpenAI Responses API that only quotes what was uploaded, like a well-behaved model.
const ai=http.createServer((req,res)=>{let body='';req.on('data',c=>body+=c);req.on('end',()=>{
 const input=JSON.parse(JSON.parse(body).input[0].content[0].text),page=input.pages[0],cite={source:page.id,page:page.page,quote:page.text.slice(0,47)};
 const q=(prompt,answer,level)=>({prompt,kind:'numeric',answer,explanation:`Het antwoord is ${answer}.`,hint:'Welk getal keer zichzelf geeft het getal onder de wortel?',goal:'Wortels berekenen',rubric:'2 punten voor de juiste uitkomst.',points:2,level,cite});
 const module={title:'Wortels uit mijn boek',chapters:[{title:'Wortels',summary:'Een wortel is het niet-negatieve getal dat in het kwadraat het getal onder het wortelteken geeft.',goals:['Wortels berekenen'],terms:[{term:'Vierkantswortel',definition:'Niet-negatieve waarde waarvan het kwadraat het getal is.'}],cite}],questions:[q('Bereken √49.','7',1),q('Bereken √121.','11',1),q('Bereken √49 + √121.','18',2),q('Bereken 2 × √49.','14',2),q('Bereken √(49 × 121).','77',3)],warnings:[]};
 res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({status:'completed',usage:{input_tokens:900,output_tokens:700},output:[{content:[{type:'output_text',text:JSON.stringify(module)}]}]}));});});
await new Promise(r=>ai.listen(0,'127.0.0.1',r));
const port=4300+Math.floor(Math.random()*500),base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['--disable-warning=ExperimentalWarning','scripts/serve.mjs'],{env:{...process.env,PORT:String(port),LEERSTAP_DATA:data,OPENAI_API_KEY:'test-only',OPENAI_BASE_URL:`http://127.0.0.1:${ai.address().port}`},stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{server.stdout.on('data',d=>String(d).includes('draait')&&resolve());server.on('exit',reject);});

const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});
const errors=[];
const device=async(viewport={width:1280,height:900})=>{const ctx=await browser.newContext({viewport,acceptDownloads:true});const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/401|Failed to load resource/.test(m.text()))errors.push(m.text());});return page;};
const click=(page,action,extra='')=>page.click(`[data-action="${action}"]${extra}`);
const saved=page=>page.waitForFunction(()=>document.querySelector('#save-status')?.textContent.includes('Alles opgeslagen'));
const shot=(page,name)=>page.screenshot({path:path.join(shots,name+'.png'),fullPage:true});
const step=async(name,fn)=>{process.stdout.write(`• ${name} … `);await fn();console.log('ok');};

try{
 const parent=await device();
 await step('Ouder maakt een gezinsaccount',async()=>{
  await parent.goto(base);await shot(parent,'01-inlogscherm');
  await parent.click('[data-action="auth-view"][data-view="signup"]');
  await parent.fill('#email','ouder@voorbeeld.nl');await parent.fill('#new-password','een-sterk-wachtwoord');await parent.fill('#confirm','een-sterk-wachtwoord');
  await parent.fill('#child-name','Sam');await parent.selectOption('#signup-year','2');await parent.check('#accept');
  await shot(parent,'02-account-maken');await parent.click('#signup-form button:not(.link)');
  await parent.waitForSelector('#recovery-code');assert.match(await parent.textContent('#recovery-code'),/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);await shot(parent,'03-herstelcode');
  await click(parent,'recovery-done');await parent.waitForSelector('#toast:has-text("Bevestig")');
  await parent.check('#recovery-saved');await click(parent,'recovery-done');
  await parent.waitForSelector('.hero:has-text("Sam")');await shot(parent,'04-start-ouder');
 });
 await step('Leerstof uploaden, analyseren en vrijgeven',async()=>{
  await parent.click('[data-action="nav"][data-route="library"]');
  await parent.setInputFiles('#files',{name:'wortels-h3.txt',mimeType:'text/plain',buffer:Buffer.from(TEXT)});
  await parent.waitForSelector('.list-item:has-text("wortels-h3.txt")');await parent.waitForFunction(()=>document.querySelector('#save-status')?.textContent.includes('Alles opgeslagen'));
  await parent.check('#consent');await click(parent,'analyse');
  await parent.waitForSelector('h1:has-text("Wortels uit mijn boek")');await shot(parent,'05-concept-controle');
  await click(parent,'approve');await parent.waitForSelector('#toast:has-text("vrijgegeven")');
  await parent.click('[data-action="tab"][data-tab="questions"]');await parent.waitForSelector('text=Bereken √49 + √121.');
 });
 await step('Kind krijgt een eigen login',async()=>{
  await parent.click('[data-action="nav"][data-route="settings"]');
  const id=await parent.getAttribute('[data-action="child-login"]','data-id');
  await parent.click(`details:has(#child-login-${id}) summary`);await parent.fill(`#child-login-${id}`,'sam');await parent.fill(`#child-password-${id}`,'sam-wachtwoord');
  await click(parent,'child-login');await parent.waitForSelector('text=Logt zelf in als');await shot(parent,'06-instellingen');
 });
 await step('Printbare PDF’s van het proefwerk',async()=>{
  await parent.click('[data-action="nav"][data-route="test"]');
  for(const answers of ['false','true']){const [download]=await Promise.all([parent.waitForEvent('download'),parent.click(`[data-action="pdf"][data-answers="${answers}"]`)]);const file=await download.path();assert.equal(fs.readFileSync(file).subarray(0,4).toString(),'%PDF');}
 });
 await step('Ouder logt uit',async()=>{await click(parent,'lock');await parent.waitForSelector('#login-form');});

 const kid=await device({width:390,height:844});
 await step('Kind logt in op een eigen telefoon en oefent',async()=>{
  await kid.goto(base);await kid.fill('#login','sam');await kid.fill('#password','fout-wachtwoord');await kid.click('#login-form button:not(.link)');
  await kid.waitForSelector('#auth-error:has-text("klopt niet")');
  await kid.fill('#password','sam-wachtwoord');await kid.click('#login-form button:not(.link)');
  await kid.waitForSelector('.hero:has-text("Sam")');assert.equal(await kid.$('#profile'),null,'a child does not switch profiles');
  const overflow=await kid.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert.ok(overflow<=0,'no horizontal scroll on a phone');
  await shot(kid,'07-kind-telefoon');
  await kid.click('[data-action="nav"][data-route="practice"]');await kid.selectOption('#module-select',{label:'Wortels uit mijn boek · Wiskunde'});
  await click(kid,'start');await kid.waitForSelector('h2.question');
  await kid.fill('#answer','6');await click(kid,'check');await kid.waitForSelector('.feedback:has-text("Hier kun je van leren")');await shot(kid,'08-fout-met-uitleg');
  await click(kid,'next');await kid.fill('#answer','√121');await click(kid,'check');await kid.waitForSelector('.feedback:has-text("Goed gedaan")');
  await kid.waitForFunction(()=>document.querySelector('#save-status')?.textContent.includes('Alles opgeslagen'));
 });
 await step('Lopende sessie staat ook na herladen nog klaar',async()=>{
  await kid.reload();await kid.waitForSelector('.hero');await kid.click('[data-action="nav"][data-route="practice"]');
  await kid.waitForSelector('text=Vraag 2 van');await click(kid,'finish-early');await kid.waitForSelector('h1:has-text("Jouw groei")');
  await kid.waitForFunction(()=>document.querySelector('#save-status')?.textContent.includes('Alles opgeslagen'));await shot(kid,'09-voortgang-kind');
 });
 await step('Kind kan geen leerstof vrijgeven of andere leerlingen zien',async()=>{
  const r=await kid.evaluate(async()=>{const s=await (await fetch('/api/state')).json();return {profiles:s.profiles.length,role:s.me.role,destroy:(await fetch('/api/items/module/demo',{method:'DELETE'})).status};});
  assert.deepEqual(r,{profiles:1,role:"child",destroy:403});
 });
 await step('Ouder ziet het resultaat op het andere apparaat',async()=>{
  await parent.fill('#login','ouder@voorbeeld.nl');await parent.fill('#password','een-sterk-wachtwoord');await parent.click('#login-form button:not(.link)');
  await parent.waitForSelector('.hero');await parent.click('[data-action="nav"][data-route="progress"]');
  await parent.waitForSelector('.card:has-text("Wortels uit mijn boek")');await shot(parent,'10-voortgang-ouder');
 });
 await step('App is installeerbaar (manifest en service worker)',async()=>{
  const r=await parent.evaluate(async()=>({manifest:(await (await fetch('/manifest.webmanifest')).json()).display,sw:!!(await navigator.serviceWorker.getRegistration())}));
  assert.deepEqual(r,{manifest:'standalone',sw:true});
 });
 await step('Voorbeeldles werkt zonder account',async()=>{
  const guest=await device();await guest.goto(base);await click(guest,'demo');await guest.waitForSelector('.notice:has-text("Voorbeeldmodus")');
  await guest.click('[data-action="nav"][data-route="practice"]');await click(guest,'start');await guest.fill('#answer','sqrt(81)');await click(guest,'check');await guest.waitForSelector('.feedback:has-text("Goed gedaan")');
 });
 assert.deepEqual(errors,[],'no browser errors');
 console.log(`\nAlle browserstappen geslaagd. Schermafdrukken: ${shots}`);
}finally{await browser.close();server.kill();ai.close();fs.rmSync(data,{recursive:true,force:true});}
