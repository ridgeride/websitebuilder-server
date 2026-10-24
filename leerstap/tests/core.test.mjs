import test from 'node:test';import assert from 'node:assert/strict';
import {numberExpr,grade,totals,chooseQuestions,demoModule,initialState,validateState,validateModule,nextReview,esc,schedulePractice} from '../src/core.js';
import {derive,encrypt,decrypt} from '../src/vault.js';import {analysePages} from '../worker/analyse.js';
test('Equivalent math expressions, decimals and roots',()=>{assert.equal(numberExpr('√81'),9);assert.equal(numberExpr('2√3'),2*Math.sqrt(3));assert.equal(numberExpr('sqrt(50)/sqrt(2)'),5);assert.equal(numberExpr('0,5'),.5);assert.equal(numberExpr('(2×√3)²'),12-Number.EPSILON*8);});
test('Reject code, variables, division by zero and oversized input',()=>{for(const s of ['alert(1)','process.exit()','2x','1/0','sqrt(-1)','2+'.repeat(200)])assert.throws(()=>numberExpr(s));});
test('Grade equivalent values, flag steps for partial credit and open answers',()=>{const q=demoModule().questions[0];assert.equal(grade(q,'sqrt(81)').points,2);assert.equal(grade(q,'8','9*9=81').pending,true);assert.equal(grade(q,'8').points,0);assert.equal(grade(q,'negen').pending,true);assert.equal(grade(q,'','').pending,false);assert.equal(grade(demoModule().questions.at(-1),'5 is niet 7').pending,true);});
test('Grade remains provisional until review and scoring uses weighted points',()=>{assert.deepEqual(totals([{points:2,pending:false},{points:0,pending:true}],[{points:2},{points:3}]),{points:2,max:5,pending:true,grade:4.6});});
test('Adaptive order prioritizes mistakes and isolates profiles',()=>{const m=demoModule(),a={profile:'a',questions:[m.questions[0]],results:[{points:0,pending:false}],review:{}};assert.equal(chooseQuestions(m,[a],'a','adaptief',1)[0].id,'demo-0');assert.equal(chooseQuestions(m,[a],'b','3',1)[0].level,3);});
test('Review grows, caps, and resets after a mistake',()=>{assert.equal(nextReview(null,true,0).due,86400000);assert.equal(nextReview({interval:20},true,0).interval,30);assert.equal(nextReview({interval:20},false,0).due,600000);});
test('Sources must exist and quote verbatim',()=>{const m=demoModule(),pages=[{id:'voorbeeld',page:1,text:m.chapters[0].summary}];assert.ok(validateModule(m,pages));const n=m.questions.length;m.questions[0].cite={source:'fake',page:5,quote:'fake'};assert.equal(validateModule(m,pages).questions.length,n-1);for(const q of m.questions)q.cite={source:'fake',page:5,quote:'fake'};assert.throws(()=>validateModule(m,pages));});
test('Encrypted vault and backup round-trip; wrong passwords and tampering rejected',async()=>{const salt=crypto.getRandomValues(new Uint8Array(16)),key=await derive('test-wachtwoord',salt),s=initialState();s.documents.push({id:'doc',data:'secret'});const e=await encrypt(s,key,salt);assert.ok(!JSON.stringify(e).includes('secret'));assert.deepEqual((await decrypt(e,'test-wachtwoord')).state,s);await assert.rejects(()=>decrypt(e,'wrong'));await assert.rejects(()=>decrypt({...e,data:e.data.slice(0,-8)+'AAAAAAAA'},'test-wachtwoord'));assert.throws(()=>validateState({version:99}));});
test('HTML is escaped',()=>assert.equal(esc('<script>"&'), '&lt;script&gt;&quot;&amp;'));
test('Exponent precedence follows mathematical convention',()=>{assert.equal(numberExpr('-3^2'),-9);assert.equal(numberExpr('(-3)^2'),9);assert.equal(numberExpr('2^3^2'),512);});
test('Backup validates all nested data and preserves optional profile extensions',()=>{let s=initialState();s.profiles[0].subjects=['Wiskunde','Latijn'];assert.equal(validateState(s),s);s.modules[0].questions[0].points=-1;assert.throws(()=>validateState(s));s=initialState();s.documents.push({id:'x',name:'x',type:'image/png',data:'x',warnings:[],pages:[{id:'x',page:1,text:'',image:'javascript:alert(1)'}]});assert.throws(()=>validateState(s));});
test('Analysis refuses without credentials and validates page input',async()=>{const page={id:'voorbeeld',page:1,text:'x'};await assert.rejects(()=>analysePages([page],{},{}),{status:503});await assert.rejects(()=>analysePages([],{},{OPENAI_API_KEY:'fake'}),{status:400});await assert.rejects(()=>analysePages([{...page,image:'javascript:alert(1)'}],{},{OPENAI_API_KEY:'fake'}),{status:400});});
test('AI integration validates provider output with a stub, never a live credential',async()=>{let called;const old=globalThis.fetch,m=demoModule();globalThis.fetch=async(url,options)=>{called=JSON.parse(options.body);return Response.json({status:'completed',usage:{input_tokens:5,output_tokens:7},output:[{content:[{type:'output_text',text:JSON.stringify(m)}]}]});};try{const r=await analysePages([{id:'voorbeeld',page:1,text:m.chapters[0].summary}],{subject:'Wiskunde',level:'2 havo/vwo'},{OPENAI_API_KEY:'test-only'});assert.equal(r.module.title,m.title);assert.deepEqual(r.usage,{input:5,output:7});assert.equal(called.store,false);assert.equal(called.text.format.strict,true);}finally{globalThis.fetch=old;}});

test('Mistakes repeat with support then require two independent correct answers',()=>{
 const q=demoModule().questions[0],d={mode:'practice',questions:[q],answers:[],results:[]};
 const apply=(i,points)=>{const r={points,pending:false};d.results[i]=r;return schedulePractice(d,i,r);};
 assert.equal(apply(0,0),true);assert.equal(d.questions[1].support,true);
 assert.equal(apply(1,2),true);assert.equal(d.questions[2].support,false);
 assert.equal(apply(2,2),true);assert.equal(apply(3,2),false);assert.equal(d.questions.length,4);
});
test('Test sessions, pending reviews and first-time correct answers do not repeat',()=>{
 for(const [mode,r] of [['test',{points:0,pending:false}],['practice',{points:0,pending:true}],['practice',{points:2,pending:false}]]){
 const d={mode,questions:[demoModule().questions[0]],answers:[],results:[]};assert.equal(schedulePractice(d,0,r),false);assert.equal(d.questions.length,1);
 }
});
test('Repeats leave two intervening questions and preserve answer alignment',()=>{
 const d={mode:'practice',questions:demoModule().questions.slice(0,4),answers:[{answer:'8',steps:''}],results:[{points:0,pending:false}]};
 schedulePractice(d,0,d.results[0]);assert.equal(d.questions[3].id,'demo-0');assert.equal(d.questions[4].id,'demo-3');assert.equal(d.answers[3],null);
});

test('Woordjes: alternatives, brackets, articles, accents and small typos',async()=>{
 const {gradeWord,wordQuestions,parsePairs}=await import('../src/core.js');
 const q=(answer)=>({kind:'word',prompt:'x',answer,points:1});
 const cat=(answer,given)=>gradeWord(q(answer),given).category;
 assert.equal(cat('la maison','La maison.'),'Goed');assert.equal(cat('grand / grande','grande'),'Goed');assert.equal(cat('(to) walk','walk'),'Goed');assert.equal(cat('(to) walk','to walk'),'Goed');
 assert.equal(cat('la maison','maison'),'Lidwoord');assert.equal(cat('la maison','le maison'),'Lidwoord');assert.equal(cat('l’école','l\'ecole'),'Accent');
 assert.equal(cat('manger','mangre'),'Fout','two letters swapped is not a one-letter typo');assert.equal(cat('manger','mangr'),'Spelling');assert.equal(cat('chat','chien'),'Fout');assert.equal(cat('chat',''),'Niet ingevuld');
 assert.equal(gradeWord(q('la maison'),'maison').points,0,'almost right is not right');
 const list={id:'l1',title:'Frans',pairs:[{id:'p1',a:'het huis',b:'la maison'}]};
 assert.deepEqual(wordQuestions(list,'both').map(x=>[x.id,x.prompt,x.answer]),[['p1-ab','het huis','la maison'],['p1-ba','la maison','het huis']]);
 assert.deepEqual(parsePairs('huis = maison\n\nkat - chat\nhond\tchien\nzonder scheiding'),[{a:'huis',b:'maison'},{a:'kat',b:'chat'},{a:'hond',b:'chien'}]);
});

test('Drill: right first time is done, a mistake needs two in a row, and it ends when everything is mastered',async()=>{
 const {startDrill,recordDrill,pickDrill,drillDone}=await import('../src/core.js');
 const pool=['a','b','c'].map(id=>({id}));let {state,next}=startDrill(pool,()=>0);const asked=[next.id],recent=[next.id];
 // Answer: 'b' wrong the first time, everything else right.
 let wrongOnce=false,q=next,turns=0;
 while(q&&turns<20){const correct=!(q.id==='b'&&!wrongOnce);if(q.id==='b')wrongOnce=true;recordDrill(state,q,correct);recent.push(q.id);q=pickDrill(pool,state,recent,()=>0);if(q)asked.push(q.id);turns++;}
 assert.ok(drillDone(pool,state));assert.equal(asked.filter(x=>x==='a').length,1);assert.equal(asked.filter(x=>x==='b').length,3,'wrong once, then twice right');assert.equal(asked.filter(x=>x==='c').length,1);
 // Only when one question is left may it come twice in a row.
 assert.deepEqual(asked,['a','b','c','b','b'],'a mistake comes back after another question');
});

test('Toetsplanner: a task for every day, a test two days before and a final repeat',async()=>{
 const {planDays,validPlan}=await import('../src/core.js');
 const p={id:'p',profile:'k',title:'Toets',start:'2026-11-02',date:'2026-11-09',items:[{type:'module',id:'m'},{type:'wordlist',id:'w'}],minutes:15,checked:{'2026-11-03':true}};
 assert.ok(validPlan(p));const days=planDays(p);
 assert.deepEqual(days.map(d=>d.kind),['start','drill','drill','drill','drill','test','repeat']);assert.equal(days[0].day,'2026-11-02');assert.equal(days.at(-1).day,'2026-11-08');
 assert.equal(days[1].done,true);assert.equal(days[5].item.type,'module','the test day uses the learning material');
 assert.deepEqual(planDays({...p,date:'2026-11-03'}).map(d=>d.kind),['start']);
 assert.equal(validPlan({...p,date:'2026-11-01'}),false,'the test cannot be before the start');assert.equal(validPlan({...p,items:[]}),false);
});

test('Toets op maat: paragraphs, a realistic mix of levels, and feedback per paragraph',async()=>{
 const {chooseTest,testFeedback,questionChapter,questionsIn}=await import('../src/core.js');
 const cite={source:'s',page:1,quote:'q'},mk=(i,chapter,level)=>({id:'q'+i,chapter,level,points:2,goal:'Doel '+chapter,kind:'open',prompt:'?',answer:'!',explanation:'',hint:'',rubric:'',cite});
 const m={chapters:[{title:'§1',goals:['Doel 0'],cite},{title:'§2',goals:['Doel 1'],cite}],questions:[...[1,1,2,2,2,3].map((l,i)=>mk(i,0,l)),...[1,2,3].map((l,i)=>mk(10+i,1,l))]};
 assert.equal(questionsIn(m,[1]).length,3);assert.equal(questionChapter(m,{goal:'Doel 1',cite}),1,'older questions are matched by learning goal');
 const t=chooseTest(m,null,6);assert.equal(t.length,6);assert.deepEqual(t.map(q=>q.level),[...t.map(q=>q.level)].sort(),'easy to hard');assert.ok(new Set(t.map(q=>q.level)).size===3,'all levels');
 assert.ok(chooseTest(m,[1],10).every(q=>q.chapter===1));
 const a={questions:t,results:t.map(q=>({points:q.chapter===0?q.points:0,pending:false,category:'Rekenfout'}))};
 const f=testFeedback(m,a);assert.equal(f.find(r=>r.chapter===0).status,'goed');const weak=f.find(r=>r.chapter===1);assert.equal(weak.status,'meer leren');assert.match(weak.why,/Doel 1/);assert.match(weak.why,/rekenfout/);
});

test('Week summary and mastery count independent answers only',async()=>{
 const {weekSummary,masteredIds,readiness}=await import('../src/core.js');
 const now=new Date('2026-11-05T12:00:00').getTime(),q={id:'x',points:1},r=(p)=>({points:p,pending:false});
 const attempts=[{profile:'k',created:now-86400000,questions:[q],results:[r(0)]},{profile:'k',created:now,questions:[q,{...q,id:'y',support:true}],results:[r(1),r(1)]},{profile:'ander',created:now,questions:[q],results:[r(1)]}];
 assert.deepEqual([...masteredIds(attempts,'k')],['x']);assert.equal(readiness([q,{id:'y'}],attempts,'k').pct,50);
 const w=weekSummary(attempts,'k',now);assert.deepEqual(w.days,[false,false,true,true,false,false,false]);assert.equal(w.questions,3);
});

test('Units after a number are accepted, and ³ works in a calculation',async()=>{
 const {grade,numberExpr}=await import('../src/core.js');
 const q={kind:'numeric',answer:'2000',points:1,explanation:'2 dm³ = 2000 cm³'};
 for(const a of ['2000','2000 cm³','2000cm3','2000 mL','2.000'.replace('.','')])assert.equal(grade(q,a).points,1,a);
 assert.equal(grade(q,'200 cm³').points,0);assert.equal(numberExpr('10³'),1000);assert.equal(grade({...q,answer:'1,5'},'1,5 kg').points,1);
});

test('Citations: a wrong page number or photo is repaired by finding the quote; an invented quote still blocks',async()=>{
 const {validateModule}=await import('../src/core.js');
 const pages=[{id:'a',page:1,bookPage:213,text:'14 Irregular verbs\nto be was/were been zijn; worden'},{id:'b',page:1,bookPage:214,text:'to eat ate eaten eten'}];
 const mk=cite=>({title:'T',chapters:[{title:'c',summary:'s',goals:['g'],terms:[],cite}],questions:[{kind:'open',points:1,level:1,prompt:'p',answer:'a',explanation:'e',hint:'h',goal:'g',rubric:'r',cite:{source:'b',page:1,quote:'to eat ate eaten'}}]});
 const m=validateModule(mk({source:'a',page:213,quote:'to be was/were  been'}),pages);assert.deepEqual([m.chapters[0].cite.source,m.chapters[0].cite.page],['a',1],'book page 213 → photo a, page 1; spacing does not matter');
 const m2=validateModule(mk({source:'b',page:1,quote:'14 Irregular verbs'}),pages);assert.equal(m2.chapters[0].cite.source,'a','wrong photo repaired');
 const m3=validateModule(mk({source:'a',page:1,quote:'to swim swam swum'}),pages);assert.equal(m3.chapters[0].cite.quote,'to eat ate eaten','an invented chapter quote borrows the checked quote of its question');
 const long=[{id:'a',page:1,text:'De inhoud van een kubus bereken je met lengte × breedte × hoogte. Onthoud: 1 dm³ = 1 liter.'}];
 const m4=validateModule({...mk({source:'a',page:1,quote:'De inhoud van een kubus bereken je met Lengte x breedte x hoogte!'}),questions:[mk().questions[0],{...mk().questions[0],cite:{source:'a',page:1,quote:'iets wat nergens staat'}}].map(q=>({...q,cite:{...q.cite,source:'a',quote:q.cite.quote==='to eat ate eaten'?'Onthoud 1 dm³ = 1 liter':q.cite.quote}}))},long);
 assert.equal(m4.chapters[0].cite.quote,'De inhoud van een kubus bereken je met lengte','a changed quote is replaced by the literal part of the page');
 assert.equal(m4.questions.length,1,'a question whose quote is nowhere is left out');assert.match(m4.warnings.join(' '),/1 vraag/);
 assert.throws(()=>validateModule({...mk({source:'x',page:9,quote:'iets verzonnen'}),questions:[{...mk().questions[0],cite:{source:'x',page:9,quote:'ook verzonnen hier'}}]},pages),/niet teruggevonden/);
});
