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
 assert.equal(state.wordlists[0].id,'demo-woorden','every family starts with a sample word list');
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
 let s=(await kid.get('/api/state')).body;assert.deepEqual(s.plans.map(p=>p.id),['plan1']);assert.equal(s.wordlists.length,2);
 assert.equal((await parent.get('/api/state')).body.plans.length,2);
 const noorKid=browser(env);await noorKid.post('/api/login',{login:'noor',password:'noor-wachtwoord'});
 assert.equal((await noorKid.del('/api/items/plan/plan1')).status,403);assert.equal((await noorKid.del('/api/items/wordlist/l1')).status,403,'only the maker or a parent deletes a list');
 assert.equal((await kid.del('/api/items/wordlist/l1')).status,200);assert.equal((await kid.del('/api/items/plan/plan1')).status,200);
 // A word drill is saved as a draft and then as a result, like any other session.
 const q={id:'p1-ab',kind:'word',prompt:'het huis',answer:'la maison',level:1,points:1,goal:'Frans H1',hint:'h',explanation:'e',rubric:'r',cite:{source:'l1',page:1,quote:'het huis'}};
 assert.equal((await kid.put('/api/items/draft/'+sam,{data:{profile:sam,module:'l1',title:'Frans H1',mode:'drill',kind:'words',pool:[q],drill:{'p1-ab':{streak:0,wrong:0,asked:0}},questions:[q],answers:[],results:[]}})).status,200);
 assert.equal((await kid.put('/api/items/attempt/w1',{data:{id:'w1',profile:sam,module:'l1',title:'Frans H1',mode:'drill',kind:'words',questions:[q],answers:[{answer:'la maison',steps:''}],results:[{points:1,pending:false,confidence:'hoog',feedback:'ok',category:'Goed'}],review:{},created:Date.now()}})).status,200);
 // Backups carry word lists and plans.
 const exp=(await parent.get('/api/export')).body;assert.ok(exp.wordlists.some(w=>w.id==='demo-woorden'));assert.deepEqual(exp.plans.map(p=>p.id),['plan3']);
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

test('AI checks: photo grading, explanation feedback and words from a photo need consent, use the stored question and count separately',async()=>{
 const env=localEnv({OPENAI_API_KEY:'test',AI_CHECK_LIMIT:'3'});const {b,state}=await family(env,'p@x.nl');
 const old=globalThis.fetch;const sent=[];
 globalThis.fetch=async(url,o)=>{const body=JSON.parse(o.body);sent.push(body);const name=body.text.format.name;
  const out={nakijken:{points:7,confidence:'hoog',readable:true,feedback:'Goede aanpak.',steps:[{text:'√81 = 9',ok:true}]},uitleg:{verdict:'bijna',good:['Je noemt het kwadraat'],missing:['niet-negatief'],tip:'Noem ook dat de uitkomst nooit negatief is.'},woordjes:{langA:'Nederlands',langB:'Frans',pairs:[{a:'het huis',b:'la maison'},{a:' ',b:'leeg'}],warnings:[]}}[name];
  return Response.json({status:'completed',usage:{input_tokens:100,output_tokens:50},output:[{content:[{type:'output_text',text:JSON.stringify(out)}]}]});};
 try{
  const photo='data:image/jpeg;base64,'+Buffer.from('foto').toString('base64');
  assert.equal((await b.post('/api/check-work',{module:'demo',question:'demo-0',image:photo})).status,403,'consent first');
  await b.post('/api/family/consent',{consent:true});
  assert.equal((await b.post('/api/check-work',{module:'demo',question:'bestaat-niet',image:photo})).status,404);
  assert.equal((await b.post('/api/check-work',{module:'demo',question:'demo-0',image:'data:text/html;base64,AAAA'})).status,400);
  const r=await b.post('/api/check-work',{module:'demo',question:'demo-0',answer:'9',image:photo});assert.equal(r.status,200,JSON.stringify(r.body));
  assert.equal(r.body.result.points,2,'never more than the question is worth');assert.equal(r.body.result.steps[0].ok,true);
  const graded=JSON.parse(sent[0].input[0].content[0].text);assert.equal(graded.vraag,'Bereken √81.');assert.match(graded.puntenmodel,/2 punten/);assert.equal(sent[0].input[0].content[2].type,'input_image');assert.equal(sent[0].store,false);
  assert.equal((await b.post('/api/explain',{module:'demo',chapter:0,term:'Kwadraat',text:'kort'})).status,400);
  const e=await b.post('/api/explain',{module:'demo',chapter:0,term:'Vierkantswortel',text:'Het getal dat keer zichzelf het getal onder de wortel geeft.'});assert.equal(e.status,200);assert.equal(e.body.result.verdict,'bijna');
  assert.match(JSON.parse(sent[1].input[0].content[0].text).definitieUitBron,/niet-negatieve/);
  const w=await b.post('/api/words-from-photo',{image:photo});assert.equal(w.status,200);assert.deepEqual(w.body.result.pairs,[{a:'het huis',b:'la maison'}],'empty pairs are dropped');
  assert.equal((await b.post('/api/explain',{module:'demo',chapter:0,term:'Vierkantswortel',text:'Nog een keer proberen met meer woorden.'})).status,429,'monthly limit for checks');
  const s=(await b.get('/api/state')).body.usage;assert.equal(s.checks,3);assert.equal(s.analyses,0,'checks do not use up analyses');
  // A child of another family cannot grade against this family's material.
  const other=await family(env,'q@x.nl');await other.b.post('/api/family/consent',{consent:true});
  const mod=state.modules[0].id;assert.equal((await other.b.post('/api/check-work',{module:'onbekend',question:'demo-0',answer:'9'})).status,404);assert.ok(mod);
 }finally{globalThis.fetch=old;}
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
