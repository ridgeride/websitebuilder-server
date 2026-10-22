export const VERSION=1;
export const uid=()=>crypto.randomUUID();
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Deliberately small arithmetic grammar: no eval, variables, assignments or executable expressions.
export function numberExpr(input){
 let s=String(input).trim().replace(/,/g,'.').replace(/²/g,'^2').replace(/×|·/g,'*').replace(/÷/g,'/').replace(/√/g,'sqrt').replace(/\s/g,'');
 if(s.length>150||!s)throw Error('Gebruik een getal of een rekenuitdrukking.');
 const tokens=s.match(/sqrt|\d+(?:\.\d+)?|[()+*/^\-]/g)||[];
 if(tokens.join('')!==s)throw Error('Deze notatie vraagt om ouderreview.');
 let p=0;function atom(){let t=tokens[p++];if(t==='sqrt')return Math.sqrt(atom());if(t==='('){let v=sum();if(tokens[p++]!==')')throw Error('Haakje ontbreekt');return v;}if(!/^\d/.test(t||''))throw Error('Onvolledige uitdrukking');return Number(t);}
 function power(){if(tokens[p]==='-'){p++;return -power();}if(tokens[p]==='+'){p++;return power();}let v=atom();if(tokens[p]==='^'){p++;v=v**power();}return v;}
 function product(){let v=power();while(p<tokens.length){let t=tokens[p];if(t==='*'||t==='/'){p++;let n=power();v=t==='*'?v*n:v/n;}else if(t==='sqrt'||t==='('){v*=power();}else break;}return v;}
 function sum(){let v=product();while(tokens[p]==='+'||tokens[p]==='-'){let t=tokens[p++],n=product();v=t==='+'?v+n:v-n;}return v;}
 let v=sum();if(p!==tokens.length||!Number.isFinite(v)||Math.abs(v)>1e12)throw Error('Niet betrouwbaar te berekenen');return v;
}
export function grade(q,answer,steps=''){
 if(!answer.trim()&&!steps.trim())return {points:0,pending:false,confidence:'hoog',feedback:'Geen antwoord ingevuld.',category:'Niet ingevuld'};
 if(q.kind==='numeric')try{const a=numberExpr(answer),b=numberExpr(q.answer);if(Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(b)))return {points:q.points,pending:false,confidence:'hoog',feedback:q.explanation,category:'Goed'};
 return {points:0,pending:!!steps.trim(),confidence:steps.trim()?'review nodig':'hoog',feedback:'De einduitkomst klopt nog niet. '+q.explanation,category:'Rekenfout'};
 }catch{}
 return {points:0,pending:true,confidence:'review nodig',feedback:'Een ouder beoordeelt inhoud, notatie en tussenstappen met het puntenmodel.',category:'Inhoud / uitwerking'};
}
export function totals(results,questions){let max=questions.reduce((a,q)=>a+q.points,0),points=results.reduce((a,r)=>a+r.points,0);return {max,points,pending:results.some(r=>r.pending),grade:max?Math.round((1+9*points/max)*10)/10:1};}
export function nextReview(previous,correct,now=Date.now()){let interval=correct?Math.min(30,(previous?.interval||0)?previous.interval*2:1):0;return {interval,due:now+(correct?interval*86400000:600000)};}
export function chooseQuestions(module,attempts,profile,level='adaptief',count=5,now=Date.now()){
 let history=attempts.filter(a=>a.profile===profile),scores=new Map();for(let a of history)for(let i=0;i<a.questions.length;i++){let q=a.questions[i],r=a.results?.[i];if(r&&!r.pending)scores.set(q.id,{...r,due:a.review?.[q.id]?.due||0});}
 let pool=module.questions.filter(q=>level==='adaptief'||q.level===Number(level));return pool.map((q,i)=>({q,rank:!scores.has(q.id)?2:scores.get(q.id).points<q.points?0:scores.get(q.id).due<=now?1:3,i})).sort((a,b)=>a.rank-b.rank||a.i-b.i).slice(0,count).map(x=>x.q);
}
// Repeats are practice-only; an assisted success is not independent recall.
export function schedulePractice(d,index,result){
 if(d.mode!=='practice'||result.pending)return false;
 const q=d.questions[index],prior=d.questions.slice(0,index).map((v,i)=>({q:v,r:d.results[i]})).filter(x=>x.q.id===q.id&&x.r&&!x.r.pending);
 const wrong=result.points<q.points;
 let streak=0;
 for(const x of prior){if(x.r.points<x.q.points||x.q.support)streak=0;else streak++;}
 const recovering=q.repeat||prior.some(x=>x.r.points<x.q.points);
 if(!wrong&&!q.support&&(!recovering||streak>=1))return false;
 const at=Math.min(index+3,d.questions.length);
 d.questions.splice(at,0,{...q,repeat:true,support:wrong});
 while(d.answers.length<at)d.answers.push(null);
 while(d.results.length<at)d.results.push(null);
 d.answers.splice(at,0,null);d.results.splice(at,0,null);return true;
}
export function validateModule(m,pages){
 if(!m||typeof m.title!=='string'||!Array.isArray(m.chapters)||!m.chapters.length||!Array.isArray(m.questions)||!m.questions.length)throw Error('Onvolledige analyse. Er is niets vrijgegeven.');
 const cite=c=>{if(!c||!Number.isInteger(c.page)||!pages.some(p=>p.id===c.source&&p.page===c.page))throw Error('Een bronverwijzing bestaat niet. Controleer de analyse.');const p=pages.find(p=>p.id===c.source&&p.page===c.page);if(p.text&&!p.text.includes(c.quote))throw Error('Een broncitaat is niet teruggevonden. Analyse geblokkeerd.');if(!c.quote?.trim())throw Error('Broncitaat ontbreekt.');};
 for(let c of m.chapters){if(typeof c.summary!=='string'||!Array.isArray(c.goals)||!Array.isArray(c.terms))throw Error('Onvolledig hoofdstuk');cite(c.cite);}
 for(let q of m.questions){if(!['numeric','open'].includes(q.kind)||!Number.isInteger(q.points)||q.points<1||q.points>10||![1,2,3].includes(q.level)||!['prompt','answer','explanation','hint','goal','rubric'].every(k=>typeof q[k]==='string'&&q[k].length))throw Error('Ongeldig vragenmodel');cite(q.cite);q.id=q.id||uid();}
 return m;
}
const isId=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v),text=v=>typeof v==='string',list=v=>Array.isArray(v),image=v=>!v||(text(v)&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v)),optText=v=>v===undefined||v===null||text(v),optTime=v=>v===undefined||v===null||Number.isFinite(v);
export {isId};
// Shared by backup restore (browser) and the server, so both accept exactly the same records.
export const validQuestion=q=>!!q&&isId(q.id)&&text(q.prompt)&&text(q.answer)&&text(q.goal)&&text(q.hint)&&text(q.rubric)&&text(q.explanation)&&['numeric','open'].includes(q.kind)&&Number.isInteger(q.points)&&q.points>0&&q.points<=10&&[1,2,3].includes(q.level)&&isId(q.cite?.source)&&Number.isInteger(q.cite.page)&&text(q.cite.quote);
export const validProfile=p=>!!p&&isId(p.id)&&text(p.name)&&text(p.level)&&(p.subjects===undefined||list(p.subjects)&&p.subjects.every(text));
export const validModule=m=>!!m&&isId(m.id)&&text(m.title)&&text(m.subject)&&text(m.level)&&list(m.questions)&&m.questions.length>0&&m.questions.every(validQuestion)&&list(m.chapters)&&!m.chapters.some(c=>!text(c.title)||!text(c.summary)||!list(c.goals)||!c.goals.every(text)||!list(c.terms)||c.terms.some(t=>!text(t.term)||!text(t.definition))||!isId(c.cite?.source)||!Number.isInteger(c.cite.page)||!text(c.cite.quote))&&list(m.warnings)&&m.warnings.every(text)&&['schoolYear','period','chapter','method'].every(k=>optText(m[k]))&&optTime(m.deletedAt);
export const validPages=pages=>list(pages)&&!pages.some(p=>!isId(p.id)||!Number.isInteger(p.page)||p.page<1||!text(p.text)||!image(p.image));
export const validDocumentMeta=d=>!!d&&isId(d.id)&&text(d.name)&&text(d.type)&&list(d.warnings)&&d.warnings.every(text)&&['subject','schoolYear','period','chapter','method'].every(k=>optText(d[k]))&&optTime(d.deletedAt);
export const validDocument=d=>validDocumentMeta(d)&&text(d.data)&&validPages(d.pages);
export const validSession=a=>!!a&&isId(a.profile)&&isId(a.module)&&text(a.title)&&['practice','test'].includes(a.mode)&&list(a.questions)&&a.questions.length>0&&a.questions.every(validQuestion)&&list(a.answers)&&a.answers.every(x=>x===null||!!x&&text(x.answer)&&text(x.steps));
export const validAttempt=a=>isId(a?.id)&&validSession(a)&&list(a.results)&&a.results.length===a.questions.length&&!a.results.some((r,i)=>!r||!Number.isFinite(r.points)||r.points<0||r.points>a.questions[i].points||typeof r.pending!=='boolean'||!text(r.feedback)||!text(r.confidence)||!text(r.category))&&!!a.review&&typeof a.review==='object';
export function validateState(s){
 const fail=()=>{throw Error('Onbekende of beschadigde back-up. Bestaande gegevens zijn behouden.');};
 if(s?.version!==1||!list(s.profiles)||!s.profiles.length||!list(s.modules)||!list(s.attempts)||!list(s.documents))fail();
 if(!s.profiles.every(validProfile)||!s.documents.every(validDocument)||!s.modules.every(validModule)||!s.attempts.every(validAttempt))fail();
 if(s.draft&&!validSession(s.draft))fail();return s;
}
export function demoModule(){
 const cite={source:'voorbeeld',page:1,quote:'Een vierkantswortel is de niet-negatieve waarde die in het kwadraat het getal onder het wortelteken oplevert.'};
 const rows=[['Bereken √81.','9',1,'Wortels berekenen','9 × 9 = 81, dus √81 = 9.'],['Bereken √144.','12',1,'Wortels berekenen','12 × 12 = 144.'],['Bereken √49 + √64.','15',1,'Rekenvolgorde','Eerst de wortels: 7 + 8 = 15.'],['Bereken 3 × √25 − 2.','13',2,'Rekenvolgorde','√25 = 5. Daarna 3 × 5 − 2 = 13.'],['Bereken √(36 + 64).','10',2,'Haakjes','Eerst 36 + 64 = 100. √100 = 10.'],['Bereken (√7)².','7',2,'Wortels en kwadraten','Kwadrateren heft de vierkantswortel op: 7.'],['Bereken √50 / √2.','5',3,'Wortelregels','√50 / √2 = √25 = 5.'],['Bereken (2 × √3)².','12',3,'Wortels en kwadraten','(2 × √3)² = 4 × 3 = 12.']];
 const questions=rows.map(([prompt,answer,level,goal,explanation],i)=>({id:'demo-'+i,prompt,answer,level,goal,explanation,kind:'numeric',points:2,hint:'Bepaal eerst wat er onder het wortelteken staat. Reken daarna verder.',rubric:'2 punten voor een gelijkwaardige juiste einduitkomst. Bij een fout eindantwoord: ouder kan 1 punt geven voor een juiste tussenstap.',cite}));
 questions.push({id:'demo-8',prompt:'Leg uit waarom √(9 + 16) niet gelijk is aan √9 + √16.',answer:'√25 = 5, maar 3 + 4 = 7. Een wortel mag niet over een som worden verdeeld.',level:3,goal:'Wortelregels',explanation:'De wortel van een som is niet de som van de wortels: 5 ≠ 7.',kind:'open',points:3,hint:'Reken beide kanten apart uit.',rubric:'1 punt voor √25 = 5; 1 punt voor 3 + 4 = 7; 1 punt voor de conclusie dat verdelen over een som niet mag.',cite});
 return {id:'demo',title:'Wortels zonder twijfel',subject:'Wiskunde',level:'2 havo/vwo',approved:true,demo:true,chapters:[{title:'1 · Wortels & rekenvolgorde',summary:'Een vierkantswortel is de niet-negatieve waarde die in het kwadraat het getal onder het wortelteken oplevert. Zo is √81 = 9. Werk eerst haakjes uit, daarna wortels en machten, dan vermenigvuldigen en delen, en tot slot optellen en aftrekken. Let op: √(a + b) is meestal niet √a + √b.',goals:['Vierkantswortels berekenen','Rekenvolgorde toepassen','Fouten met wortelregels herkennen'],terms:[{term:'Vierkantswortel',definition:'De niet-negatieve waarde waarvan het kwadraat het gegeven getal is.'},{term:'Kwadraat',definition:'Een getal vermenigvuldigd met zichzelf.'}],cite}],questions,warnings:[]};
}
export function initialState(){return {version:1,profiles:[{id:'leerling-1',name:'Leerling 1',level:'2 havo/vwo'}],documents:[],modules:[demoModule()],attempts:[],draft:null};}
