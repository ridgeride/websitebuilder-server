import test from 'node:test';import assert from 'node:assert/strict';
import {handleApi} from '../worker/server.js';
import {localEnv} from '../scripts/local-env.mjs';
import {demoModule,grade,nextReview} from '../src/core.js';

const ORIGIN='http://localhost';
// A minimal browser: keeps its own session cookie and sends the same-origin header like fetch() does.
function browser(env){
 let cookie='';
 const call=async(method,path,body,headers={})=>{
  const res=await handleApi(new Request(ORIGIN+path,{method,headers:{Origin:ORIGIN,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)}),env);
  const set=res.headers.get('Set-Cookie');if(set){const m=set.match(/ls_session=([^;]*)/);cookie=m?.[1]?'ls_session='+m[1]:'';}
  const type=res.headers.get('Content-Type')||'';return {status:res.status,body:type.includes('json')?await res.json():await res.arrayBuffer(),headers:res.headers};
 };
 return {call,get:p=>call('GET',p),post:(p,b)=>call('POST',p,b),put:(p,b)=>call('PUT',p,b),del:p=>call('DELETE',p)};
}
const signupBody=(email,extra={})=>({email,password:'een-sterk-wachtwoord',childName:'Sam',schoolType:'havo/vwo',year:2,subjects:['Wiskunde'],accept:true,...extra});
async function family(env,email){const b=browser(env);const r=await b.post('/api/signup',signupBody(email));assert.equal(r.status,200,JSON.stringify(r.body));return {b,recovery:r.body.recoveryCode,state:(await b.get('/api/state')).body};}
const textDoc=(text,name='h3.txt')=>({meta:{name,type:'text/plain',warnings:[],subject:'Wiskunde'},pages:[{id:'x',page:1,text}],data:Buffer.from(text).toString('base64')});
function attemptFor(profile,ok=true){const q=demoModule().questions[0],r=grade(q,ok?'9':'8');return {id:crypto.randomUUID(),profile,module:'demo',title:'Wortels',mode:'practice',questions:[q],answers:[{answer:ok?'9':'8',steps:''}],results:[r],review:{[q.id]:nextReview(null,ok)},created:Date.now()};}

test('Signup creates a family with a first child and the sample lesson; the recovery code is shown once',async()=>{
 const env=localEnv();const {b,recovery,state}=await family(env,'Ouder@Voorbeeld.nl');
 assert.match(recovery,/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
 assert.equal(state.me.role,'parent');assert.equal(state.me.login,'ouder@voorbeeld.nl');
 assert.deepEqual(state.profiles.map(p=>[p.name,p.level]),[['Sam','2 havo/vwo']]);
 assert.equal(state.modules[0].id,'demo');assert.equal(state.modules[0].approved,true);
 assert.equal((await b.post('/api/signup',signupBody('ouder@voorbeeld.nl'))).status,409);
 assert.equal((await browser(env).post('/api/signup',signupBody('a@b.nl',{password:'kort'}))).status,400);
 assert.equal((await browser(env).post('/api/signup',signupBody('c@d.nl',{accept:false}))).status,400);
 assert.equal((await browser(env).post('/api/signup',signupBody('e@f.nl',{schoolType:'vmbo-tl',year:5}))).status,400);
});

test('Login, logout, wrong passwords and throttling',async()=>{
 const env=localEnv();await family(env,'p@x.nl');const b=browser(env);
 assert.equal((await b.post('/api/login',{login:'p@x.nl',password:'fout-wachtwoord'})).status,401);
 assert.equal((await b.post('/api/login',{login:'onbekend@x.nl',password:'whatever-123'})).status,401);
 assert.equal((await b.post('/api/login',{login:'P@X.nl',password:'een-sterk-wachtwoord'})).status,200);
 assert.equal((await b.get('/api/state')).status,200);
 await b.post('/api/logout',{});assert.equal((await b.get('/api/state')).status,401);
 for(let i=0;i<10;i++)await b.post('/api/login',{login:'p@x.nl',password:'fout'+i});
 assert.equal((await b.post('/api/login',{login:'p@x.nl',password:'een-sterk-wachtwoord'})).status,429);
});

test('Cross-site requests and missing sessions are refused',async()=>{
 const env=localEnv();const {b}=await family(env,'p@x.nl');
 assert.equal((await b.call('POST','/api/profiles',{name:'X'},{Origin:'https://evil.example'})).status,403);
 assert.equal((await browser(env).get('/api/state')).status,401);
 assert.equal((await browser(env).call('GET','/api/state',undefined,{Cookie:'ls_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'})).status,401);
});

test('Families are fully isolated from each other',async()=>{
 const env=localEnv();const A=await family(env,'a@x.nl'),B=await family(env,'b@x.nl');
 const up=await A.b.post('/api/documents',textDoc('Geheime aantekeningen van gezin A over wortels.'));assert.equal(up.status,200);const docId=up.body.document.id;
 const childA=A.state.profiles[0].id;assert.equal((await A.b.put('/api/items/attempt/'+'t1',{data:{...attemptFor(childA),id:'t1'}})).status,200);
 const sB=(await B.b.get('/api/state')).body;
 assert.equal(sB.documents.length,0);assert.equal(sB.attempts.length,0);assert.ok(!sB.profiles.some(p=>p.id===childA));
 assert.equal((await B.b.get(`/api/documents/${docId}/pages`)).status,404);
 assert.equal((await B.b.get(`/api/documents/${docId}/original`)).status,404);
 // B cannot write into A's child or overwrite A's records by guessing ids.
 assert.equal((await B.b.put('/api/items/attempt/t2',{data:{...attemptFor(childA),id:'t2'}})).status,403);
 assert.equal((await B.b.put('/api/items/document/'+docId,{data:{name:'overgenomen'}})).status,404);
 assert.equal((await B.b.del('/api/items/attempt/t1')).status,200);
 assert.equal((await A.b.get('/api/state')).body.attempts.length,1);
 assert.equal((await B.b.put('/api/profiles/'+childA,{name:'Hack'})).status,404);
});

test('Children get their own login and only see their own results',async()=>{
 const env=localEnv();const {b:parent,state}=await family(env,'p@x.nl');const sam=state.profiles[0].id;
 const noor=(await parent.post('/api/profiles',{name:'Noor',schoolType:'gymnasium',year:1,subjects:['Latijn','Wiskunde']})).body.id;
 assert.equal((await parent.post(`/api/profiles/${sam}/login`,{login:'sam.k',password:'kort'})).status,400);
 assert.equal((await parent.post(`/api/profiles/${sam}/login`,{login:'Sam K',password:'sam-wachtwoord'})).status,400);
 assert.equal((await parent.post(`/api/profiles/${sam}/login`,{login:'sam.k',password:'sam-wachtwoord'})).status,200);
 assert.equal((await parent.post(`/api/profiles/${noor}/login`,{login:'sam.k',password:'noor-wachtwoord'})).status,409);
 assert.equal((await parent.post(`/api/profiles/${noor}/login`,{login:'noor',password:'noor-wachtwoord'})).status,200);
 assert.equal((await parent.put('/api/items/attempt/n1',{data:{...attemptFor(noor),id:'n1'}})).status,200);
 const kid=browser(env);assert.equal((await kid.post('/api/login',{login:'sam.k',password:'sam-wachtwoord'})).status,200);
 let s=(await kid.get('/api/state')).body;
 assert.equal(s.me.role,'child');assert.deepEqual(s.profiles.map(p=>p.name),['Sam']);assert.equal(s.attempts.length,0);
 assert.equal((await kid.put('/api/items/attempt/s1',{data:{...attemptFor(sam),id:'s1'}})).status,200);
 assert.equal((await kid.put('/api/items/attempt/s2',{data:{...attemptFor(noor),id:'s2'}})).status,403);
 assert.equal((await kid.put('/api/items/draft/'+noor,{data:{...attemptFor(noor),answers:[]}})).status,403);
 assert.equal((await kid.del('/api/items/attempt/n1')).status,403);
 assert.equal((await kid.get('/api/export')).status,403);
 assert.equal((await kid.post('/api/profiles',{name:'Nep'})).status,403);
 s=(await kid.get('/api/state')).body;assert.deepEqual(s.attempts.map(a=>a.id),['s1']);
 assert.equal((await parent.get('/api/state')).body.attempts.length,2);
 // A child may change its own subjects but not another child's.
 assert.equal((await kid.put('/api/profiles/'+sam,{subjects:['Wiskunde','Biologie']})).status,200);
 assert.equal((await kid.put('/api/profiles/'+noor,{subjects:['Biologie']})).status,404);
 // Resetting a child's password signs the child out everywhere.
 await parent.post(`/api/profiles/${sam}/login`,{password:'nieuw-wachtwoord'});assert.equal((await kid.get('/api/state')).status,401);
});

test('Only a parent approves, reviews and permanently deletes; children may organise',async()=>{
 const env=localEnv();const {b:parent,state}=await family(env,'p@x.nl');const sam=state.profiles[0].id;
 await parent.post(`/api/profiles/${sam}/login`,{login:'sam',password:'sam-wachtwoord'});const kid=browser(env);await kid.post('/api/login',{login:'sam',password:'sam-wachtwoord'});
 const draft={...demoModule(),id:'m1',approved:false};assert.equal((await parent.put('/api/items/module/m1',{data:draft})).status,200);
 assert.equal((await kid.put('/api/items/module/m2',{data:{...draft,id:'m2'}})).status,403);
 let s=(await kid.get('/api/state')).body,rev=s.revs['module:m1'];
 assert.equal((await kid.put('/api/items/module/m1',{data:{...draft,approved:true,title:'Hoofdstuk 3',questions:[]},rev})).status,200);
 s=(await kid.get('/api/state')).body;const m=s.modules.find(m=>m.id==='m1');
 assert.equal(m.approved,false);assert.equal(m.title,'Hoofdstuk 3');assert.equal(m.questions.length,9);
 assert.equal((await kid.put('/api/items/module/m1',{data:{...m,approved:true},rev})).status,409,'stale revision must be refused');
 assert.equal((await parent.put('/api/items/module/m1',{data:{...m,approved:true},rev:s.revs['module:m1']})).status,200);
 const att={...attemptFor(sam,false),id:'a1'};att.results[0]={...att.results[0],pending:true};
 await kid.put('/api/items/attempt/a1',{data:att});
 assert.equal((await kid.put('/api/items/attempt/a1',{data:{...att,results:[{...att.results[0],points:2,pending:false}]},rev:1})).status,403);
 assert.equal((await parent.put('/api/items/attempt/a1',{data:{...att,results:[{...att.results[0],points:1,pending:false,reviewNote:'tussenstap goed'}]},rev:1})).status,200);
 assert.equal((await kid.del('/api/items/module/m1')).status,403);assert.equal((await parent.del('/api/items/module/m1')).status,200);
});

test('Documents: originals and pages are stored, cited sources are protected, trash is restorable',async()=>{
 const env=localEnv();const {b}=await family(env,'p@x.nl');
 const r=await b.post('/api/documents',textDoc('Een vierkantswortel is de niet-negatieve waarde.'));assert.equal(r.status,200);
 const id=r.body.document.id;assert.equal(r.body.document.pageCount,1);
 assert.equal((await b.get(`/api/documents/${id}/pages`)).body.pages[0].id,id);
 assert.equal(Buffer.from((await b.get(`/api/documents/${id}/original`)).body).toString(),'Een vierkantswortel is de niet-negatieve waarde.');
 assert.equal((await b.put('/api/items/document/'+id,{data:{deletedAt:Date.now(),pageCount:99},rev:1})).status,200);
 let d=(await b.get('/api/state')).body.documents[0];assert.ok(d.deletedAt);assert.equal(d.pageCount,1);
 const m={...demoModule(),id:'m1'};m.questions[0].cite={source:id,page:1,quote:'vierkantswortel'};await b.put('/api/items/module/m1',{data:m});
 assert.equal((await b.del('/api/items/document/'+id)).status,409);
 await b.del('/api/items/module/m1');assert.equal((await b.del('/api/items/document/'+id)).status,200);
 assert.equal((await b.get(`/api/documents/${id}/original`)).status,404);
 assert.equal((await b.post('/api/documents',{...textDoc('x'),pages:[{id:'x',page:1,text:'x',image:'javascript:alert(1)'}]})).status,400);
});

test('AI analysis: consent, stored sources, citation check, monthly limit and usage metering',async()=>{
 const env=localEnv({OPENAI_API_KEY:'test-only',AI_MONTHLY_LIMIT:'2'});const {b,state}=await family(env,'p@x.nl');const sam=state.profiles[0].id;
 const text='Een vierkantswortel is de niet-negatieve waarde die in het kwadraat het getal onder het wortelteken oplevert.';
 const id=(await b.post('/api/documents',textDoc(text))).body.document.id;
 const old=globalThis.fetch;let sent,quote=text;
 globalThis.fetch=async(url,o)=>{sent=JSON.parse(o.body);const m=demoModule();for(const x of [...m.chapters,...m.questions])x.cite={source:id,page:1,quote};return Response.json({status:'completed',usage:{input_tokens:1200,output_tokens:800},output:[{content:[{type:'output_text',text:JSON.stringify(m)}]}]});};
 try{
  assert.equal((await b.post('/api/analyse',{documents:[id],subject:'Wiskunde',level:'2 havo/vwo'})).status,403,'consent required');
  const r=await b.post('/api/analyse',{documents:[id],subject:'Wiskunde',level:'2 havo/vwo',consent:true,meta:{chapter:'H3'}});
  assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.module.approved,false);assert.equal(r.body.module.chapter,'H3');assert.equal(r.body.module.sourceNames[id],'h3.txt');
  assert.equal(sent.store,false);assert.equal(sent.text.format.strict,true);assert.ok(sent.input[0].content[0].text.includes('vierkantswortel'));
  // A fabricated quote is blocked and still counts toward the limit, because the provider was paid.
  quote='Dit staat niet in de bron.';assert.equal((await b.post('/api/analyse',{documents:[id],subject:'Wiskunde',level:'2'})).status,422);
  assert.equal((await b.post('/api/analyse',{documents:[id],subject:'Wiskunde',level:'2'})).status,429);
  const s=(await b.get('/api/state')).body;assert.deepEqual(s.usage,{analyses:2,limit:2});assert.equal(s.modules.length,2);
  // Children can analyse once a parent has consented, but cannot touch documents of another family.
  await b.post(`/api/profiles/${sam}/login`,{login:'sam',password:'sam-wachtwoord'});const kid=browser(env);await kid.post('/api/login',{login:'sam',password:'sam-wachtwoord'});
  assert.equal((await kid.post('/api/family/consent',{consent:false})).status,403);
 }finally{globalThis.fetch=old;}
 assert.equal((await browser(localEnv()).post('/api/analyse',{})).status,401);
 const noKey=localEnv();const f=await family(noKey,'q@x.nl');const d=(await f.b.post('/api/documents',textDoc(text))).body.document.id;
 assert.equal((await f.b.post('/api/analyse',{documents:[d],subject:'W',level:'2',consent:true})).status,503);
});

test('Password recovery with the one-time code, password change and invite-only signup',async()=>{
 const env=localEnv();const {b,recovery}=await family(env,'p@x.nl');
 const other=browser(env);
 assert.equal((await other.post('/api/recover',{email:'p@x.nl',code:'AAAAA-AAAAA-AAAAA-AAAAA',password:'nieuw-wachtwoord-1'})).status,401);
 const r=await other.post('/api/recover',{email:'p@x.nl',code:recovery.toLowerCase(),password:'nieuw-wachtwoord-1'});assert.equal(r.status,200);assert.notEqual(r.body.recoveryCode,recovery);
 assert.equal((await b.get('/api/state')).status,401,'old sessions end after recovery');
 assert.equal((await other.post('/api/recover',{email:'p@x.nl',code:recovery,password:'nog-een-wachtwoord'})).status,401,'code is single use');
 assert.equal((await other.post('/api/password',{current:'fout',password:'derde-wachtwoord-1'})).status,401);
 assert.equal((await other.post('/api/password',{current:'nieuw-wachtwoord-1',password:'derde-wachtwoord-1'})).status,200);
 assert.equal((await browser(env).post('/api/login',{login:'p@x.nl',password:'derde-wachtwoord-1'})).status,200);
 const closed=localEnv({INVITE_CODE:'PROEF2026'});
 assert.equal((await browser(closed).post('/api/signup',signupBody('x@x.nl'))).status,403);
 assert.equal((await browser(closed).post('/api/signup',signupBody('x@x.nl',{invite:'PROEF2026'}))).status,200);
});

test('Beheer: personal invitations, pausing, a new recovery code and removing a family; only for the administrator',async()=>{
 const env=localEnv({INVITE_ONLY:'true',INVITE_CODE:'ALGEMEEN',ADMIN_EMAILS:' Beheer@X.nl , ander@x.nl'});
 const admin=browser(env);assert.equal((await admin.post('/api/signup',signupBody('beheer@x.nl',{invite:'ALGEMEEN'}))).status,200);
 assert.equal((await admin.get('/api/state')).body.me.admin,true);
 assert.equal((await browser(env).post('/api/signup',signupBody('zonder@x.nl'))).status,403,'invite only');
 const inv=(await admin.post('/api/admin/invites',{note:'Familie Jansen'})).body.invite;assert.match(inv.code,/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);assert.equal(inv.note,'Familie Jansen');
 const spare=(await admin.post('/api/admin/invites',{})).body.invite;
 // The invited parent signs up with the code (case does not matter); the code then stops working.
 const jansen=browser(env);assert.equal((await jansen.post('/api/signup',signupBody('jansen@x.nl',{invite:inv.code.toLowerCase()}))).status,200);
 assert.equal((await browser(env).post('/api/signup',signupBody('tweede@x.nl',{invite:inv.code}))).status,403,'single use');
 const jState=(await jansen.get('/api/state')).body;assert.equal(jState.me.admin,false);
 assert.equal((await jansen.get('/api/admin')).status,403,'parents are not administrators');
 assert.equal((await jansen.post('/api/admin/invites',{note:'x'})).status,403);
 const kid=jState.profiles[0].id;await jansen.post(`/api/profiles/${kid}/login`,{login:'jansen.kind',password:'kind-wachtwoord'});
 const child=browser(env);await child.post('/api/login',{login:'jansen.kind',password:'kind-wachtwoord'});assert.equal((await child.get('/api/admin')).status,403);
 let o=(await admin.get('/api/admin')).body;
 const fam=o.families.find(f=>f.email==='jansen@x.nl');assert.equal(fam.invite,inv.code);assert.equal(fam.children,1);assert.ok(fam.lastSeen);
 assert.equal(o.invites.find(i=>i.code===inv.code).email,'jansen@x.nl');assert.equal(o.invites.find(i=>i.code===spare.code).usedAt,null);
 assert.equal(JSON.stringify(o).includes('Sam'),false,'no child names or content in the overview');
 assert.equal(o.inviteRequired,true);assert.equal(o.sharedCode,true);
 // Revoking: an unused code disappears, a used one stays as a record.
 assert.equal((await admin.del('/api/admin/invites/'+spare.code)).status,200);
 assert.equal((await browser(env).post('/api/signup',signupBody('derde@x.nl',{invite:spare.code}))).status,403);
 assert.equal((await admin.del('/api/admin/invites/'+inv.code)).status,409);
 // Pausing signs the family out everywhere and blocks login and recovery; resuming restores access with the data intact.
 const own=(await admin.get('/api/admin')).body.families.find(f=>f.email==='beheer@x.nl').id;
 assert.equal((await admin.post(`/api/admin/families/${own}/pause`,{paused:true})).status,400,'not your own family');
 assert.equal((await admin.post(`/api/admin/families/${fam.id}/pause`,{paused:true})).status,200);
 assert.equal((await jansen.get('/api/state')).status,401);assert.equal((await child.get('/api/state')).status,401);
 const paused=await browser(env).post('/api/login',{login:'jansen@x.nl',password:'een-sterk-wachtwoord'});assert.equal(paused.status,403);assert.match(paused.body.error,/gepauzeerd/);
 assert.equal((await browser(env).post('/api/login',{login:'jansen@x.nl',password:'fout-wachtwoord'})).status,401,'a wrong password does not reveal the pause');
 assert.equal((await admin.post(`/api/admin/families/${fam.id}/pause`,{paused:false})).status,200);
 assert.equal((await jansen.post('/api/login',{login:'jansen@x.nl',password:'een-sterk-wachtwoord'})).status,200);assert.equal((await jansen.get('/api/state')).body.profiles.length,1);
 // A lost recovery code: the administrator makes a new one, which the parent uses to choose a new password.
 const code=(await admin.post(`/api/admin/families/${fam.id}/recovery`,{})).body.recoveryCode;assert.match(code,/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
 assert.equal((await browser(env).post('/api/recover',{email:'jansen@x.nl',code,password:'nieuw-wachtwoord-2'})).status,200);
 // Removing needs the administrator's password and takes everything of that family, files included.
 await jansen.post('/api/login',{login:'jansen@x.nl',password:'nieuw-wachtwoord-2'});assert.equal((await jansen.post('/api/documents',textDoc('Bron van gezin Jansen.'))).status,200);
 assert.ok((await env.FILES.list({prefix:fam.id+'/'})).objects.length>0);
 assert.equal((await admin.post(`/api/admin/families/${fam.id}/delete`,{password:'fout'})).status,401);
 assert.equal((await admin.post(`/api/admin/families/${fam.id}/delete`,{password:'een-sterk-wachtwoord'})).status,200);
 assert.equal((await env.FILES.list({prefix:fam.id+'/'})).objects.length,0);
 assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM users WHERE family_id=?').bind(fam.id).first()).n,0);
 assert.equal((await jansen.get('/api/state')).status,401);
 o=(await admin.get('/api/admin')).body;assert.equal(o.families.length,1);assert.equal(o.invites.find(i=>i.code===inv.code).email,null,'the used invitation remains, without the deleted family');
 assert.equal((await admin.post('/api/admin/families/onbekend/pause',{paused:true})).status,404);
 // Without INVITE_ONLY or INVITE_CODE anyone may sign up, and an unknown code is ignored.
 assert.equal((await browser(localEnv()).post('/api/signup',signupBody('open@x.nl',{invite:'XXXX-XXXX'}))).status,200);
});

test('Export, import of an old device backup, and deleting the whole family',async()=>{
 const env=localEnv();const {b,state}=await family(env,'p@x.nl');
 const id=(await b.post('/api/documents',textDoc('Bron voor de export.'))).body.document.id;
 await b.put('/api/items/attempt/a1',{data:{...attemptFor(state.profiles[0].id),id:'a1'}});
 const exp=(await b.get('/api/export')).body;
 assert.equal(exp.documents[0].id,id);assert.equal(Buffer.from(exp.documents[0].data,'base64').toString(),'Bron voor de export.');assert.equal(exp.attempts.length,1);
 const old={profiles:[{id:'leerling-1',name:'Leerling 1',level:'2 havo/vwo'}],modules:[{...demoModule(),id:'oud',title:'Oude module'}],attempts:[{...attemptFor('leerling-1'),id:'oud-1'}]};
 const r=await b.post('/api/import',old);assert.equal(r.status,200);const newId=r.body.profiles['leerling-1'];
 const s=(await b.get('/api/state')).body;assert.equal(s.profiles.length,2);assert.ok(s.modules.some(m=>m.title==='Oude module'));assert.equal(s.attempts.find(a=>a.id==='oud-1').profile,newId);
 assert.equal((await b.post('/api/family/delete',{password:'fout'})).status,401);
 assert.equal((await b.post('/api/family/delete',{password:'een-sterk-wachtwoord'})).status,200);
 assert.equal((await b.get('/api/state')).status,401);
 assert.equal((await browser(env).post('/api/login',{login:'p@x.nl',password:'een-sterk-wachtwoord'})).status,401);
 assert.equal((await env.FILES.list({prefix:''})).objects.length,0);
});
