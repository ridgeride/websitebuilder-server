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
  const s=(await b.get('/api/state')).body;assert.deepEqual(s.usage,{analyses:2,limit:2,checks:0,checkLimit:300});assert.equal(s.modules.length,2);
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

test('Access requests and invitations bound to an e-mail address',async()=>{
 const env=localEnv({INVITE_ONLY:'true',ADMIN_EMAILS:'beheer@x.nl'});
 await env.DB.prepare("INSERT INTO invites(code,note,created) VALUES('START-0001','',0)").run();
 const admin=browser(env);assert.equal((await admin.post('/api/signup',signupBody('beheer@x.nl',{invite:'START-0001'}))).status,200);
 // Anyone can ask; a repeated request updates the open one; bots that fill the hidden field are ignored; existing accounts are not revealed.
 const guest=browser(env);
 assert.equal((await guest.post('/api/request-access',{name:'',email:'a@x.nl'})).status,400);
 assert.equal((await guest.post('/api/request-access',{name:'Anna',email:'geen-adres'})).status,400);
 assert.equal((await guest.post('/api/request-access',{name:'Anna',email:'Anna@X.nl',message:'Dochter in 1 vwo'})).status,200);
 assert.equal((await guest.post('/api/request-access',{name:'Anna de Vries',email:'anna@x.nl',message:'Dochter in 1 vwo, vooral Frans'})).status,200);
 assert.equal((await browser(env).post('/api/request-access',{name:'Bot',email:'bot@x.nl',website:'http://spam'})).status,200);
 assert.equal((await browser(env).post('/api/request-access',{name:'Ik',email:'beheer@x.nl'})).status,200);
 assert.equal((await admin.get('/api/state')).body.me.requests,1);
 let o=(await admin.get('/api/admin')).body;assert.deepEqual(o.requests.map(r=>[r.email,r.name,r.message]),[['anna@x.nl','Anna de Vries','Dochter in 1 vwo, vooral Frans']]);
 assert.equal((await guest.get('/api/admin')).status,401);
 // Accepting turns the request into an invitation for that address only. Anna can sign up without typing the code; nobody else can use it.
 const inv=(await admin.post('/api/admin/requests/'+encodeURIComponent('anna@x.nl')+'/accept',{})).body.invite;assert.equal(inv.invited,'anna@x.nl');
 assert.equal((await admin.get('/api/admin')).body.requests.length,0);
 assert.equal((await browser(env).post('/api/signup',signupBody('ander@x.nl',{invite:inv.code}))).status,403,'bound to Anna');
 assert.equal((await browser(env).post('/api/signup',signupBody('anna@x.nl'))).status,200);
 assert.equal((await admin.get('/api/admin')).body.invites.find(i=>i.code===inv.code).email,'anna@x.nl');
 // Rejecting removes the request.
 await guest.post('/api/request-access',{name:'Bert',email:'bert@x.nl'});
 assert.equal((await admin.del('/api/admin/requests/bert@x.nl')).status,200);assert.equal((await admin.get('/api/admin')).body.requests.length,0);
 assert.equal((await admin.del('/api/admin/requests/bert@x.nl')).status,404);
 // An invitation made in Beheer can also be bound to an address.
 assert.equal((await admin.post('/api/admin/invites',{note:'C',email:'geen-adres'})).status,400);
 const c=(await admin.post('/api/admin/invites',{note:'C',email:'C@x.nl'})).body.invite;assert.equal(c.invited,'c@x.nl');
 assert.equal((await browser(env).post('/api/signup',signupBody('d@x.nl',{invite:c.code}))).status,403);
 assert.equal((await browser(env).post('/api/signup',signupBody('c@x.nl',{invite:c.code}))).status,200);
 // Throttling: five requests per hour per network.
 for(let i=0;i<5;i++)await browser(env).post('/api/request-access',{name:'N',email:`n${i}@x.nl`});
 assert.equal((await browser(env).post('/api/request-access',{name:'N',email:'n9@x.nl'})).status,429);
 assert.equal((await browser(localEnv()).post('/api/request-access',{name:'N',email:'n@x.nl'})).status,400,'not needed when signup is open');
});

test('Word lists and plans: children may make their own, see only their own plans, and cannot touch others',async()=>{
 const env=localEnv();const {b:parent,state}=await family(env,'p@x.nl');const sam=state.profiles[0].id;
 assert.deepEqual(state.wordlists,[],'no ready-made word lists: words come from the book');
 const noor=(await parent.post('/api/profiles',{name:'Noor',schoolType:'havo',year:1,subjects:['Frans']})).body.id;
 await parent.post(`/api/profiles/${sam}/login`,{login:'sam',password:'sam-wachtwoord'});await parent.post(`/api/profiles/${noor}/login`,{login:'noor',password:'noor-wachtwoord'});
 const kid=browser(env);await kid.post('/api/login',{login:'sam',password:'sam-wachtwoord'});
 const list={id:'l1',title:'Frans H1',subject:'Frans',langA:'Nederlands',langB:'Frans',speech:'fr-FR',pairs:[{id:'p1',a:'het huis',b:'la maison'}]};
 assert.equal((await kid.put('/api/items/wordlist/l1',{data:{...list,pairs:[]}})).status,400);
 assert.equal((await kid.put('/api/items/wordlist/l1',{data:list})).status,200);
 const plan=(profile,id='plan1')=>({id,profile,title:'Toets Frans',start:'2026-11-02',date:'2026-11-09',items:[{type:'wordlist',id:'l1'}],minutes:15,checked:{}});
 assert.equal((await kid.put('/api/items/plan/plan1',{data:plan(sam)})).status,200);
 assert.equal((await kid.put('/api/items/plan/plan2',{data:plan(noor,'plan2')})).status,403,'not for a brother or sister');
 assert.equal((await parent.put('/api/items/plan/plan3',{data:plan(noor,'plan3')})).status,200,'a parent plans for any child');
 assert.equal((await parent.put('/api/items/plan/plan4',{data:{...plan(noor,'plan4'),date:'2026-10-01'}})).status,400);
 let s=(await kid.get('/api/state')).body;assert.deepEqual(s.plans.map(p=>p.id),['plan1']);assert.equal(s.wordlists.length,1);
 assert.equal((await parent.get('/api/state')).body.plans.length,2);
 const noorKid=browser(env);await noorKid.post('/api/login',{login:'noor',password:'noor-wachtwoord'});
 assert.equal((await noorKid.del('/api/items/plan/plan1')).status,403);assert.equal((await noorKid.del('/api/items/wordlist/l1')).status,403,'only the maker or a parent deletes a list');
 assert.equal((await kid.del('/api/items/wordlist/l1')).status,200);assert.equal((await kid.del('/api/items/plan/plan1')).status,200);
 // A word drill is saved as a draft and then as a result, like any other session.
 const q={id:'p1-ab',kind:'word',prompt:'het huis',answer:'la maison',level:1,points:1,goal:'Frans H1',hint:'h',explanation:'e',rubric:'r',cite:{source:'l1',page:1,quote:'het huis'}};
 assert.equal((await kid.put('/api/items/draft/'+sam,{data:{profile:sam,module:'l1',title:'Frans H1',mode:'drill',kind:'words',pool:[q],drill:{'p1-ab':{streak:0,wrong:0,asked:0}},questions:[q],answers:[],results:[]}})).status,200);
 assert.equal((await kid.put('/api/items/attempt/w1',{data:{id:'w1',profile:sam,module:'l1',title:'Frans H1',mode:'drill',kind:'words',questions:[q],answers:[{answer:'la maison',steps:''}],results:[{points:1,pending:false,confidence:'hoog',feedback:'ok',category:'Goed'}],review:{},created:Date.now()}})).status,200);
 // Backups carry word lists and plans.
 const exp=(await parent.get('/api/export')).body;assert.ok(Array.isArray(exp.wordlists));assert.deepEqual(exp.plans.map(p=>p.id),['plan3']);
});

test('Meldingen: anyone signed in can send an idea, question or problem; the administrator answers it',async()=>{
 const env=localEnv({INVITE_ONLY:'true',ADMIN_EMAILS:'beheer@x.nl'});
 await env.DB.prepare("INSERT INTO invites(code,note,created) VALUES('A','',0),('B','',0)").run();
 const admin=browser(env);await admin.post('/api/signup',signupBody('beheer@x.nl',{invite:'A'}));
 const user=browser(env);await user.post('/api/signup',signupBody('ouder@x.nl',{invite:'B'}));
 assert.equal((await browser(env).post('/api/feedback',{kind:'idee',message:'Meer vakken'})).status,401);
 assert.equal((await user.post('/api/feedback',{kind:'klacht',message:'x'})).status,400);assert.equal((await user.post('/api/feedback',{kind:'idee',message:''})).status,400);
 const id=(await user.post('/api/feedback',{kind:'probleem',message:'De PDF opent niet op mijn iPad',context:'test · versie 0.6.0'})).body.id;
 assert.equal((await admin.get('/api/state')).body.me.requests,1,'open feedback counts in the Beheer badge');
 assert.equal((await user.get('/api/admin')).status,403);assert.equal((await user.post('/api/admin/feedback/'+id,{reply:'x'})).status,403);
 const o=(await admin.get('/api/admin')).body;assert.deepEqual(o.feedback.map(f=>[f.kind,f.email,f.role,f.message]),[['probleem','ouder@x.nl','parent','De PDF opent niet op mijn iPad']]);
 assert.equal((await admin.post('/api/admin/feedback/'+id,{reply:'Opgelost in de nieuwe versie, probeer het opnieuw.'})).status,200);
 const mine=(await user.get('/api/feedback')).body.feedback;assert.equal(mine[0].reply,'Opgelost in de nieuwe versie, probeer het opnieuw.');assert.ok(mine[0].doneAt);
 assert.equal((await admin.get('/api/state')).body.me.requests,0);
 assert.equal((await admin.post('/api/admin/feedback/'+id,{done:false})).status,200);assert.equal((await user.get('/api/feedback')).body.feedback[0].doneAt,null);
 assert.equal((await admin.del('/api/admin/feedback/'+id)).status,200);assert.equal((await user.get('/api/feedback')).body.feedback.length,0);
 for(let i=0;i<20;i++)await user.post('/api/feedback',{kind:'idee',message:'idee '+i});
 assert.equal((await user.post('/api/feedback',{kind:'idee',message:'nog een'})).status,429);
});

test('AI checks use the book: photo grading and explanations get the cited book page and method; words only from the uploaded source',async()=>{
 const env=localEnv({OPENAI_API_KEY:'test',AI_CHECK_LIMIT:'3',OPENAI_MODEL_LIGHT:'oud-model'});const {b}=await family(env,'p@x.nl');
 const book='Een vierkantswortel is de niet-negatieve waarde die in het kwadraat het getal onder het wortelteken oplevert. Methode: schrijf eerst het getal als kwadraat.';
 const words='Woordenlijst H2\nhet huis - la maison\nde kat - le chat\nde hond - le chien';
 const old=globalThis.fetch;const sent=[];
 const retired=[];globalThis.fetch=async(url,o)=>{const body=JSON.parse(o.body);if(body.model==='oud-model'){retired.push(body.text.format.name);return Response.json({error:{code:'model_not_found',message:'The model has been deprecated'}},{status:404});}sent.push(body);const name=body.text.format.name;let out;
  if(name==='leerstof'){out=demoModule();const doc=JSON.parse(body.input[0].content[0].text).pages[0];for(const x of [...out.chapters,...out.questions])x.cite={source:doc.id,page:1,quote:doc.text.slice(0,40)};out.chapters[0].method='Schrijf eerst het getal als kwadraat.';}
  else out={nakijken:{points:2,confidence:'hoog',readable:true,feedback:'Goed antwoord.',methodMatch:'andere methode, wel juist',methodNote:'Je rekende met de rekenmachine; het boek schrijft 81 eerst als 9². Allebei juist.',steps:[{text:'√81 = 9',ok:true}]},uitleg:{verdict:'bijna',good:['Je noemt het kwadraat'],missing:['niet-negatief'],beyondBook:['Je noemt complexe getallen'],tip:'Kijk in je boek bij de definitie.'},woordjes:{langA:'Nederlands',langB:'Frans',cols:[],nlCol:0,rows:[{values:['het huis','la maison'],page:1},{values:['de kat','le chat'],page:1},{values:['de muis','la souris'],page:1}],warnings:[]}}[name];
  return Response.json({status:'completed',usage:{input_tokens:100,output_tokens:50},output:[{content:[{type:'output_text',text:JSON.stringify(out)}]}]});};
 try{
  const photo='data:image/jpeg;base64,'+Buffer.from('foto').toString('base64');
  assert.equal((await b.post('/api/check-work',{module:'demo',question:'demo-0',image:photo})).status,403,'consent first');
  await b.post('/api/family/consent',{consent:true});
  const doc=(await b.post('/api/documents',textDoc(book,'boek-h1.txt'))).body.document.id;
  const ar=await b.post('/api/analyse',{documents:[doc],subject:'Wiskunde',level:'2 havo/vwo'});assert.equal(ar.status,200,JSON.stringify(ar.body));const m=ar.body.module;assert.equal(m.chapters[0].method,'Schrijf eerst het getal als kwadraat.');
  assert.match(sent[0].instructions,/geen eigen kennis, geen internet/);assert.match(sent[0].instructions,/werkwijze/);
  assert.equal((await b.post('/api/check-work',{module:m.id,question:'bestaat-niet',image:photo})).status,404);
  assert.equal((await b.post('/api/check-work',{module:m.id,question:m.questions[0].id,image:'data:text/html;base64,AAAA'})).status,400);
  const r=await b.post('/api/check-work',{module:m.id,question:m.questions[0].id,answer:'9',image:photo});assert.equal(r.status,200,JSON.stringify(r.body));
  assert.equal(r.body.result.methodMatch,'andere methode, wel juist');assert.match(r.body.result.methodNote,/het boek schrijft/);
  const graded=sent[1].input[0].content;assert.equal(JSON.parse(graded[0].text).methodeUitHetBoek,'Schrijf eerst het getal als kwadraat.');
  assert.ok(graded.some(c=>c.type==='input_text'&&c.text.startsWith('Bronpagina 1 uit het boek')&&c.text.includes('schrijf eerst het getal als kwadraat')),'the book page itself is sent');
  assert.match(sent[1].instructions,/andere, wiskundig of inhoudelijk juiste methode/);assert.equal(sent[1].store,false);
  const e=await b.post('/api/explain',{module:m.id,chapter:0,term:'Vierkantswortel',text:'Het getal dat keer zichzelf het getal onder de wortel geeft.'});assert.equal(e.status,200);
  assert.equal(sent[1].model,'gpt-4.1-mini','grading uses the main model');assert.deepEqual(retired,['uitleg'],'a text-only explanation check tries the cheaper model first');assert.equal(sent[2].model,'gpt-4.1-mini','a retired cheaper model falls back to the main model');
  assert.deepEqual(e.body.result.beyondBook,['Je noemt complexe getallen']);assert.ok(sent[2].input[0].content.some(c=>c.text?.startsWith('Bronpagina 1')));
  // Words come only from an uploaded source, and only if they are literally in it.
  assert.equal((await b.post('/api/words-from-source',{documents:[]})).status,400);assert.equal((await b.post('/api/words-from-source',{documents:['onbekend']})).status,404);
  const wdoc=(await b.post('/api/documents',textDoc(words,'frans-h2.txt'))).body.document.id;
  const w=await b.post('/api/words-from-source',{documents:[wdoc]});assert.equal(w.status,200,JSON.stringify(w.body));
  assert.deepEqual(w.body.result.pairs.map(p=>[p.a,p.b]),[['het huis','la maison'],['de kat','le chat']],'"de muis" is not in the book and is dropped');
  assert.match(w.body.result.warnings.join(' '),/1 rij\(en\) stonden niet letterlijk in de bron/);assert.deepEqual(w.body.result.documents,[wdoc]);
  assert.match(sent[3].instructions,/Voeg nooit zelf woorden/);
  assert.equal((await b.post('/api/explain',{module:m.id,chapter:0,term:'Vierkantswortel',text:'Nog een keer proberen met meer woorden.'})).status,429,'monthly limit for checks');
  const s=(await b.get('/api/state')).body.usage;assert.equal(s.checks,3);assert.equal(s.analyses,1,'checks do not use up analyses');
  // Another family cannot check against this family's material.
  const other=await family(env,'q@x.nl');await other.b.post('/api/family/consent',{consent:true});assert.equal((await other.b.post('/api/check-work',{module:m.id,question:m.questions[0].id,answer:'9'})).status,404);
  assert.equal((await other.b.post('/api/words-from-source',{documents:[wdoc]})).status,404);
 }finally{globalThis.fetch=old;}
});

test('Papieren proefwerk: stored per child, graded from photos question by question, never above the maximum, counts as an analysis',async()=>{
 const env=localEnv({OPENAI_API_KEY:'test'});const {b,state}=await family(env,'p@x.nl');const sam=state.profiles[0].id,m=demoModule();
 const old=globalThis.fetch;let sent;globalThis.fetch=async(url,o)=>{sent=JSON.parse(o.body);return Response.json({status:'completed',usage:{input_tokens:3000,output_tokens:400},output:[{content:[{type:'output_text',text:JSON.stringify({readable:true,overall:'Goed gewerkt.',answers:[{number:1,answerSeen:'9',points:5,confidence:'hoog',feedback:'Goed.',methodMatch:'zelfde methode',methodNote:''},{number:2,answerSeen:'13',points:0,confidence:'middel',feedback:'Fout.',methodMatch:'niet te zien',methodNote:''}]})}]}]});};
 try{
  const paper={id:'pap1',profile:sam,module:'demo',title:m.title,code:'ABCD-2345',questions:m.questions.slice(0,3),created:Date.now()};
  assert.equal((await b.put('/api/items/paper/pap1',{data:{...paper,code:'kort'}})).status,400);
  assert.equal((await b.put('/api/items/paper/pap1',{data:paper})).status,200);
  assert.deepEqual((await b.get('/api/state')).body.papers.map(p=>p.code),['ABCD-2345']);
  const photo='data:image/jpeg;base64,'+Buffer.from('blad').toString('base64');
  assert.equal((await b.post('/api/grade-paper',{paper:'pap1',images:[photo]})).status,403,'consent first');await b.post('/api/family/consent',{consent:true});
  assert.equal((await b.post('/api/grade-paper',{paper:'pap1',images:[]})).status,400);assert.equal((await b.post('/api/grade-paper',{paper:'onbekend',images:[photo]})).status,404);
  const r=await b.post('/api/grade-paper',{paper:'pap1',images:[photo,photo]});assert.equal(r.status,200,JSON.stringify(r.body));
  assert.deepEqual(r.body.result.answers.map(a=>a.points),[2,0,0],'clamped to the 2-point maximum; a missing answer gets 0');assert.match(r.body.result.answers[2].feedback,/niet gevonden/);
  const content=sent.input[0].content;assert.equal(content.filter(c=>c.type==='input_image').length,2);assert.equal(JSON.parse(content[0].text).vragen.length,3);assert.match(sent.instructions,/Het boek .* is de maatstaf/);
  assert.equal((await b.get('/api/state')).body.usage.analyses,1);
  const other=await family(env,'q@x.nl');await other.b.post('/api/family/consent',{consent:true});assert.equal((await other.b.post('/api/grade-paper',{paper:'pap1',images:[photo]})).status,404);
 }finally{globalThis.fetch=old;}
});

test('Photos of the book: read out as text, checked by the family, then the photos can be removed and only text stays',async()=>{
 const env=localEnv({OPENAI_API_KEY:'test'});const {b}=await family(env,'p@x.nl');await b.post('/api/family/consent',{consent:true});
 const old=globalThis.fetch;let sent;globalThis.fetch=async(url,o)=>{sent=JSON.parse(o.body);return Response.json({status:'completed',usage:{input_tokens:900,output_tokens:300},output:[{content:[{type:'output_text',text:JSON.stringify({pages:[{page:1,text:'§3.1 Wortels\nEen vierkantswortel is de niet-negatieve waarde die in het kwadraat het getal geeft.',unreadable:false}]})}]}]});};
 try{
  const img='data:image/jpeg;base64,'+Buffer.from('jpegdata').toString('base64');
  const up=await b.post('/api/documents',{meta:{name:'blz-42.jpg',type:'image/jpeg',warnings:[],subject:'Wiskunde',chapter:'H3'},pages:[{id:'x',page:1,text:'',image:img}],data:Buffer.from('jpegdata').toString('base64')});
  const id=up.body.document.id;assert.equal(up.body.document.hasImages,true);
  assert.equal((await b.post(`/api/documents/${id}/drop-images`)).status,400,'not before the text is checked');
  const t=await b.post(`/api/documents/${id}/transcribe`);assert.equal(t.status,200,JSON.stringify(t.body));assert.match(t.body.pages[0].text,/§3.1 Wortels/);assert.ok(t.body.document.transcribed);assert.equal(t.body.document.verified,null);
  assert.match(sent.instructions,/letterlijk over/);assert.match(sent.instructions,/Verzin niets/);assert.equal(sent.input[0].content[1].type,'input_image');
  assert.equal((await b.post(`/api/documents/${id}/text`,{pages:[{page:9,text:'x'}]})).status,400);
  globalThis.fetch=async(url,o)=>{sent=JSON.parse(o.body);return Response.json({status:'completed',usage:{input_tokens:900,output_tokens:100},output:[{content:[{type:'output_text',text:JSON.stringify({pages:[{page:1,issues:[{found:'§3.1 Wortels',should:'§ 3.1 Wortels',why:'paragraafnummer'},{found:'staat niet in de tekst',should:'iets',why:'verzonnen'},{found:'',should:'Opdracht 1',why:'ontbrekende regel'}]}]})}]}]});};
  const ver=await b.post(`/api/documents/${id}/verify`,{pages:[{page:1,text:'§3.1 Wortels\nEen vierkantswortel is de niet-negatieve waarde.'}]});assert.equal(ver.status,200,JSON.stringify(ver.body));
  assert.deepEqual(ver.body.result.pages[0].issues.map(i=>i.why),['paragraafnummer','ontbrekende regel'],'a "difference" that is not in the text is dropped');
  assert.equal(sent.input[0].content[0].text.includes('Een vierkantswortel is de niet-negatieve waarde.'),true,'the edited text is what is compared');assert.equal(sent.input[0].content[2].type,'input_image');assert.match(sent.instructions,/past zelf niets aan|Noem alleen echte verschillen/);
  const v=await b.post(`/api/documents/${id}/text`,{pages:[{page:1,text:'§3.1 Wortels\nEen vierkantswortel is de niet-negatieve waarde die in het kwadraat het getal onder het wortelteken geeft.'}]});assert.equal(v.status,200);assert.ok(v.body.document.verified);
  const other=await family(env,'q@x.nl');assert.equal((await other.b.post(`/api/documents/${id}/drop-images`)).status,404,'another family cannot touch it');
  const dr=await b.post(`/api/documents/${id}/drop-images`);assert.equal(dr.status,200);assert.ok(dr.body.document.imagesRemoved);assert.equal(dr.body.document.name,'blz-42.txt');assert.equal(dr.body.document.type,'text/plain');
  const pages=(await b.get(`/api/documents/${id}/pages`)).body.pages;assert.equal(pages[0].image,undefined,'the photo is gone');assert.match(pages[0].text,/onder het wortelteken/);
  const orig=Buffer.from((await b.get(`/api/documents/${id}/original`)).body).toString();assert.match(orig,/--- Bladzijde 1 ---/);assert.ok(!orig.includes('jpegdata'));
  assert.equal((await b.post(`/api/documents/${id}/transcribe`)).status,400,'nothing left to read');
  assert.equal((await b.get('/api/state')).body.usage.checks,2);
 }finally{globalThis.fetch=old;}
});

test('Deleting material: a whole chapter or everything, with or without results; only a parent; the sample lesson stays',async()=>{
 const env=localEnv();const {b,state}=await family(env,'p@x.nl');const sam=state.profiles[0].id;
 const d1=(await b.post('/api/documents',textDoc('Bladzijde een.','a.txt'))).body.document.id,d2=(await b.post('/api/documents',textDoc('Bladzijde twee.','b.txt'))).body.document.id;
 const m={...demoModule(),id:'m1',approved:true,demo:false};assert.equal((await b.put('/api/items/module/m1',{data:m})).status,200);
 assert.equal((await b.put('/api/items/attempt/a1',{data:{...attemptFor(sam),id:'a1',module:'m1'}})).status,200);
 await b.post(`/api/profiles/${sam}/login`,{login:'sam',password:'sam-wachtwoord'});const kid=browser(env);await kid.post('/api/login',{login:'sam',password:'sam-wachtwoord'});
 assert.equal((await kid.post('/api/material/delete',{documents:[d1]})).status,403);
 assert.equal((await b.post('/api/material/delete',{modules:['demo']})).status,400);
 assert.equal((await b.post('/api/material/delete',{documents:[d1],modules:['m1']})).status,200);
 let s=(await b.get('/api/state')).body;assert.deepEqual(s.documents.map(d=>d.id),[d2]);assert.deepEqual(s.modules.map(m=>m.id),['demo']);assert.equal(s.attempts.length,1,'results kept unless asked');
 assert.equal((await env.FILES.list({prefix:`${s.me&&''}`})).objects.filter(o=>o.key.includes(d1)).length,0,'files are removed');
 await b.put('/api/items/module/m1',{data:m});
 assert.equal((await b.post('/api/material/delete',{documents:[d2],modules:['m1'],results:true})).status,200);
 s=(await b.get('/api/state')).body;assert.equal(s.documents.length,0);assert.equal(s.attempts.length,0);assert.deepEqual(s.modules.map(m=>m.id),['demo']);
});

test('Pages are put in book order by their printed page number, whatever order they were uploaded in',async()=>{
 const env=localEnv({OPENAI_API_KEY:'test'});const {b}=await family(env,'p@x.nl');await b.post('/api/family/consent',{consent:true});
 const up=async(text,name)=>(await b.post('/api/documents',textDoc(text,name))).body.document.id;
 const p48=await up('Bladzijde achtenveertig: volume en de maatcilinder.','b.txt'),p47=await up('Bladzijde zevenenveertig: massa en de weegschaal.','a.txt'),p49=await up('Bladzijde negenenveertig, zonder nummer.','c.txt');
 assert.equal((await b.post(`/api/documents/${p48}/text`,{pages:[{page:1,text:'Bladzijde achtenveertig: volume en de maatcilinder.',bookPage:48}]})).body.document.bookPages[0],48);
 await b.post(`/api/documents/${p47}/text`,{pages:[{page:1,text:'Bladzijde zevenenveertig: massa en de weegschaal.',bookPage:47}]});
 assert.equal((await b.post(`/api/documents/${p49}/text`,{pages:[{page:1,text:'x',bookPage:'abc'}]})).body.document.bookPages[0],null,'nonsense is not a page number');
 const old=globalThis.fetch;let sent;globalThis.fetch=async(url,o)=>{sent=JSON.parse(o.body);return Response.json({status:'completed',usage:{input_tokens:1,output_tokens:1},output:[{content:[{type:'output_text',text:'{}'}]}]});};
 try{await b.post('/api/analyse',{documents:[p48,p49,p47],subject:'Natuur & techniek',level:'1 havo'});}finally{globalThis.fetch=old;}
 const pages=JSON.parse(sent.input[0].content[0].text).pages;assert.deepEqual(pages.map(p=>p.bladzijdeInBoek??null),[47,48,null],'numbered pages first, in book order');
 assert.match(sent.instructions,/doorlopen op de volgende pagina/);assert.match(sent.instructions,/\[Onthoud: …\]/);
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
