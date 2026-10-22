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
import {demoModule} from '../src/core.js';

const shots=process.env.E2E_SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'leerstap-shots-'));fs.mkdirSync(shots,{recursive:true});
const data=fs.mkdtempSync(path.join(os.tmpdir(),'leerstap-e2e-'));
const TEXT='Een vierkantswortel is de niet-negatieve waarde die in het kwadraat het getal onder het wortelteken oplevert. Zo is de wortel van 49 gelijk aan 7 en de wortel van 121 gelijk aan 11.';

// Stand-in for the OpenAI Responses API that only quotes what was uploaded, like a well-behaved model.
const ai=http.createServer((req,res)=>{let body='';req.on('data',c=>body+=c);req.on('end',()=>{
 const name=JSON.parse(body).text.format.name,reply=o=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({status:'completed',usage:{input_tokens:300,output_tokens:100},output:[{content:[{type:'output_text',text:JSON.stringify(o)}]}]}));};
 if(name==='nakijken')return reply({points:3,confidence:'middel',readable:true,feedback:'Je rekent beide kanten goed uit. Schrijf de conclusie nog iets duidelijker op.',methodMatch:'zelfde methode',methodNote:'',steps:[{text:'√25 = 5',ok:true},{text:'3 + 4 = 7',ok:true}]});
 if(name==='woordjes'){const pages=JSON.parse(body).input[0].content.filter(c=>c.type==='input_text').map(c=>c.text).join('\n');assert.match(pages,/le chat/);return reply({langA:'Nederlands',langB:'Frans',pairs:[{a:'de kat',b:'le chat',page:1},{a:'de hond',b:'le chien',page:1},{a:'het huis',b:'la maison',page:1},{a:'de muis',b:'la souris',page:1}],warnings:[]});}
 if(name==='proefwerk'){const qs=JSON.parse(JSON.parse(body).input[0].content[0].text).vragen;return reply({readable:true,overall:'Wortels uitrekenen gaat goed. Let op bij het combineren van wortels.',answers:qs.map(q=>({number:q.nummer,answerSeen:q.nummer<=2?q.modelantwoord:'1',points:q.nummer<=2?q.maximumPunten:0,confidence:'hoog',feedback:q.nummer<=2?'Goed.':'Dit klopt niet. Reken eerst elke wortel apart uit.',methodMatch:'zelfde methode',methodNote:''}))});}
 if(name==='uitlezen')return reply({pages:[{page:1,text:'§1.2 Klimaat\nHet klimaat is het gemiddelde weer over een periode van dertig jaar in een gebied.\n[Afbeelding: klimaatgrafiek van Utrecht]',unreadable:false}]});
 if(name==='controle')return reply({pages:[{page:1,issues:[{found:'1.2 Klimaat',should:'§1.2 Klimaat',why:'paragraafteken'},{found:'bestaat niet',should:'x',why:'verzonnen'}]}]});
 if(name==='uitleg')return reply({verdict:'bijna',good:['Je noemt het kwadraat.'],missing:['De uitkomst is nooit negatief.'],beyondBook:[],tip:'Noem ook dat een wortel niet-negatief is.'});
 const input=JSON.parse(JSON.parse(body).input[0].content[0].text),page=input.pages[0],cite={source:page.id,page:page.page,quote:page.text.slice(0,47)};
 const q=(prompt,answer,level)=>({prompt,kind:'numeric',answer,explanation:`Het antwoord is ${answer}.`,hint:'Welk getal keer zichzelf geeft het getal onder de wortel?',goal:['Wortels berekenen','Optellen met wortels','Vermenigvuldigen met wortels'][level-1],rubric:'2 punten voor de juiste uitkomst.',points:2,level,chapter:level===1?0:1,cite});
 const module={title:'Wortels uit mijn boek',chapters:[{title:'Wortels',summary:'Een wortel is het niet-negatieve getal dat in het kwadraat het getal onder het wortelteken geeft.',goals:['Wortels berekenen'],terms:[{term:'Vierkantswortel',definition:'Niet-negatieve waarde waarvan het kwadraat het getal is.'}],cite},{title:'Rekenen met wortels',summary:'Met wortels kun je rekenen: eerst de wortels uitrekenen, dan verder.',goals:['Rekenen met wortels'],terms:[],cite}],questions:[q('Bereken √49.','7',1),q('Bereken √121.','11',1),q('Bereken √49 + √121.','18',2),q('Bereken 2 × √49.','14',2),q('Bereken √(49 × 121).','77',3)],warnings:[]};
 res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({status:'completed',usage:{input_tokens:900,output_tokens:700},output:[{content:[{type:'output_text',text:JSON.stringify(module)}]}]}));});});
await new Promise(r=>ai.listen(0,'127.0.0.1',r));
const port=4300+Math.floor(Math.random()*500),base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['--disable-warning=ExperimentalWarning','scripts/serve.mjs'],{env:{...process.env,PORT:String(port),LEERSTAP_DATA:data,OPENAI_API_KEY:'test-only',INVITE_ONLY:'true',INVITE_CODE:'E2E-ALGEMEEN',ADMIN_EMAILS:'ouder@voorbeeld.nl',OPENAI_BASE_URL:`http://127.0.0.1:${ai.address().port}`},stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{server.stdout.on('data',d=>String(d).includes('draait')&&resolve());server.on('exit',reject);});

const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});
const errors=[];
const device=async(viewport={width:1280,height:900})=>{const ctx=await browser.newContext({viewport,acceptDownloads:true});const page=await ctx.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/401|Failed to load resource/.test(m.text()))errors.push(m.text());});return page;};
const click=(page,action,extra='')=>page.click(`[data-action="${action}"]${extra}`);
const saved=page=>page.waitForFunction(()=>document.querySelector('#save-status')?.textContent.includes('Alles opgeslagen'));
const shot=(page,name)=>page.screenshot({path:path.join(shots,name+'.png'),fullPage:true});
const pages=[];
const step=async(name,fn)=>{process.stdout.write(`• ${name} … `);try{await fn();}catch(e){for(const [i,p] of pages.entries())await p.screenshot({path:path.join(shots,`fout-${i}.png`),fullPage:true}).catch(()=>{});throw e;}console.log('ok');};

try{
 const parent=await device();
 await step('Ouder maakt een gezinsaccount',async()=>{
  await parent.goto(base);await shot(parent,'01-inlogscherm');
  await parent.click('[data-action="auth-view"][data-view="signup"]');
  await parent.fill('#email','ouder@voorbeeld.nl');await parent.fill('#new-password','een-sterk-wachtwoord');await parent.fill('#confirm','een-sterk-wachtwoord');
  await parent.fill('#child-name','Sam');await parent.selectOption('#signup-year','2');await parent.fill('#invite','E2E-ALGEMEEN');await parent.check('#accept');
  await shot(parent,'02-account-maken');await parent.click('#signup-form button:not(.link)');
  await parent.waitForSelector('#recovery-code');assert.match(await parent.textContent('#recovery-code'),/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);await shot(parent,'03-herstelcode');
  await click(parent,'recovery-done');await parent.waitForSelector('#toast:has-text("Bevestig")');
  await parent.check('#recovery-saved');await click(parent,'recovery-done');
  await parent.waitForSelector('.hero:has-text("Sam")');await shot(parent,'04-start-ouder');
 });
 await step('Leerstof uploaden, analyseren en vrijgeven',async()=>{
  await parent.click('[data-action="nav"][data-route="library"]');
  await parent.setInputFiles('#files',{name:'wortels-h3.txt',mimeType:'text/plain',buffer:Buffer.from(TEXT)});await parent.waitForSelector('#toast:has-text("Kies eerst het vak")');
  await parent.selectOption('#up-subject','Wiskunde');await parent.fill('#up-chapter','H3 Wortels');await parent.setInputFiles('#files',{name:'wortels-h3.txt',mimeType:'text/plain',buffer:Buffer.from(TEXT)});
  await parent.waitForSelector('.card.map:has-text("H3 Wortels") .pill:has-text("Nog niet geanalyseerd")');
  await parent.waitForFunction(()=>document.querySelector('#save-status')?.textContent.includes('Alles opgeslagen'));
  await shot(parent,'05a-leerstof-map');await parent.check('#consent');await click(parent,'analyse');
  await parent.waitForSelector('h1:has-text("Wortels uit mijn boek")');await shot(parent,'05-concept-controle');
  await click(parent,'approve');await parent.waitForSelector('#toast:has-text("vrijgegeven")');
  await parent.click('[data-action="tab"][data-tab="questions"]');await parent.waitForSelector('text=Bereken √49 + √121.');
 });
 await step('Later bladzijden toevoegen aan hetzelfde hoofdstuk, opnieuw analyseren zonder tweede versie, en verplaatsen',async()=>{
  await parent.click('[data-action="nav"][data-route="library"]');
  await parent.setInputFiles('.card.map:has-text("H3 Wortels") input.map-files',{name:'wortels-h3-blz2.txt',mimeType:'text/plain',buffer:Buffer.from(TEXT+' Ook de wortel van 144 is 12.')});
  await parent.waitForSelector('.card.map:has-text("H3 Wortels") :text("2 bestanden")');await parent.waitForSelector('.card.map:has-text("H3 Wortels") .pill:has-text("Nieuwe bladzijden")');
  parent.once('dialog',d=>d.accept());await parent.click('.card.map:has-text("H3 Wortels") [data-action="analyse"][data-replace]');await parent.waitForSelector('h1:has-text("Wortels uit mijn boek")');
  assert.equal(await parent.evaluate(async()=>(await (await fetch('/api/state')).json()).modules.filter(m=>m.title==='Wortels uit mijn boek').length),1,'replaced, not duplicated');
  await click(parent,'approve');await parent.waitForSelector('#toast:has-text("vrijgegeven")');
  await parent.click('[data-action="nav"][data-route="library"]');await parent.click('.card.map:has-text("H3 Wortels") summary:has-text("Vak of hoofdstuk wijzigen")');
  await parent.fill('.card.map:has-text("H3 Wortels") input[id^="move-chapter"]','H3 Wortels en kwadraten');await parent.click('.card.map:has-text("H3 Wortels") [data-action="map-move"]');
  await parent.waitForSelector('.card.map h3:has-text("H3 Wortels en kwadraten")');await shot(parent,'05b-hoofdstukken');
 });
 await step('Foto van het boek: tekst op het apparaat lezen (gratis), controleren, eventueel door de AI, foto’s verwijderen, dan analyseren',async()=>{
  // A real photo-like page with text, so the on-device recognition is really exercised.
  const PHOTO=Buffer.from((await parent.evaluate(()=>{const c=document.createElement('canvas');c.width=1400;c.height=700;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.fillStyle='#111';g.font='44px Georgia';
   ['1.2 Klimaat','Het klimaat is het gemiddelde weer','over een periode van dertig jaar','in een gebied.'].forEach((t,i)=>g.fillText(t,70,120+i*90));
   // Taken sideways, as phones often do: Leerstap has to find the right way up itself.
   const r=document.createElement('canvas');r.width=c.height;r.height=c.width;const h=r.getContext('2d');h.translate(r.width/2,r.height/2);h.rotate(Math.PI/2);h.drawImage(c,-c.width/2,-c.height/2);return r.toDataURL('image/jpeg',.92).split(',')[1];})),'base64');
  await parent.click('[data-action="nav"][data-route="settings"]');assert.ok(await parent.isChecked('input[name="read-mode"][value="ai"]'),'AI reads by default');
  await parent.check('input[name="read-mode"][value="device"]');await parent.waitForSelector('#toast:has-text("op dit apparaat gelezen")');await parent.click('[data-action="nav"][data-route="library"]');
  await parent.selectOption('#up-subject','Aardrijkskunde');await parent.fill('#up-chapter','H1 Klimaat');await parent.setInputFiles('#files',{name:'blz-12.jpg',mimeType:'image/jpeg',buffer:PHOTO});
  const map='.card.map:has-text("H1 Klimaat")';await parent.waitForSelector(`${map} :text("foto: eerst de tekst uitlezen")`);assert.equal(await parent.$(`${map} [data-action="analyse"]`),null,'no analysis straight from a photo');
  const t0=Date.now();await parent.click(`${map} [data-action="map-read"]`);await parent.waitForSelector('dialog.review textarea',{timeout:90000});
  const shape=await parent.$eval('dialog.review img',i=>i.naturalWidth>i.naturalHeight);assert.ok(shape,'the sideways photo is stored the right way up (the test page is landscape)');
  const read=await parent.inputValue('dialog.review textarea');console.log(`\n    (tekst op het apparaat gelezen in ${Math.round((Date.now()-t0)/1000)} s: ${JSON.stringify(read.slice(0,80))})`);
  assert.match(read,/klimaat/i);assert.match(read,/dertig/i);
  await parent.waitForSelector('dialog.review .verify .notice');
  assert.equal(await parent.evaluate(async()=>(await (await fetch('/api/state')).json()).usage.checks),1,'reading on the device is free; only the AI comparison with the photo counts');
  await parent.waitForSelector('dialog.review .verify :text("De AI ziet 1 verschil met de foto")');await parent.click('dialog.review [data-action="verify-apply"]');
  assert.match(await parent.inputValue('dialog.review textarea'),/^§1\.2 Klimaat/,'the suggested correction is applied in the text');await parent.waitForSelector('dialog.review details.tips');
  await parent.click('dialog.review [data-action="review-ai"]');await parent.waitForSelector('dialog.review :text("De AI heeft de tekst opnieuw uitgelezen")');
  await parent.fill('dialog.review textarea','§1.2 Klimaat\nHet klimaat is het gemiddelde weer over een periode van 30 jaar in een gebied.\n[Afbeelding: klimaatgrafiek van Utrecht]');await shot(parent,'05c-tekst-controleren');
  await click(parent,'review-save');await parent.waitForSelector('dialog:has-text("Let op: de tekst is opgeslagen")');await shot(parent,'05d-fotos-verwijderen');
  await parent.click('dialog [data-action="drop-photos"]');await parent.waitForSelector('#toast:has-text("De foto is verwijderd")');
  await parent.click(`${map} summary:has-text("Bekijk bladzijden")`);await parent.waitForSelector(`${map} .pill:has-text("Alleen tekst")`);await parent.waitForSelector(`${map} :text("blz-12.txt")`);
  const pages=await parent.evaluate(async()=>{const s=await (await fetch('/api/state')).json(),d=s.documents.find(x=>x.name==='blz-12.txt');return (await (await fetch(`/api/documents/${d.id}/pages`)).json()).pages;});
  assert.equal(pages[0].image,undefined);assert.match(pages[0].text,/30 jaar/,'the corrected text is what is stored');
  await parent.click(`${map} [data-action="analyse"]`);await parent.waitForSelector('h1:has-text("Wortels uit mijn boek")');
 });
 await step('Kind krijgt een eigen login',async()=>{
  await parent.click('[data-action="nav"][data-route="settings"]');
  const id=await parent.getAttribute('[data-action="child-login"]','data-id');
  await parent.click(`details:has(#child-login-${id}) summary`);await parent.fill(`#child-login-${id}`,'sam');await parent.fill(`#child-password-${id}`,'sam-wachtwoord');
  await click(parent,'child-login');await parent.waitForSelector('text=Logt zelf in als');await shot(parent,'06-instellingen');
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
 await step('Beheer: persoonlijke uitnodiging via een link, gezin zien en pauzeren',async()=>{
  await parent.context().grantPermissions(['clipboard-read','clipboard-write'],{origin:base});
  await parent.click('[data-action="nav"][data-route="admin"]');await parent.waitForSelector('h1:has-text("Beheer")');
  await parent.fill('#invite-note','Familie Jansen');await click(parent,'admin-invite');await parent.waitForSelector('.notice .recovery-code');
  const code=(await parent.textContent('.notice .recovery-code')).trim();assert.match(code,/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  await parent.click('.notice [data-action="copy-text"]');const link=await parent.evaluate(()=>navigator.clipboard.readText());assert.equal(link,`${base}/?uitnodiging=${code}`);
  await shot(parent,'11-beheer');
  const invited=await device({width:390,height:844});await invited.goto(link);await invited.waitForSelector('#signup-form');
  assert.equal(await invited.inputValue('#invite'),code);assert.equal(new URL(invited.url()).search,'','the code leaves the address bar');
  await invited.fill('#email','jansen@voorbeeld.nl');await invited.fill('#new-password','nog-een-sterk-wachtwoord');await invited.fill('#confirm','nog-een-sterk-wachtwoord');
  await invited.fill('#child-name','Noor');await invited.check('#accept');await invited.click('#signup-form button:not(.link)');
  await invited.waitForSelector('#recovery-code');await invited.check('#recovery-saved');await click(invited,'recovery-done');await invited.waitForSelector('.hero:has-text("Noor")');
  assert.equal(await invited.$('[data-route="admin"]'),null,'only the administrator sees Beheer');
  await click(parent,'admin-refresh');await parent.waitForSelector('.list-item:has-text("jansen@voorbeeld.nl")');
  await parent.waitForSelector('td:has-text("jansen@voorbeeld.nl")');
  parent.once('dialog',d=>d.accept());await parent.click('.list-item:has-text("jansen@voorbeeld.nl") [data-action="admin-pause"]');
  await parent.waitForSelector('.list-item:has-text("jansen@voorbeeld.nl") .pill:has-text("Gepauzeerd")');
  await parent.setViewportSize({width:390,height:844});const overflow=await parent.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert.ok(overflow<=0,'Beheer has no horizontal scroll on a phone');
  await shot(parent,'12-beheer-telefoon');await parent.setViewportSize({width:1280,height:900});
  await invited.reload();await invited.waitForSelector('#login-form');
 });
 await step('Toegang aanvragen op de inlogpagina, accepteren in Beheer en daarna een account maken',async()=>{
  const asker=await device({width:390,height:844});await asker.goto(base);
  await asker.click('[data-action="auth-view"][data-view="request"]');await asker.fill('#request-name','Anna de Vries');await asker.fill('#request-email','anna@voorbeeld.nl');
  await asker.fill('#request-message','Dochter in 1 vwo');await shot(asker,'13-toegang-aanvragen');await asker.click('#request-form button');await asker.waitForSelector('h2:has-text("Bedankt")');
  await click(parent,'admin-refresh');await parent.waitForSelector('[data-route="admin"]:has-text("Beheer · 1")');await parent.waitForSelector('.list-item:has-text("Dochter in 1 vwo")');
  await shot(parent,'14-aanvraag-in-beheer');
  await parent.click('[data-action="admin-accept"][data-email="anna@voorbeeld.nl"]');await parent.waitForSelector('.notice:has-text("alleen voor anna@voorbeeld.nl") a.mail');
  assert.match(await parent.getAttribute('.notice a.mail','href'),/^mailto:anna%40voorbeeld\.nl\?subject=/);
  await click(asker,'auth-view','[data-view="login"]');await asker.click('[data-action="auth-view"][data-view="signup"]');
  await asker.fill('#email','anna@voorbeeld.nl');await asker.fill('#new-password','anna-haar-wachtwoord');await asker.fill('#confirm','anna-haar-wachtwoord');
  await asker.fill('#child-name','Lot');await asker.check('#accept');await asker.click('#signup-form button:not(.link)');await asker.waitForSelector('#recovery-code');
 });
 const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
 const prompt=async page=>(await page.textContent('h2.question')).replace('🔊','').replace(/^\d+\.\s*/,'').trim();
 await step('Drill op de voorbeeldles tot alles beheerst, met AI-nakijken van een foto en zelf nakijken',async()=>{
  const demo=demoModule(),answer=p=>demo.questions.find(q=>q.prompt===p);
  await parent.click('[data-action="nav"][data-route="practice"]');await parent.selectOption('#module-select',{label:'Wortels zonder twijfel · Wiskunde'});
  await parent.waitForSelector('fieldset.chapters:has-text("Wat wil je leren?")');await parent.uncheck('input[name="goal"][value="Haakjes"]');
  await click(parent,'start','[data-mode="drill"]');await parent.waitForSelector('text=van 8 beheerst');assert.equal(await parent.$('text=Bereken √(36 + 64).'),null);
  let wrongOnce=false;
  for(let turn=0;turn<30;turn++){
   const q=answer(await prompt(parent));
   if(q.kind==='open'){await parent.fill('#steps','√25 = 5\n3 + 4 = 7\nDus niet gelijk.');await parent.click('details.photo-check summary');await parent.setInputFiles('#work-photo',{name:'uitwerking.png',mimeType:'image/png',buffer:PNG});
    await click(parent,'check-photo');await parent.waitForSelector('.feedback:has-text("Schrijf de conclusie")');await parent.waitForSelector('ul.steps li.ok');await shot(parent,'15-ai-nakijken');
    await parent.click('[data-action="self-grade"][data-score="good"]');}
   else{await parent.fill('#answer',!wrongOnce?'0':q.answer);await click(parent,'check');await parent.waitForSelector('.feedback');if(!wrongOnce){wrongOnce=true;await parent.waitForSelector('.feedback:has-text("Hier kun je van leren")');}}
   await parent.waitForSelector('[data-action="next"],[data-action="finish"]');if(await parent.$('[data-action="finish"]'))break;await click(parent,'next');await parent.waitForSelector('[data-action="check"]');
  }
  await parent.waitForSelector('text=Alles beheerst!');await shot(parent,'16-drill-klaar');await click(parent,'finish');await parent.waitForSelector('.pill:has-text("Drill")');
 });
 await step('Woordjes alleen uit de eigen bron: verzonnen woorden worden geweigerd; overhoren met hulp bij bijna-goed',async()=>{
  await parent.click('[data-action="nav"][data-route="library"]');await parent.selectOption('#up-subject','Frans');await parent.fill('#up-chapter','H2 woordjes');await parent.setInputFiles('#files',{name:'frans-h2-woordjes.txt',mimeType:'text/plain',buffer:Buffer.from('Woordenlijst Frans H2\nde kat - le chat\nde hond - le chien\nhet huis - la maison')});
  await parent.waitForSelector('.card.map:has-text("H2 woordjes")');await saved(parent);
  await parent.click('[data-action="nav"][data-route="words"]');await parent.waitForSelector('text=Nog geen woordenlijsten');
  await parent.check('input[name="wl-doc"]:near(:text("frans-h2-woordjes.txt"))');await click(parent,'words-source');
  await parent.waitForSelector('#toast:has-text("3 woordjes gevonden")');await parent.waitForSelector('#toast:has-text("niet letterlijk in de bron")');
  const pairs=await parent.inputValue('#wl-pairs');assert.ok(!pairs.includes('souris'),'a word that is not in the book is not added');assert.equal(pairs.split('\n').length,3);
  assert.equal(await parent.inputValue('#wl-b'),'Frans');await parent.fill('#wl-title','Frans H2');await shot(parent,'17-woordjes-uit-bron');await click(parent,'words-save');
  await parent.waitForSelector('h3:has-text("Frans H2")');await parent.waitForSelector('text=Uit je boek: frans-h2-woordjes.txt');
  const map={'de kat':'le chat','de hond':'le chien','het huis':'la maison'};const id=await parent.getAttribute('[data-action="words-start"]','data-id');
  await click(parent,'words-start',`[data-id="${id}"]`);await parent.waitForSelector('text=van 3 beheerst');
  let first=true;
  for(let turn=0;turn<12;turn++){const right=map[await prompt(parent)];assert.ok(right);
   await parent.fill('#answer',first?right.replace(/^(le|la) /,''):right);await click(parent,'check');
   if(first){await parent.waitForSelector('.feedback:has-text("Bijna! Het lidwoord hoort erbij.")');await shot(parent,'18-woordjes-bijna');first=false;}else await parent.waitForSelector('.feedback:has-text("Goed gedaan")');
   await parent.waitForSelector('[data-action="next"],[data-action="finish"]');if(await parent.$('[data-action="finish"]'))break;await click(parent,'next');await parent.waitForSelector('[data-action="check"]');}
  await click(parent,'finish');await parent.waitForSelector('.pill:has-text("Woordjes")');
 });
 await step('Papieren proefwerk: printen met code, foto uploaden, nakijken met cijfer en terugkoppeling per paragraaf en soort som',async()=>{
  await parent.click('[data-action="nav"][data-route="test"]');await parent.selectOption('#module-select',{label:'Wortels uit mijn boek · Wiskunde'});await parent.selectOption('#count','0');
  const [download]=await Promise.all([parent.waitForEvent('download'),click(parent,'paper-print')]);const pdf=fs.readFileSync(await download.path());assert.equal(pdf.subarray(0,4).toString(),'%PDF');
  const code=(await parent.textContent('#toast')).match(/[A-Z2-9]{4}-[A-Z2-9]{4}/)[0];assert.match(download.suggestedFilename(),new RegExp(code));
  await parent.waitForSelector(`.list-item:has-text("code ${code}") .pill:has-text("Nog nakijken")`);
  const [answers]=await Promise.all([parent.waitForEvent('download'),parent.click(`.list-item:has-text("code ${code}") [data-action="paper-pdf"][data-answers="true"]`)]);assert.match(answers.suggestedFilename(),/antwoorden/);
  await parent.setInputFiles(`.list-item:has-text("code ${code}") input[type=file]`,{name:'blad1.png',mimeType:'image/png',buffer:PNG});await shot(parent,'19-papier-uploaden');
  await parent.click(`.list-item:has-text("code ${code}") [data-action="paper-grade"]`);await parent.waitForSelector('.pill:has-text("Op papier")');
  await parent.waitForSelector('.notice:has-text("Nakijker: Wortels uitrekenen gaat goed")');await parent.waitForSelector('h3:has-text("Per soort vraag")');
  await parent.waitForSelector('text=Waar meer oefening nodig is');await parent.waitForSelector('[data-action="drill-goal"][data-goal="Vermenigvuldigen met wortels"]');await shot(parent,'20-papier-nagekeken');
  await parent.click('[data-action="nav"][data-route="test"]');await parent.waitForSelector(`.list-item:has-text("code ${code}") .pill:has-text("Nagekeken")`);
 });
 await step('Advies op de startpagina met de reden erbij',async()=>{
  await parent.click('[data-action="nav"][data-route="home"]');await parent.waitForSelector('.advice:has-text("ADVIES VOOR SAM")');
  const text=await parent.textContent('.advice');assert.match(text,/Oefen „(Optellen|Vermenigvuldigen) met wortels”/);assert.match(text,/van de \d+ punten/);await shot(parent,'21-advies');
  await parent.click('.advice [data-action="drill-goal"]');await parent.waitForSelector('.eyebrow:has-text("met wortels")');await parent.waitForSelector('text=0 van 2 beheerst');
 });
 await step('Proefwerk op maat met paragrafen en terugkoppeling: waar meer op leren en waarom',async()=>{
  const answers={'Bereken √49.':'7','Bereken √121.':'11','Bereken √49 + √121.':'18','Bereken 2 × √49.':'14','Bereken √(49 × 121).':'77'};
  await parent.click('[data-action="nav"][data-route="test"]');await parent.selectOption('#module-select',{label:'Wortels uit mijn boek · Wiskunde'});
  await parent.waitForSelector('fieldset.chapters:has-text("Rekenen met wortels")');await parent.selectOption('#count','0');await shot(parent,'19-proefwerk-kiezen');
  parent.once('dialog',d=>d.accept());await click(parent,'start','[data-mode="test"]');await parent.waitForSelector('text=richttijd');
  for(let i=0;i<5;i++){const p=await prompt(parent);await parent.fill('#answer',p.startsWith('Bereken √49.')||p.startsWith('Bereken √121.')?answers[p]:'1');if(i<4){await click(parent,'next');await parent.waitForSelector(`text=Vraag ${i+2} van`);}}
  await click(parent,'finish');await parent.waitForSelector('h3:has-text("Terugkoppeling per paragraaf")');
  await parent.waitForSelector('.feedback-table .pill:has-text("Zit goed")');await parent.waitForSelector('.feedback-table .pill:has-text("Hier meer op leren")');await shot(parent,'20-terugkoppeling');
  await parent.click('.feedback-table [data-action="drill-weak"]');await parent.waitForSelector('text=Rekenen met wortels');await parent.waitForSelector('text=van 3 beheerst');
 });
 await step('Toetsplanner: plannen, taak van vandaag op de startpagina, afvinken',async()=>{
  const d=new Date(Date.now()+7*86400000),date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  await parent.click('[data-action="nav"][data-route="planner"]');await parent.fill('#plan-title','Toets wiskunde H3');await parent.fill('#plan-date',date);
  await parent.check('input[name="plan-item"][value="module:demo"]');await parent.check('input[name="plan-item"]:near(:text("Frans H2"))');await click(parent,'plan-create');
  await parent.waitForSelector('h2:has-text("Toets wiskunde H3")');await parent.waitForSelector('ol.days li.today');assert.equal(await parent.$$eval('ol.days li',l=>l.length),7);await shot(parent,'21-planner');
  // Sam already practised this material today, so today's task counts as done.
  await parent.waitForSelector('ol.days li.today.done');
  await parent.click('[data-action="nav"][data-route="home"]');await parent.waitForSelector('.card:has-text("VANDAAG") :text("Toets wiskunde H3")');await parent.waitForSelector('.card:has-text("VANDAAG") :text("✓ Gedaan")');await parent.waitForSelector('.week span.on');await shot(parent,'22-start-vandaag');
  // A plan for a material not practised today can be ticked off by hand.
  await parent.click('[data-action="nav"][data-route="words"]');await parent.fill('#wl-title','Engels unit 1');await parent.selectOption('#wl-b','Engels');await parent.fill('#wl-pairs','de appel = the apple\nlopen = (to) walk');await click(parent,'words-save');await parent.waitForSelector('h3:has-text("Engels unit 1")');await parent.waitForSelector('text=Zelf overgetypt');
  await parent.click('[data-action="nav"][data-route="planner"]');await parent.fill('#plan-title','Toets wortels H4');await parent.fill('#plan-date',date);await parent.check('input[name="plan-item"]:near(:text("Engels unit 1"))');await click(parent,'plan-create');
  await parent.waitForSelector('section:has(h2:has-text("Toets wortels H4")) [data-action="plan-toggle"]');await parent.click('section:has(h2:has-text("Toets wortels H4")) [data-action="plan-toggle"]');await parent.waitForSelector('section:has(h2:has-text("Toets wortels H4")) ol.days li.today.done');
 });
 await step('Leg het uit: feedback op een eigen uitleg',async()=>{
  await parent.click('[data-action="nav"][data-route="home"]');await parent.click('[data-action="module"][data-id="demo"]');await parent.click('details.explain summary');
  await parent.fill('#explain-text-0','Een wortel is het getal dat keer zichzelf het getal onder de wortel geeft.');await click(parent,'explain');
  await parent.waitForSelector('details.explain .feedback:has-text("Bijna")');await shot(parent,'23-leg-het-uit');
 });
 await step('Melding sturen vanuit de app en beantwoorden in Beheer',async()=>{
  await click(parent,'feedback-open');await parent.waitForSelector('#feedback-dialog');await parent.check('input[name="fb-kind"][value="idee"]');
  await parent.fill('#fb-message','Kunnen jullie ook topografie toevoegen?');await shot(parent,'24-melding');await click(parent,'feedback-send');await parent.waitForSelector('#toast:has-text("Bedankt")');
  await parent.click('[data-action="nav"][data-route="admin"]');await parent.waitForSelector('[data-route="admin"]:has-text("Beheer · 1")');await parent.waitForSelector('.list-item:has-text("topografie")');
  await parent.click('.list-item:has-text("topografie") details summary');await parent.fill('.list-item:has-text("topografie") textarea','Goed idee, staat op de lijst!');
  await parent.click('.list-item:has-text("topografie") [data-action="admin-feedback-reply"]');await parent.waitForSelector('.list-item:has-text("topografie") :text("✓ afgehandeld")');
  await click(parent,'feedback-open');await parent.waitForSelector('#feedback-dialog :text("Goed idee, staat op de lijst!")');await parent.click('#feedback-dialog [data-action="close-dialog"]');
 });
 await step('Ouder stelt een nieuw wachtwoord in voor het kind',async()=>{
  await parent.click('[data-action="nav"][data-route="settings"]');const id=await parent.getAttribute('[data-action="child-login"]','data-id');
  await parent.click(`details:has(#child-login-${id}) summary:has-text("Wachtwoord vergeten")`);await parent.fill(`#child-password-${id}`,'nieuw-sam-wachtwoord');await click(parent,'child-login');await parent.waitForSelector('#toast:has-text("Klaar")');
  await kid.reload();await kid.waitForSelector('#login-form');await kid.fill('#login','sam');await kid.fill('#password','sam-wachtwoord');await kid.click('#login-form button:not(.link)');await kid.waitForSelector('#auth-error:has-text("klopt niet")');
  await kid.fill('#password','nieuw-sam-wachtwoord');await kid.click('#login-form button:not(.link)');await kid.waitForSelector('.hero:has-text("Sam")');
  const overflow=await kid.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert.ok(overflow<=0,'no horizontal scroll on a phone');
  await kid.click('[data-action="nav"][data-route="planner"]');await kid.waitForSelector('h2:has-text("Toets wiskunde H3")');await shot(kid,'25-planner-telefoon');
  const o2=await kid.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert.ok(o2<=0,'planner fits on a phone');
 });
 await step('Zelf een vak toevoegen dat niet in de lijst staat',async()=>{
  await parent.click('[data-action="nav"][data-route="library"]');assert.ok(await parent.$('#up-subject option:text-is("Natuur & techniek")'),'common subjects are listed');
  parent.once('dialog',d=>d.accept('Verzorging'));await parent.selectOption('#up-subject','__new');assert.equal(await parent.inputValue('#up-subject'),'Verzorging');
  await parent.fill('#up-chapter','H2 Gezonde voeding');await parent.setInputFiles('#files',{name:'voeding.txt',mimeType:'text/plain',buffer:Buffer.from('Gezonde voeding bevat groente, fruit en volkorenproducten. De Schijf van Vijf helpt je kiezen.')});
  await parent.waitForSelector('.subject-head:has-text("Verzorging")');await parent.waitForSelector('.card.map:has-text("H2 Gezonde voeding")');
  assert.ok(await parent.$('#up-subject option:text-is("Verzorging")'),'the new subject stays in the list');
 });
 await step('Leerstof verwijderen: één hoofdstuk, daarna alles om schoon te beginnen',async()=>{
  await parent.click('[data-action="nav"][data-route="library"]');const map='.card.map:has-text("H1 Klimaat")';
  await parent.click(`${map} summary:has-text("Hoofdstuk verwijderen")`);parent.once('dialog',d=>d.accept());await parent.click(`${map} [data-action="map-delete"]`);
  await parent.waitForSelector('#toast:has-text("Hoofdstuk verwijderd")');assert.equal(await parent.$(map),null);
  await parent.click('[data-action="nav"][data-route="settings"]');await parent.click('summary:has-text("Alle leerstof verwijderen")');await parent.fill('#wipe-confirm','VERWIJDER');
  parent.once('dialog',d=>d.accept());await click(parent,'wipe-material');await parent.waitForSelector('text=Nog geen leerstof');
  const s=await parent.evaluate(async()=>{const s=await (await fetch('/api/state')).json();return {docs:s.documents.length,modules:s.modules.map(m=>m.id)};});assert.deepEqual(s,{docs:0,modules:['demo']});
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
