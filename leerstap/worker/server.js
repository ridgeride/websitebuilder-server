import {uid,isId,demoModule,demoWordlist,validModule,validDocumentMeta,validAttempt,validSession,validPages,validProfile,validWordlist,validPlan} from '../src/core.js';
import {analysePages,checkWork,explainFeedback,wordsFromPhoto,isImage,HttpError} from './analyse.js';
import {hashSecret,verifySecret,createSession,readSession,sessionCookie,recoveryCode,inviteCode,throttled,countFailure,clearThrottle} from './auth.js';

export const APP_VERSION='0.6.0';
const PAUSED='Dit gezinsaccount is gepauzeerd. Neem contact op met Leerstap als je weer wilt meedoen.';
const MAX_ITEM=1500000,MAX_UPLOAD=40000000,MINUTE=60000;
const SCHOOL_TYPES=['vmbo-basis','vmbo-kader','vmbo-gl','vmbo-tl','havo','vwo','gymnasium','havo/vwo'];
const MODULE_META=['title','subject','schoolYear','period','chapter','method','deletedAt'];
const KINDS=['module','document','attempt','draft','wordlist','plan'];
const DOCUMENT_META=['name','subject','schoolYear','period','chapter','method','deletedAt'];
const json=(o,status=200,headers={})=>new Response(JSON.stringify(o),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const fail=(status,message)=>{throw new HttpError(status,message);};
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>k in o).map(k=>[k,o[k]]));
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args.map(v=>v===undefined?null:v));
const audit=(env,user,action,detail='')=>q(env,'INSERT INTO audit(family_id,user_id,action,detail,at) VALUES(?,?,?,?,?)',user?.family,user?.id,action,String(detail).slice(0,500),Date.now()).run();
const month=()=>new Date().toISOString().slice(0,7);
const clientIp=request=>request.headers.get('CF-Connecting-IP')||'local';
const normEmail=v=>String(v||'').trim().toLowerCase();
const validEmail=v=>v.length<=200&&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
const validChildLogin=v=>/^[a-z0-9][a-z0-9._-]{2,29}$/.test(v);
const limit=(env,name,fallback)=>Number(env[name])>0?Number(env[name]):fallback;
// Signup needs an invitation while INVITE_ONLY is on or a shared INVITE_CODE is set.
const inviteRequired=env=>env.INVITE_ONLY==='true'||!!env.INVITE_CODE;
// The administrator is a parent account whose e-mail address is listed in ADMIN_EMAILS (comma-separated).
const isAdmin=(env,user)=>user.role==='parent'&&String(env.ADMIN_EMAILS||'').split(',').map(normEmail).filter(Boolean).includes(user.login);

async function body(request,max=MAX_ITEM){
 const length=Number(request.headers.get('content-length')||0);if(length>max)fail(413,'Te veel gegevens in één keer. Verdeel het materiaal.');
 const raw=await request.text();if(raw.length>max)fail(413,'Te veel gegevens in één keer. Verdeel het materiaal.');
 try{return JSON.parse(raw||'{}');}catch{fail(400,'Ongeldige gegevens.');}
}
function profileOut(row){const p=JSON.parse(row.profile||'{}');return {id:row.id,name:row.name,level:p.level||'',schoolType:p.schoolType,year:p.year,subjects:p.subjects,login:row.login||null};}
function profileIn(input,existing={}){
 const name=String(input.name??existing.name??'').trim().slice(0,40),schoolType=input.schoolType??existing.schoolType??'havo/vwo',year=Number(input.year??existing.year??1);
 if(!name)fail(400,'Vul een naam of bijnaam in.');if(!SCHOOL_TYPES.includes(schoolType))fail(400,'Kies een schooltype uit de lijst.');
 const max=schoolType.startsWith('vmbo')?4:schoolType==='havo'?5:6;if(!Number.isInteger(year)||year<1||year>max)fail(400,`Dit schooltype heeft leerjaar 1 tot en met ${max}.`);
 const subjects=input.subjects??existing.subjects??['Wiskunde'];if(!Array.isArray(subjects)||!subjects.length||subjects.length>30||!subjects.every(s=>typeof s==='string'&&s.trim()&&s.length<=50))fail(400,'Kies minstens één vak.');
 return {name,profile:{schoolType,year,level:`${year} ${schoolType}`,subjects:[...new Set(subjects.map(s=>s.trim()))]}};
}
async function getItem(env,family,kind,id){const row=await q(env,'SELECT data,rev,owner FROM items WHERE family_id=? AND kind=? AND id=?',family,kind,id).first();return row&&{data:JSON.parse(row.data),rev:row.rev,owner:row.owner};}
async function putRow(env,family,kind,id,owner,data,rev){const text=JSON.stringify(data);if(text.length>MAX_ITEM)fail(413,'Dit onderdeel is te groot om op te slaan.');
 if(rev===1){const r=await q(env,'INSERT INTO items(family_id,kind,id,owner,data,rev,updated) VALUES(?,?,?,?,?,1,?) ON CONFLICT DO NOTHING',family,kind,id,owner,text,Date.now()).run();if(!r.meta.changes)fail(409,'Dit onderdeel bestaat al. Vernieuw de pagina.');}
 else{const r=await q(env,'UPDATE items SET data=?,owner=?,rev=?,updated=? WHERE family_id=? AND kind=? AND id=? AND rev=?',text,owner,rev,Date.now(),family,kind,id,rev-1).run();if(!r.meta.changes)fail(409,'Dit is intussen op een ander apparaat gewijzigd. De nieuwste versie wordt geladen.');}
 return rev;}
async function childOf(env,user,profileId){const row=await q(env,"SELECT id FROM users WHERE id=? AND family_id=? AND role='child'",profileId,user.family).first();if(!row)fail(403,'Dit leerlingprofiel hoort niet bij jouw gezin.');if(user.role==='child'&&profileId!==user.id)fail(403,'Je kunt alleen je eigen voortgang bewaren.');}
const parentOnly=user=>{if(user.role!=='parent')fail(403,'Dit kan alleen een ouder doen.');};
const filesPrefix=(family,id)=>`${family}/documents/${id}/`;
async function deletePrefix(env,prefix){let cursor;do{const list=await env.FILES.list({prefix,cursor});if(list.objects.length)await env.FILES.delete(list.objects.map(o=>o.key));cursor=list.truncated?list.cursor:undefined;}while(cursor);}

async function state(env,user){
 const children=(await q(env,"SELECT id,name,login,profile FROM users WHERE family_id=? AND role='child' ORDER BY created",user.family).all()).results.filter(r=>user.role==='parent'||r.id===user.id).map(profileOut);
 const own=user.role==='parent'?'':' AND owner=?',args=user.role==='parent'?[user.family]:[user.family,user.id];
 const rows=[...(await q(env,"SELECT kind,id,data,rev FROM items WHERE family_id=? AND kind IN ('module','document','wordlist')",user.family).all()).results,...(await q(env,`SELECT kind,id,data,rev FROM items WHERE family_id=? AND kind IN ('attempt','draft','plan')${own}`,...args).all()).results];
 const out={version:1,profiles:children,modules:[],documents:[],attempts:[],wordlists:[],plans:[],drafts:{},revs:{}};
 for(const r of rows){const data=JSON.parse(r.data);out.revs[r.kind+':'+r.id]=r.rev;if(r.kind==='draft')out.drafts[r.id]=data;else out[r.kind+'s'].push(data);}
 out.attempts.sort((a,b)=>a.created-b.created);out.modules.sort((a,b)=>(a.created||0)-(b.created||0));out.wordlists.sort((a,b)=>(a.created||0)-(b.created||0));out.plans.sort((a,b)=>a.date<b.date?-1:1);
 const used=await q(env,'SELECT analyses,checks FROM usage WHERE family_id=? AND month=?',user.family,month()).first();
 return {...out,me:{id:user.id,role:user.role,name:user.name,login:user.login,familyName:user.familyName,aiConsent:user.aiConsent,admin:isAdmin(env,user),requests:isAdmin(env,user)?(await q(env,'SELECT count(*) AS n FROM access_requests').first()).n+(await q(env,'SELECT count(*) AS n FROM feedback WHERE done_at IS NULL').first()).n:0},usage:{analyses:used?.analyses||0,limit:limit(env,'AI_MONTHLY_LIMIT',30),checks:used?.checks||0,checkLimit:limit(env,'AI_CHECK_LIMIT',300)}};
}

async function putItem(env,user,kind,id,input){
 if(!isId(id)||!input||typeof input.data!=='object'||input.data?.id!==undefined&&input.data.id!==id&&kind!=='draft')fail(400,'Ongeldig onderdeel.');
 const existing=await getItem(env,user.family,kind,id),rev=(existing?.rev||0)+1;if(existing&&input.rev!==existing.rev)fail(409,'Dit is intussen op een ander apparaat gewijzigd. De nieuwste versie wordt geladen.');
 let data=input.data,owner=null;
 if(kind==='module'){
  if(!existing){parentOnly(user);if(!validModule({...data,id}))fail(400,'Ongeldige leerstof.');}
  else if(user.role==='child')data={...existing.data,...pick(data,MODULE_META)};
  else if(!existing.data.approved&&data.approved)await audit(env,user,'module-approved',id);
  data={...data,id};if(!validModule(data))fail(400,'Ongeldige leerstof.');
 }else if(kind==='document'){
  if(!existing)fail(404,'Bron niet gevonden.');
  data={...existing.data,...pick(data,DOCUMENT_META),id};if(!validDocumentMeta(data))fail(400,'Ongeldige broninformatie.');
 }else if(kind==='attempt'){
  if(existing){parentOnly(user);if(data.profile!==existing.data.profile)fail(400,'Een resultaat blijft bij dezelfde leerling.');await audit(env,user,'attempt-reviewed',id);}
  data={...data,id};if(!validAttempt(data))fail(400,'Ongeldig resultaat.');await childOf(env,user,data.profile);owner=data.profile;
 }else if(kind==='draft'){
  if(data.profile!==id||!validSession(data))fail(400,'Ongeldige oefensessie.');await childOf(env,user,id);owner=id;
 }else if(kind==='wordlist'){
  // Children may make and edit word lists too; the list belongs to the whole family.
  data={...data,id,createdBy:existing?.data.createdBy||user.id,created:existing?.data.created||Date.now()};if(!validWordlist(data))fail(400,'Ongeldige woordenlijst.');
 }else if(kind==='plan'){
  data={...data,id};if(!validPlan(data))fail(400,'Ongeldige planning.');await childOf(env,user,data.profile);if(existing&&existing.owner!==data.profile)fail(400,'Een planning blijft bij dezelfde leerling.');owner=data.profile;
 }else fail(404,'Onbekend onderdeel.');
 return {rev:await putRow(env,user.family,kind,id,owner,data,rev)};
}

async function deleteItem(env,user,kind,id){
 const existing=await getItem(env,user.family,kind,id);if(!existing)return {ok:true};
 if(kind==='draft')await childOf(env,user,id);
 else if(kind==='plan')await childOf(env,user,existing.owner);
 else if(kind==='wordlist'){if(user.role==='child'&&existing.data.createdBy!==user.id)fail(403,'Alleen een ouder of wie de lijst maakte kan hem verwijderen.');await audit(env,user,'deleted-wordlist',id);}
 else{parentOnly(user);
  if(kind==='document'){const used=await q(env,"SELECT 1 FROM items WHERE family_id=? AND kind IN ('module','attempt','draft') AND instr(data,?)>0 LIMIT 1",user.family,`"source":"${id}"`).first();if(used)fail(409,'Deze bron hoort nog bij leerstof of een toetsresultaat. Bewaar hem voor controle.');await deletePrefix(env,filesPrefix(user.family,id));}
  await audit(env,user,'deleted-'+kind,id);}
 await q(env,'DELETE FROM items WHERE family_id=? AND kind=? AND id=?',user.family,kind,id).run();return {ok:true};
}

async function uploadDocument(env,user,input){
 const meta=input?.meta||{},pages=input?.pages,data=input?.data;
 if(typeof data!=='string'||data.length>14500000||!/^[A-Za-z0-9+/=]*$/.test(data))fail(400,'Bestand ontbreekt of is groter dan 10 MB.');
 if(!validPages(pages)||!pages.length||pages.length>30)fail(400,'Ongeldige bronpagina’s.');
 let id=isId(meta.id)&&!(await getItem(env,user.family,'document',meta.id))?meta.id:uid();
 const doc={...pick(meta,DOCUMENT_META),id,name:String(meta.name||'Bron').slice(0,150),type:String(meta.type||'application/octet-stream').slice(0,100),warnings:Array.isArray(meta.warnings)?meta.warnings.filter(w=>typeof w==='string').slice(0,40):[],pageCount:pages.length,created:Number(meta.created)||Date.now(),uploadedBy:user.id};
 delete doc.deletedAt;if(!validDocumentMeta(doc))fail(400,'Ongeldige broninformatie.');
 const pagesWithId=pages.map(p=>({...p,id}));
 await env.FILES.put(filesPrefix(user.family,id)+'pages.json',JSON.stringify(pagesWithId),{httpMetadata:{contentType:'application/json'}});
 await env.FILES.put(filesPrefix(user.family,id)+'original',Uint8Array.from(atob(data),c=>c.charCodeAt(0)),{httpMetadata:{contentType:doc.type}});
 return {document:doc,rev:await putRow(env,user.family,'document',id,null,doc,1)};
}
async function documentPages(env,user,id){if(!(await getItem(env,user.family,'document',id)))fail(404,'Bron niet gevonden.');const obj=await env.FILES.get(filesPrefix(user.family,id)+'pages.json');if(!obj)fail(404,'Bronpagina’s niet gevonden.');return JSON.parse(await obj.text());}

async function analyse(env,user,input){
 if(input.consent===true&&user.role==='parent'&&!user.aiConsent){await q(env,'UPDATE families SET ai_consent_at=? WHERE id=?',Date.now(),user.family).run();await audit(env,user,'ai-consent','on');user.aiConsent=true;}
 if(!user.aiConsent)fail(403,user.role==='parent'?'Geef eerst toestemming om leerstof naar de AI-dienst te sturen.':'Een ouder moet eerst toestemming geven voor AI-analyse (Gezin & instellingen).');
 const ids=input.documents;if(!Array.isArray(ids)||!ids.length||ids.length>30||!ids.every(isId))fail(400,'Selecteer eerst een bron.');
 const used=await q(env,'SELECT analyses FROM usage WHERE family_id=? AND month=?',user.family,month()).first(),max=limit(env,'AI_MONTHLY_LIMIT',30);
 if((used?.analyses||0)>=max)fail(429,`Jullie maandlimiet van ${max} analyses is bereikt. Volgende maand kan het weer.`);
 const docs=[],pages=[];for(const id of ids){const d=await getItem(env,user.family,'document',id);if(!d||d.data.deletedAt)fail(404,'Een geselecteerde bron bestaat niet meer.');docs.push(d.data);pages.push(...await documentPages(env,user,id));}
 const record=usage=>q(env,'INSERT INTO usage(family_id,month,analyses,input_tokens,output_tokens) VALUES(?,?,1,?,?) ON CONFLICT(family_id,month) DO UPDATE SET analyses=analyses+1,input_tokens=input_tokens+excluded.input_tokens,output_tokens=output_tokens+excluded.output_tokens',user.family,month(),usage?.input||0,usage?.output||0).run();
 let result;try{result=await analysePages(pages,{subject:input.subject,level:input.level},env);}catch(e){if(e.usage)await record(e.usage);throw e;}
 await record(result.usage);
 const meta=pick(input.meta||{},['schoolYear','period','chapter','method']);for(const k in meta)meta[k]=String(meta[k]).slice(0,150);
 const m={...result.module,...meta,id:uid(),subject:String(input.subject||'Overig').slice(0,80),level:String(input.level||'').slice(0,80),sourceNames:Object.fromEntries(docs.map(d=>[d.id,d.name])),approved:false,created:Date.now(),createdBy:user.id};
 if(!validModule(m))fail(422,'De analyse leverde geen bruikbare leerstof op. Probeer duidelijkere pagina’s.');
 await audit(env,user,'analysed',`${m.id} ${pages.length}p ${result.usage.input}/${result.usage.output} tokens`);
 return {module:m,rev:await putRow(env,user.family,'module',m.id,null,m,1)};
}

// Photo grading, explanation feedback and word lists from a photo: same consent as analysis, with their own monthly limit.
async function aiCheck(env,user,run){
 if(!user.aiConsent)fail(403,user.role==='parent'?'Geef eerst toestemming voor AI bij Gezin & instellingen.':'Een ouder moet eerst toestemming geven voor AI (Gezin & instellingen).');
 const used=await q(env,'SELECT checks FROM usage WHERE family_id=? AND month=?',user.family,month()).first(),max=limit(env,'AI_CHECK_LIMIT',300);
 if((used?.checks||0)>=max)fail(429,`Jullie maandlimiet van ${max} AI-controles is bereikt. Volgende maand kan het weer.`);
 const record=u=>q(env,'INSERT INTO usage(family_id,month,analyses,input_tokens,output_tokens,checks) VALUES(?,?,0,?,?,1) ON CONFLICT(family_id,month) DO UPDATE SET checks=checks+1,input_tokens=input_tokens+excluded.input_tokens,output_tokens=output_tokens+excluded.output_tokens',user.family,month(),u?.input||0,u?.output||0).run();
 try{const {result,usage}=await run();await record(usage);return result;}catch(e){if(e.usage)await record(e.usage);throw e;}
}
async function moduleQuestion(env,user,moduleId,questionId){
 const m=isId(moduleId)&&await getItem(env,user.family,'module',moduleId);if(!m)fail(404,'Leerstof niet gevonden.');
 const question=m.data.questions.find(x=>x.id===questionId);if(!question)fail(404,'Vraag niet gevonden.');return {module:m.data,question};
}
async function checkWorkRoute(env,user,input){
 const {module,question}=await moduleQuestion(env,user,input.module,input.question);
 if(input.image&&!isImage(input.image))fail(400,'Gebruik een foto (JPG, PNG of WEBP) van maximaal 6 MB.');
 if(!input.image&&!String(input.answer||'').trim()&&!String(input.steps||'').trim())fail(400,'Maak een foto van je uitwerking of typ je antwoord.');
 return {result:await aiCheck(env,user,()=>checkWork(env,{question,answer:input.answer,steps:input.steps,image:input.image,level:module.level}))};
}
async function explainRoute(env,user,input){
 const m=isId(input.module)&&await getItem(env,user.family,'module',input.module);if(!m)fail(404,'Leerstof niet gevonden.');
 const chapter=m.data.chapters[Number(input.chapter)],term=chapter?.terms.find(t=>t.term===input.term);if(!term)fail(404,'Begrip niet gevonden.');
 const text=String(input.text||'').trim();if(text.length<10)fail(400,'Schrijf je uitleg in een paar zinnen.');if(text.length>2000)fail(400,'Houd je uitleg korter dan 2000 tekens.');
 return {result:await aiCheck(env,user,()=>explainFeedback(env,{term:term.term,definition:term.definition,summary:chapter.summary,quote:chapter.cite.quote,text,level:m.data.level}))};
}
async function wordsRoute(env,user,input){
 if(!isImage(input.image))fail(400,'Gebruik een foto (JPG, PNG of WEBP) van maximaal 6 MB.');
 return {result:await aiCheck(env,user,()=>wordsFromPhoto(env,{image:input.image}))};
}

// Meldingen: ideas, questions and problems from inside the app, answered in Beheer.
const FEEDBACK_KINDS=['idee','vraag','probleem'];
async function sendFeedback(env,user,input){
 if(await throttled(env,'feedback:'+user.id,20,86400000))fail(429,'Je hebt vandaag al veel meldingen gestuurd. Morgen kan het weer.');
 const kind=input.kind,message=String(input.message||'').trim();if(!FEEDBACK_KINDS.includes(kind))fail(400,'Kies: idee, vraag of probleem.');
 if(message.length<3)fail(400,'Schrijf kort wat je wilt melden.');if(message.length>3000)fail(400,'Houd je bericht korter dan 3000 tekens.');
 await countFailure(env,'feedback:'+user.id,86400000);
 const id=uid();await q(env,'INSERT INTO feedback(id,family_id,user_id,kind,message,context,created) VALUES(?,?,?,?,?,?,?)',id,user.family,user.id,kind,message,String(input.context||'').slice(0,300),Date.now()).run();
 return {id};
}
const myFeedback=async(env,user)=>({feedback:(await q(env,'SELECT id,kind,message,created,reply,replied_at AS repliedAt,done_at AS doneAt FROM feedback WHERE user_id=? ORDER BY created DESC LIMIT 50',user.id).all()).results});

async function signup(env,request,input){
 const ip=clientIp(request);if(await throttled(env,'signup:'+ip,10,3600000))fail(429,'Te veel nieuwe accounts vanaf dit netwerk. Probeer het over een uur opnieuw.');
 const email=normEmail(input.email),invite=String(input.invite||'').trim();
 // A personal invitation is found by its code, or by the e-mail address of an accepted access request. One bound to an address only works for that address.
 let personal=invite?await q(env,'SELECT code,email FROM invites WHERE code=? AND used_at IS NULL',invite.toUpperCase()).first():null;
 if(!personal&&email)personal=await q(env,'SELECT code,email FROM invites WHERE email=? AND used_at IS NULL ORDER BY created LIMIT 1',email).first();
 if(personal?.email&&personal.email!==email)personal=null;
 if(inviteRequired(env)&&!personal&&!(env.INVITE_CODE&&invite===env.INVITE_CODE)){await countFailure(env,'signup:'+ip,3600000);fail(403,'De uitnodigingscode klopt niet of is al gebruikt. Leerstap is nog in een besloten proef. Je kunt toegang aanvragen.');}
 if(input.accept!==true)fail(400,'Ga akkoord met de voorwaarden en het privacybeleid.');
 if(!validEmail(email))fail(400,'Vul een geldig e-mailadres in.');
 if(typeof input.password!=='string'||input.password.length<10||input.password.length>200)fail(400,'Kies een wachtwoord van minimaal 10 tekens.');
 const child=profileIn({name:input.childName,schoolType:input.schoolType,year:input.year,subjects:input.subjects});
 if(await q(env,'SELECT 1 FROM users WHERE login=?',email).first())fail(409,'Er bestaat al een account met dit e-mailadres. Log in of herstel je wachtwoord.');
 await countFailure(env,'signup:'+ip,3600000);
 const family=uid(),parent=uid(),childId=uid(),code=recoveryCode(),now=Date.now(),demo=demoModule();demo.created=now;
 await env.DB.batch([
  q(env,'INSERT INTO families(id,name,created,last_seen) VALUES(?,?,?,?)',family,String(input.familyName||'Ons gezin').trim().slice(0,60)||'Ons gezin',now,now),
  q(env,"INSERT INTO users(id,family_id,role,login,name,pw_hash,recovery_hash,profile,created) VALUES(?,?,'parent',?,?,?,?,'{}',?)",parent,family,email,String(input.parentName||'Ouder').trim().slice(0,40)||'Ouder',await hashSecret(input.password),await hashSecret(code),now),
  q(env,"INSERT INTO users(id,family_id,role,name,profile,created) VALUES(?,?,'child',?,?,?)",childId,family,child.name,JSON.stringify(child.profile),now+1),
  q(env,"INSERT INTO items(family_id,kind,id,data,rev,updated) VALUES(?,'module','demo',?,1,?)",family,JSON.stringify(demo),now),
  q(env,"INSERT INTO items(family_id,kind,id,data,rev,updated) VALUES(?,'wordlist','demo-woorden',?,1,?)",family,JSON.stringify({...demoWordlist(),created:now,createdBy:parent}),now),
  ...personal?[q(env,'UPDATE invites SET used_at=?,family_id=? WHERE code=? AND used_at IS NULL',now,family,personal.code)]:[],
  q(env,'DELETE FROM access_requests WHERE email=?',email)]);
 await audit(env,{family,id:parent},'signup',personal?'uitnodiging '+personal.code:'');
 return json({recoveryCode:code},200,{'Set-Cookie':sessionCookie(await createSession(env,parent),request.url)});
}
// Anyone may ask for access while signup is invite-only. The answer is always the same, so it does not reveal who already has an account.
async function requestAccess(env,request,input){
 const ip=clientIp(request);if(!inviteRequired(env))fail(400,'Je kunt direct een account maken.');
 if(await throttled(env,'request:'+ip,5,3600000))fail(429,'Te veel aanvragen vanaf dit netwerk. Probeer het over een uur opnieuw.');
 const email=normEmail(input.email),name=String(input.name||'').trim().slice(0,60),message=String(input.message||'').trim().slice(0,500);
 if(!name)fail(400,'Vul je naam in.');if(!validEmail(email))fail(400,'Vul een geldig e-mailadres in.');
 await countFailure(env,'request:'+ip,3600000);
 // The hidden field is only filled in by bots; they get the normal answer without anything being stored.
 if(!input.website&&!(await q(env,'SELECT 1 FROM users WHERE login=?',email).first())){
  const open=await q(env,'SELECT count(*) AS n FROM access_requests').first();
  if(open.n<500)await q(env,'INSERT INTO access_requests(email,name,message,created) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,message=excluded.message',email,name,message,Date.now()).run();
 }
 return {ok:true};
}
async function login(env,request,input){
 const name=normEmail(input.login),ip=clientIp(request);
 if(await throttled(env,'login:'+name,10,15*MINUTE)||await throttled(env,'ip:'+ip,50,15*MINUTE))fail(429,'Te veel pogingen. Wacht een kwartier en probeer het opnieuw.');
 const user=await q(env,'SELECT u.id,u.family_id,u.pw_hash,f.blocked_at FROM users u JOIN families f ON f.id=u.family_id WHERE u.login=?',name).first();
 if(!(await verifySecret(String(input.password||''),user?.pw_hash))){await countFailure(env,'login:'+name,15*MINUTE);await countFailure(env,'ip:'+ip,15*MINUTE);fail(401,'Gebruikersnaam of wachtwoord klopt niet.');}
 await clearThrottle(env,'login:'+name);
 if(user.blocked_at)fail(403,PAUSED);
 await q(env,'UPDATE families SET last_seen=? WHERE id=?',Date.now(),user.family_id).run();
 return json({ok:true},200,{'Set-Cookie':sessionCookie(await createSession(env,user.id),request.url)});
}
async function recover(env,request,input){
 const email=normEmail(input.email);if(await throttled(env,'recover:'+email,5,3600000))fail(429,'Te veel pogingen. Probeer het over een uur opnieuw.');
 const user=await q(env,"SELECT u.id,u.family_id,u.recovery_hash,f.blocked_at FROM users u JOIN families f ON f.id=u.family_id WHERE u.login=? AND u.role='parent'",email).first();
 if(!(await verifySecret(String(input.code||'').trim().toUpperCase(),user?.recovery_hash))){await countFailure(env,'recover:'+email,3600000);fail(401,'E-mailadres of herstelcode klopt niet.');}
 if(user.blocked_at)fail(403,PAUSED);
 if(typeof input.password!=='string'||input.password.length<10)fail(400,'Kies een nieuw wachtwoord van minimaal 10 tekens.');
 const code=recoveryCode();await q(env,'UPDATE users SET pw_hash=?,recovery_hash=? WHERE id=?',await hashSecret(input.password),await hashSecret(code),user.id).run();
 await q(env,'DELETE FROM sessions WHERE user_id=?',user.id).run();await audit(env,{family:user.family_id,id:user.id},'password-recovered');await clearThrottle(env,'recover:'+email);
 return json({recoveryCode:code},200,{'Set-Cookie':sessionCookie(await createSession(env,user.id),request.url)});
}

async function exportFamily(env,user){
 parentOnly(user);const s=await state(env,user);
 const documents=[];for(const d of s.documents){const original=await env.FILES.get(filesPrefix(user.family,d.id)+'original');const bytes=new Uint8Array(original?await original.arrayBuffer():[]);let data='';for(let i=0;i<bytes.length;i+=8192)data+=String.fromCharCode(...bytes.subarray(i,i+8192));documents.push({...d,data:btoa(data),pages:await documentPages(env,user,d.id)});}
 return {version:1,exported:Date.now(),app:APP_VERSION,profiles:s.profiles.map(({login,...p})=>p),modules:s.modules,documents,attempts:s.attempts,wordlists:s.wordlists,plans:s.plans,draft:null};
}
// Imports a decrypted backup from the device-only versions (0.1/0.2). Profiles become new children; documents follow via /api/documents.
async function importFamily(env,user,input){
 parentOnly(user);const profiles=input.profiles,modules=input.modules||[],attempts=input.attempts||[],wordlists=input.wordlists||[],plans=input.plans||[];
 if(!Array.isArray(profiles)||!profiles.length||profiles.length>20||!profiles.every(validProfile)||!Array.isArray(modules)||!Array.isArray(attempts)||!Array.isArray(wordlists)||!Array.isArray(plans))fail(400,'Deze back-up kan niet worden ingelezen.');
 const map={},stmts=[],now=Date.now();
 for(const p of profiles){const id=uid(),c=profileIn({name:p.name,schoolType:SCHOOL_TYPES.includes(p.schoolType)?p.schoolType:'havo/vwo',year:p.year||Number(String(p.level).match(/\d/)?.[0])||2,subjects:p.subjects?.length?p.subjects:['Wiskunde']});map[p.id]=id;stmts.push(q(env,"INSERT INTO users(id,family_id,role,name,profile,created) VALUES(?,?,'child',?,?,?)",id,user.family,c.name,JSON.stringify(c.profile),now+stmts.length));}
 let skipped=0;
 for(const m of modules){if(!validModule(m)||await getItem(env,user.family,'module',m.id)){skipped++;continue;}const t=JSON.stringify(m);if(t.length>MAX_ITEM){skipped++;continue;}stmts.push(q(env,"INSERT INTO items(family_id,kind,id,data,rev,updated) VALUES(?,'module',?,?,1,?)",user.family,m.id,t,now));}
 for(const a of attempts){const r={...a,profile:map[a.profile]};if(!r.profile||!validAttempt(r)||await getItem(env,user.family,'attempt',a.id)){skipped++;continue;}stmts.push(q(env,"INSERT INTO items(family_id,kind,id,owner,data,rev,updated) VALUES(?,'attempt',?,?,?,1,?)",user.family,a.id,r.profile,JSON.stringify(r),now));}
 for(const w of wordlists){if(!validWordlist(w)||await getItem(env,user.family,'wordlist',w.id)){skipped++;continue;}stmts.push(q(env,"INSERT INTO items(family_id,kind,id,data,rev,updated) VALUES(?,'wordlist',?,?,1,?)",user.family,w.id,JSON.stringify({...w,createdBy:user.id}),now));}
 for(const p of plans){const r={...p,profile:map[p.profile]};if(!r.profile||!validPlan(r)||await getItem(env,user.family,'plan',p.id)){skipped++;continue;}stmts.push(q(env,"INSERT INTO items(family_id,kind,id,owner,data,rev,updated) VALUES(?,'plan',?,?,?,1,?)",user.family,p.id,r.profile,JSON.stringify(r),now));}
 await env.DB.batch(stmts);await audit(env,user,'imported',`${profiles.length} profielen, ${modules.length} modules, ${attempts.length} resultaten, ${skipped} overgeslagen`);
 return {profiles:map,skipped};
}
// Removes a family with all logins, records and uploaded files. Used by the family itself and by the administrator.
async function purgeFamily(env,family){
 await deletePrefix(env,family+'/');
 await env.DB.batch(['DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE family_id=?)','DELETE FROM items WHERE family_id=?','DELETE FROM feedback WHERE family_id=?','DELETE FROM usage WHERE family_id=?','DELETE FROM audit WHERE family_id=?','DELETE FROM users WHERE family_id=?','DELETE FROM families WHERE id=?'].map(sql=>q(env,sql,family)));
}
async function deleteFamily(env,request,user,input){
 parentOnly(user);const row=await q(env,'SELECT pw_hash FROM users WHERE id=?',user.id).first();if(!(await verifySecret(String(input.password||''),row.pw_hash)))fail(401,'Het wachtwoord klopt niet. Er is niets verwijderd.');
 await purgeFamily(env,user.family);
 return json({ok:true},200,{'Set-Cookie':sessionCookie('',request.url,0)});
}

// Beheer: invitations and an overview of the trial families. Shows counts and the parent's e-mail, never learning content.
async function adminOverview(env){
 const families=(await q(env,`SELECT f.id,f.name,f.created,f.blocked_at AS blocked,f.last_seen AS lastSeen,f.ai_consent_at IS NOT NULL AS aiConsent,
  (SELECT login FROM users WHERE family_id=f.id AND role='parent' ORDER BY created LIMIT 1) AS email,
  (SELECT count(*) FROM users WHERE family_id=f.id AND role='child') AS children,
  (SELECT count(*) FROM items WHERE family_id=f.id AND kind='module' AND id<>'demo') AS modules,
  (SELECT count(*) FROM items WHERE family_id=f.id AND kind='attempt') AS attempts,
  (SELECT analyses FROM usage WHERE family_id=f.id AND month=?) AS analyses,
  (SELECT code FROM invites WHERE family_id=f.id) AS invite
  FROM families f ORDER BY f.created DESC`,month()).all()).results.map(f=>({...f,aiConsent:!!f.aiConsent,analyses:f.analyses||0}));
 const invites=(await q(env,`SELECT i.code,i.note,i.email AS invited,i.created,i.used_at AS usedAt,i.family_id AS family,(SELECT login FROM users WHERE family_id=i.family_id AND role='parent' ORDER BY created LIMIT 1) AS email FROM invites i ORDER BY i.created DESC`).all()).results;
 const requests=(await q(env,'SELECT email,name,message,created FROM access_requests ORDER BY created').all()).results;
 const feedback=(await q(env,`SELECT fb.id,fb.kind,fb.message,fb.context,fb.created,fb.reply,fb.replied_at AS repliedAt,fb.done_at AS doneAt,u.role,(SELECT login FROM users WHERE family_id=fb.family_id AND role='parent' ORDER BY created LIMIT 1) AS email FROM feedback fb LEFT JOIN users u ON u.id=fb.user_id ORDER BY fb.done_at IS NOT NULL, fb.created DESC LIMIT 200`).all()).results;
 return {families,invites,requests,feedback,inviteRequired:inviteRequired(env),sharedCode:!!env.INVITE_CODE,limit:limit(env,'AI_MONTHLY_LIMIT',30)};
}
async function adminRoute(env,request,user,parts,method){
 if(!isAdmin(env,user))fail(403,'Alleen de beheerder van Leerstap kan dit.');
 if(parts.length===1&&method==='GET')return adminOverview(env);
 if(parts[1]==='invites'&&parts.length===2&&method==='POST'){
  const input=await body(request),note=String(input.note||'').trim().slice(0,80),invited=normEmail(input.email)||null,now=Date.now();
  if(invited&&!validEmail(invited))fail(400,'Vul een geldig e-mailadres in, of laat het leeg.');
  let code;for(let i=0;i<5&&!code;i++){const c=inviteCode();if(!(await q(env,'SELECT 1 FROM invites WHERE code=?',c).first()))code=c;}
  await q(env,'INSERT INTO invites(code,note,email,created) VALUES(?,?,?,?)',code,note,invited,now).run();await audit(env,user,'admin-invite',`${code} ${note}`);
  return {invite:{code,note,invited,created:now,usedAt:null,family:null,email:null}};
 }
 if(parts[1]==='requests'&&parts.length===4&&parts[3]==='accept'&&method==='POST'){
  const r=await q(env,'SELECT email,name FROM access_requests WHERE email=?',decodeURIComponent(parts[2])).first();if(!r)fail(404,'Deze aanvraag bestaat niet meer.');
  const now=Date.now(),note=r.name.slice(0,80);let code;for(let i=0;i<5&&!code;i++){const c=inviteCode();if(!(await q(env,'SELECT 1 FROM invites WHERE code=?',c).first()))code=c;}
  await env.DB.batch([q(env,'INSERT INTO invites(code,note,email,created) VALUES(?,?,?,?)',code,note,r.email,now),q(env,'DELETE FROM access_requests WHERE email=?',r.email)]);
  await audit(env,user,'admin-request-accepted',`${code} ${r.email}`);return {invite:{code,note,invited:r.email,created:now,usedAt:null,family:null,email:null}};
 }
 if(parts[1]==='feedback'&&parts.length===3&&method==='POST'){
  const input=await body(request),reply=String(input.reply||'').trim().slice(0,3000),now=Date.now();
  const r=await q(env,'UPDATE feedback SET reply=CASE WHEN ?<>\'\' THEN ? ELSE reply END,replied_at=CASE WHEN ?<>\'\' THEN ? ELSE replied_at END,done_at=? WHERE id=?',reply,reply,reply,now,input.done===false?null:now,parts[2]).run();
  if(!r.meta.changes)fail(404,'Melding niet gevonden.');await audit(env,user,'admin-feedback',parts[2]);return {ok:true};
 }
 if(parts[1]==='feedback'&&parts.length===3&&method==='DELETE'){const r=await q(env,'DELETE FROM feedback WHERE id=?',parts[2]).run();if(!r.meta.changes)fail(404,'Melding niet gevonden.');return {ok:true};}
 if(parts[1]==='requests'&&parts.length===3&&method==='DELETE'){
  const r=await q(env,'DELETE FROM access_requests WHERE email=?',decodeURIComponent(parts[2])).run();if(!r.meta.changes)fail(404,'Deze aanvraag bestaat niet meer.');
  await audit(env,user,'admin-request-rejected','');return {ok:true};
 }
 if(parts[1]==='invites'&&parts.length===3&&method==='DELETE'){
  const r=await q(env,'DELETE FROM invites WHERE code=? AND used_at IS NULL',parts[2]).run();if(!r.meta.changes)fail(409,'Deze uitnodiging is al gebruikt of bestaat niet meer.');
  await audit(env,user,'admin-invite-revoked',parts[2]);return {ok:true};
 }
 if(parts[1]==='families'&&parts.length===4&&method==='POST'){
  const id=parts[2],target=await q(env,'SELECT id FROM families WHERE id=?',id).first();if(!target)fail(404,'Gezin niet gevonden.');
  if(id===user.family)fail(400,'Dit is je eigen gezin. Gebruik daarvoor Gezin & instellingen.');
  const input=await body(request);
  if(parts[3]==='pause'){const on=input.paused===true;await q(env,'UPDATE families SET blocked_at=? WHERE id=?',on?Date.now():null,id).run();if(on)await q(env,'DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE family_id=?)',id).run();await audit(env,user,on?'admin-paused':'admin-resumed',id);return {paused:on};}
  if(parts[3]==='recovery'){const parent=await q(env,"SELECT id FROM users WHERE family_id=? AND role='parent' ORDER BY created LIMIT 1",id).first();if(!parent)fail(404,'Dit gezin heeft geen ouderaccount.');const code=recoveryCode();await q(env,'UPDATE users SET recovery_hash=? WHERE id=?',await hashSecret(code),parent.id).run();await audit(env,user,'admin-recovery-code',id);return {recoveryCode:code};}
  if(parts[3]==='delete'){const row=await q(env,'SELECT pw_hash FROM users WHERE id=?',user.id).first();if(!(await verifySecret(String(input.password||''),row.pw_hash)))fail(401,'Je wachtwoord klopt niet. Er is niets verwijderd.');await purgeFamily(env,id);await audit(env,user,'admin-deleted-family',id);return {ok:true};}
 }
 fail(404,'Niet gevonden.');
}

async function route(request,env){
 const url=new URL(request.url),path=url.pathname,method=request.method;
 if(!['GET','HEAD'].includes(method)&&request.headers.get('Origin')!==url.origin)fail(403,'Ongeldige herkomst.');
 if(path==='/api/status')return json({version:APP_VERSION,configured:!!env.OPENAI_API_KEY,model:env.OPENAI_MODEL||'gpt-4.1-mini',inviteRequired:inviteRequired(env)});
 if(path==='/api/signup'&&method==='POST')return signup(env,request,await body(request));
 if(path==='/api/request-access'&&method==='POST')return json(await requestAccess(env,request,await body(request,10000)));
 if(path==='/api/login'&&method==='POST')return login(env,request,await body(request));
 if(path==='/api/recover'&&method==='POST')return recover(env,request,await body(request));
 const session=await readSession(env,request);
 if(path==='/api/session')return json({user:session?.user||null});
 if(!session)fail(401,'Je bent niet (meer) ingelogd. Log opnieuw in.');
 const user=session.user,parts=path.split('/').slice(2);
 if(path==='/api/logout'&&method==='POST'){await q(env,'DELETE FROM sessions WHERE token_hash=?',session.hash).run();return json({ok:true},200,{'Set-Cookie':sessionCookie('',request.url,0)});}
 if(path==='/api/state'&&method==='GET')return json(await state(env,user),200,session.renewed?{'Set-Cookie':sessionCookie(session.renewed,request.url)}:{});
 if(parts[0]==='items'&&parts.length===3&&KINDS.includes(parts[1])){
  if(method==='PUT')return json(await putItem(env,user,parts[1],parts[2],await body(request)));
  if(method==='DELETE')return json(await deleteItem(env,user,parts[1],parts[2]));
 }
 if(path==='/api/documents'&&method==='POST')return json(await uploadDocument(env,user,await body(request,MAX_UPLOAD)));
 if(parts[0]==='documents'&&parts.length===3&&method==='GET'){
  if(parts[2]==='pages')return json({pages:await documentPages(env,user,parts[1])});
  if(parts[2]==='original'){const d=await getItem(env,user.family,'document',parts[1]),obj=d&&await env.FILES.get(filesPrefix(user.family,parts[1])+'original');if(!obj)fail(404,'Bron niet gevonden.');return new Response(obj.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(d.data.name)}`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
 }
 if(path==='/api/analyse'&&method==='POST')return json(await analyse(env,user,await body(request)));
 if(path==='/api/check-work'&&method==='POST')return json(await checkWorkRoute(env,user,await body(request,9000000)));
 if(path==='/api/explain'&&method==='POST')return json(await explainRoute(env,user,await body(request,20000)));
 if(path==='/api/words-from-photo'&&method==='POST')return json(await wordsRoute(env,user,await body(request,9000000)));
 if(path==='/api/feedback'&&method==='POST')return json(await sendFeedback(env,user,await body(request,20000)));
 if(path==='/api/feedback'&&method==='GET')return json(await myFeedback(env,user));
 if(path==='/api/profiles'&&method==='POST'){parentOnly(user);const count=await q(env,"SELECT count(*) AS n FROM users WHERE family_id=? AND role='child'",user.family).first();if(count.n>=12)fail(400,'Maximaal 12 leerlingen per gezin.');const c=profileIn(await body(request)),id=uid();await q(env,"INSERT INTO users(id,family_id,role,name,profile,created) VALUES(?,?,'child',?,?,?)",id,user.family,c.name,JSON.stringify(c.profile),Date.now()).run();return json({id});}
 if(parts[0]==='profiles'&&parts[1]){
  const row=await q(env,"SELECT id,name,login,profile FROM users WHERE id=? AND family_id=? AND role='child'",parts[1],user.family).first();if(!row||user.role==='child'&&row.id!==user.id)fail(404,'Leerling niet gevonden.');
  if(parts.length===2&&method==='PUT'){const c=profileIn(await body(request),{name:row.name,...JSON.parse(row.profile)});await q(env,'UPDATE users SET name=?,profile=? WHERE id=?',c.name,JSON.stringify(c.profile),row.id).run();return json({profile:profileOut({...row,name:c.name,profile:JSON.stringify(c.profile)})});}
  if(parts.length===2&&method==='DELETE'){parentOnly(user);const n=await q(env,"SELECT count(*) AS n FROM users WHERE family_id=? AND role='child'",user.family).first();if(n.n<=1)fail(400,'Een gezin heeft minstens één leerling.');await env.DB.batch([q(env,'DELETE FROM sessions WHERE user_id=?',row.id),q(env,"DELETE FROM items WHERE family_id=? AND kind IN ('attempt','draft') AND owner=?",user.family,row.id),q(env,'DELETE FROM users WHERE id=?',row.id)]);await audit(env,user,'child-deleted',row.id);return json({ok:true});}
  if(parts[2]==='login'&&method==='POST'){parentOnly(user);const input=await body(request),login=normEmail(input.login||row.login);if(!validChildLogin(login))fail(400,'Gebruikersnaam: 3–30 tekens, kleine letters, cijfers, punt, streepje of liggend streepje.');if(typeof input.password!=='string'||input.password.length<8||input.password.length>200)fail(400,'Kies voor je kind een wachtwoord van minimaal 8 tekens.');const taken=await q(env,'SELECT id FROM users WHERE login=?',login).first();if(taken&&taken.id!==row.id)fail(409,'Deze gebruikersnaam is al bezet. Kies een andere.');await q(env,'UPDATE users SET login=?,pw_hash=? WHERE id=?',login,await hashSecret(input.password),row.id).run();await q(env,'DELETE FROM sessions WHERE user_id=?',row.id).run();await audit(env,user,'child-login-set',row.id);return json({login});}
 }
 if(path==='/api/password'&&method==='POST'){const input=await body(request),row=await q(env,'SELECT pw_hash FROM users WHERE id=?',user.id).first(),min=user.role==='parent'?10:8;if(!(await verifySecret(String(input.current||''),row.pw_hash)))fail(401,'Je huidige wachtwoord klopt niet.');if(typeof input.password!=='string'||input.password.length<min)fail(400,`Kies een nieuw wachtwoord van minimaal ${min} tekens.`);await q(env,'UPDATE users SET pw_hash=? WHERE id=?',await hashSecret(input.password),user.id).run();await q(env,'DELETE FROM sessions WHERE user_id=? AND token_hash<>?',user.id,session.hash).run();return json({ok:true});}
 if(path==='/api/family/consent'&&method==='POST'){parentOnly(user);const on=(await body(request)).consent===true;await q(env,'UPDATE families SET ai_consent_at=? WHERE id=?',on?Date.now():null,user.family).run();await audit(env,user,'ai-consent',on?'on':'off');return json({aiConsent:on});}
 if(path==='/api/family/name'&&method==='POST'){parentOnly(user);const name=String((await body(request)).name||'').trim().slice(0,60);if(!name)fail(400,'Vul een gezinsnaam in.');await q(env,'UPDATE families SET name=? WHERE id=?',name,user.family).run();return json({ok:true});}
 if(path==='/api/export'&&method==='GET')return json(await exportFamily(env,user));
 if(path==='/api/import'&&method==='POST')return json(await importFamily(env,user,await body(request,20000000)));
 if(parts[0]==='admin')return json(await adminRoute(env,request,user,parts,method));
 if(path==='/api/family/delete'&&method==='POST')return deleteFamily(env,request,user,await body(request));
 fail(404,'Niet gevonden.');
}
export async function handleApi(request,env){
 try{return await route(request,env);}
 catch(e){if(e instanceof HttpError)return json({error:e.message},e.status);console.error(e);return json({error:'Er ging iets mis op de server. Je gegevens zijn niet gewijzigd; probeer het opnieuw.'},500);}
}
