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
 if(q.kind==='word')return gradeWord(q,answer);
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
 for(let q of m.questions){if(!['numeric','open'].includes(q.kind)||!Number.isInteger(q.points)||q.points<1||q.points>10||![1,2,3].includes(q.level)||!['prompt','answer','explanation','hint','goal','rubric'].every(k=>typeof q[k]==='string'&&q[k].length))throw Error('Ongeldig vragenmodel');cite(q.cite);q.id=q.id||uid();if(!Number.isInteger(q.chapter)||q.chapter<0||q.chapter>=m.chapters.length)delete q.chapter;}
 return m;
}
const isId=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v),text=v=>typeof v==='string',list=v=>Array.isArray(v),image=v=>!v||(text(v)&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v)),optText=v=>v===undefined||v===null||text(v),optTime=v=>v===undefined||v===null||Number.isFinite(v);
export {isId};
// Shared by backup restore (browser) and the server, so both accept exactly the same records.
export const validQuestion=q=>!!q&&isId(q.id)&&text(q.prompt)&&text(q.answer)&&text(q.goal)&&text(q.hint)&&text(q.rubric)&&text(q.explanation)&&['numeric','open','word'].includes(q.kind)&&Number.isInteger(q.points)&&q.points>0&&q.points<=10&&[1,2,3].includes(q.level)&&(q.chapter===undefined||Number.isInteger(q.chapter)&&q.chapter>=0&&q.chapter<100)&&isId(q.cite?.source)&&Number.isInteger(q.cite.page)&&text(q.cite.quote);
export const validProfile=p=>!!p&&isId(p.id)&&text(p.name)&&text(p.level)&&(p.subjects===undefined||list(p.subjects)&&p.subjects.every(text));
export const validModule=m=>!!m&&isId(m.id)&&text(m.title)&&text(m.subject)&&text(m.level)&&list(m.questions)&&m.questions.length>0&&m.questions.every(validQuestion)&&list(m.chapters)&&!m.chapters.some(c=>!text(c.title)||!text(c.summary)||!optText(c.method)||!list(c.goals)||!c.goals.every(text)||!list(c.terms)||c.terms.some(t=>!text(t.term)||!text(t.definition))||!isId(c.cite?.source)||!Number.isInteger(c.cite.page)||!text(c.cite.quote))&&list(m.warnings)&&m.warnings.every(text)&&['schoolYear','period','chapter','method'].every(k=>optText(m[k]))&&optTime(m.deletedAt);
export const validPages=pages=>list(pages)&&!pages.some(p=>!isId(p.id)||!Number.isInteger(p.page)||p.page<1||!text(p.text)||!image(p.image));
export const validDocumentMeta=d=>!!d&&isId(d.id)&&text(d.name)&&text(d.type)&&list(d.warnings)&&d.warnings.every(text)&&['subject','schoolYear','period','chapter','method'].every(k=>optText(d[k]))&&optTime(d.deletedAt);
export const validDocument=d=>validDocumentMeta(d)&&text(d.data)&&validPages(d.pages);
export const validSession=a=>!!a&&isId(a.profile)&&isId(a.module)&&text(a.title)&&['practice','test','drill'].includes(a.mode)&&list(a.questions)&&a.questions.length>0&&a.questions.every(validQuestion)&&list(a.answers)&&a.answers.every(x=>x===null||!!x&&text(x.answer)&&text(x.steps))&&(a.pool===undefined||list(a.pool)&&a.pool.length<=1000&&a.pool.every(validQuestion));
export const validAttempt=a=>isId(a?.id)&&validSession(a)&&list(a.results)&&a.results.length===a.questions.length&&!a.results.some((r,i)=>!r||!Number.isFinite(r.points)||r.points<0||r.points>a.questions[i].points||typeof r.pending!=='boolean'||!text(r.feedback)||!text(r.confidence)||!text(r.category))&&!!a.review&&typeof a.review==='object';
const shortText=(v,max=200)=>text(v)&&v.length<=max,isDay=v=>text(v)&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v));
// Word lists belong to the whole family; a plan belongs to one child.
export const validWordlist=w=>!!w&&isId(w.id)&&shortText(w.title,150)&&shortText(w.subject||'',80)&&shortText(w.langA,40)&&shortText(w.langB,40)&&shortText(w.speech||'',20)&&list(w.pairs)&&w.pairs.length>0&&w.pairs.length<=500&&w.pairs.every(p=>isId(p.id)&&shortText(p.a)&&shortText(p.b)&&p.a.trim()&&p.b.trim())&&(w.documents===undefined||list(w.documents)&&w.documents.length<=5&&w.documents.every(isId))&&optTime(w.deletedAt);
export const validPlan=p=>!!p&&isId(p.id)&&isId(p.profile)&&shortText(p.title,150)&&isDay(p.date)&&isDay(p.start)&&p.start<=p.date&&list(p.items)&&p.items.length>0&&p.items.length<=10&&p.items.every(i=>['module','wordlist'].includes(i.type)&&isId(i.id))&&Number.isInteger(p.minutes)&&p.minutes>=5&&p.minutes<=120&&!!p.checked&&typeof p.checked==='object'&&Object.entries(p.checked).every(([d,v])=>isDay(d)&&v===true)&&optTime(p.deletedAt);
export function validateState(s){
 const fail=()=>{throw Error('Onbekende of beschadigde back-up. Bestaande gegevens zijn behouden.');};
 if(s?.version!==1||!list(s.profiles)||!s.profiles.length||!list(s.modules)||!list(s.attempts)||!list(s.documents))fail();
 if(!s.profiles.every(validProfile)||!s.documents.every(validDocument)||!s.modules.every(validModule)||!s.attempts.every(validAttempt))fail();
 if(s.wordlists!==undefined&&(!list(s.wordlists)||!s.wordlists.every(validWordlist)))fail();
 if(s.draft&&!validSession(s.draft))fail();return s;
}
export function demoModule(){
 const cite={source:'voorbeeld',page:1,quote:'Een vierkantswortel is de niet-negatieve waarde die in het kwadraat het getal onder het wortelteken oplevert.'};
 const rows=[['Bereken √81.','9',1,'Wortels berekenen','9 × 9 = 81, dus √81 = 9.'],['Bereken √144.','12',1,'Wortels berekenen','12 × 12 = 144.'],['Bereken √49 + √64.','15',1,'Rekenvolgorde','Eerst de wortels: 7 + 8 = 15.'],['Bereken 3 × √25 − 2.','13',2,'Rekenvolgorde','√25 = 5. Daarna 3 × 5 − 2 = 13.'],['Bereken √(36 + 64).','10',2,'Haakjes','Eerst 36 + 64 = 100. √100 = 10.'],['Bereken (√7)².','7',2,'Wortels en kwadraten','Kwadrateren heft de vierkantswortel op: 7.'],['Bereken √50 / √2.','5',3,'Wortelregels','√50 / √2 = √25 = 5.'],['Bereken (2 × √3)².','12',3,'Wortels en kwadraten','(2 × √3)² = 4 × 3 = 12.']];
 const questions=rows.map(([prompt,answer,level,goal,explanation],i)=>({id:'demo-'+i,prompt,answer,level,goal,explanation,kind:'numeric',points:2,hint:'Bepaal eerst wat er onder het wortelteken staat. Reken daarna verder.',rubric:'2 punten voor een gelijkwaardige juiste einduitkomst. Bij een fout eindantwoord: ouder kan 1 punt geven voor een juiste tussenstap.',cite}));
 questions.push({id:'demo-8',prompt:'Leg uit waarom √(9 + 16) niet gelijk is aan √9 + √16.',answer:'√25 = 5, maar 3 + 4 = 7. Een wortel mag niet over een som worden verdeeld.',level:3,goal:'Wortelregels',explanation:'De wortel van een som is niet de som van de wortels: 5 ≠ 7.',kind:'open',points:3,hint:'Reken beide kanten apart uit.',rubric:'1 punt voor √25 = 5; 1 punt voor 3 + 4 = 7; 1 punt voor de conclusie dat verdelen over een som niet mag.',cite});
 return {id:'demo',title:'Wortels zonder twijfel',subject:'Wiskunde',level:'2 havo/vwo',approved:true,demo:true,chapters:[{title:'1 · Wortels & rekenvolgorde',summary:'Een vierkantswortel is de niet-negatieve waarde die in het kwadraat het getal onder het wortelteken oplevert. Zo is √81 = 9. Werk eerst haakjes uit, daarna wortels en machten, dan vermenigvuldigen en delen, en tot slot optellen en aftrekken. Let op: √(a + b) is meestal niet √a + √b.',goals:['Vierkantswortels berekenen','Rekenvolgorde toepassen','Fouten met wortelregels herkennen'],terms:[{term:'Vierkantswortel',definition:'De niet-negatieve waarde waarvan het kwadraat het gegeven getal is.'},{term:'Kwadraat',definition:'Een getal vermenigvuldigd met zichzelf.'}],cite}],questions,warnings:[]};
}
export function initialState(){return {version:1,profiles:[{id:'leerling-1',name:'Leerling 1',level:'2 havo/vwo'}],documents:[],modules:[demoModule()],attempts:[],wordlists:[],plans:[],draft:null};}

// --- Woordjes: compare like a teacher would, and say why an answer is almost right.
const ARTICLES=/^(de|het|een|the|a|an|to|le|la|les|l'|un|une|des|der|die|das|den|dem|ein|eine|einen|el|los|las|il|lo|gli)\s+/;
const plain=s=>String(s).toLowerCase().replace(/[’`]/g,"'").replace(/\s+/g,' ').replace(/^[\s.,!?;:]+|[\s.,!?;:]+$/g,'').trim();
const noAccents=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ß/g,'ss');
const withoutBrackets=s=>plain(s.replace(/\([^)]*\)/g,' '));
function distance(a,b){if(Math.abs(a.length-b.length)>2)return 3;let prev=[...Array(b.length+1).keys()];for(let i=1;i<=a.length;i++){const cur=[i];for(let j=1;j<=b.length;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur;}return prev[b.length];}
// Alternatives are separated by / or ; in the list. Text in brackets may be left out.
export const wordAlternatives=answer=>String(answer).split(/[\/;]/).map(s=>s.trim()).filter(Boolean);
export function gradeWord(q,answer){
 const given=plain(answer),options=wordAlternatives(q.answer),right={points:q.points,pending:false,confidence:'hoog',category:'Goed',feedback:`${q.prompt} = ${q.answer}`};
 if(!given)return {points:0,pending:false,confidence:'hoog',feedback:`Het antwoord is: ${q.answer}`,category:'Niet ingevuld'};
 for(const o of options){if(given===plain(o)||given===withoutBrackets(o)||given===plain(o.replace(/[()]/g,'')))return right;}
 const near=(fb,category)=>({points:0,pending:false,confidence:'hoog',category,feedback:`${fb} Het goede antwoord is: ${q.answer}`});
 for(const o of options){const full=plain(o),bare=withoutBrackets(o);
  if(noAccents(given)===noAccents(full)||noAccents(given)===noAccents(bare))return near('Bijna! Let op de accenten.','Accent');
  if(given===full.replace(ARTICLES,'')||given===bare.replace(ARTICLES,''))return near('Bijna! Het lidwoord hoort erbij.','Lidwoord');
  if(given.replace(ARTICLES,'')===full.replace(ARTICLES,'')&&given!==full)return near('Bijna! Kijk nog eens naar het lidwoord.','Lidwoord');
 }
 for(const o of options){const full=noAccents(withoutBrackets(o));if(full.length>=4&&distance(noAccents(given),full)===1)return near('Bijna: een kleine spelfout.','Spelling');}
 return {points:0,pending:false,confidence:'hoog',category:'Fout',feedback:`Het goede antwoord is: ${q.answer}`};
}
// Turns a word list into questions. Direction 'ab' asks the first column, 'ba' the second.
export function wordQuestions(list,direction='ab'){
 const dirs=direction==='both'?['ab','ba']:[direction];
 return dirs.flatMap(d=>list.pairs.map(p=>{const prompt=d==='ab'?p.a:p.b,answer=d==='ab'?p.b:p.a,first=wordAlternatives(answer)[0]||answer;
  return {id:`${p.id}-${d}`,kind:'word',prompt,answer,dir:d,level:1,points:1,goal:list.title,hint:`Begint met „${first.replace(ARTICLES,'').charAt(0)}” · ${first.length} tekens`,explanation:`${p.a} = ${p.b}`,rubric:'1 punt voor de juiste vertaling, met lidwoord en accenten.',cite:{source:list.id,page:1,quote:p.a}};}));
}
// Reads "huis = maison", "huis - maison" or "huis<TAB>maison", one pair per line.
export function parsePairs(textValue){
 return String(textValue).split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>{const m=l.split(/\s*(?:=|\t|\s[-–—]\s|:)\s*/);return m.length>=2?{a:m[0].trim(),b:m.slice(1).join(' / ').trim()}:null;}).filter(p=>p&&p.a&&p.b).slice(0,500);
}

// --- Beheersing: a question is mastered when the latest independent answer to it was fully right.
export function masteredIds(attempts,profile){
 const last=new Map();
 for(const a of attempts.filter(a=>a.profile===profile).sort((x,y)=>x.created-y.created))a.questions.forEach((q,i)=>{const r=a.results[i];if(r&&!r.pending&&!q.support)last.set(q.id,r.points===q.points);});
 return new Set([...last].filter(([,ok])=>ok).map(([id])=>id));
}
export function readiness(questions,attempts,profile){const done=masteredIds(attempts,profile),n=questions.length;const ok=questions.filter(q=>done.has(q.id)).length;return {done:ok,total:n,pct:n?Math.round(ok/n*100):0};}

// --- Drill: every question until all are mastered. Right first time: done. After a mistake: two in a row.
export function startDrill(pool,random=Math.random){
 const state=Object.fromEntries(pool.map(q=>[q.id,{streak:0,wrong:0,asked:0}]));
 return {state,next:pickDrill(pool,state,[],random)};
}
export const drillNeeded=s=>s.wrong?2:1;
export const drillDone=(pool,state)=>pool.every(q=>state[q.id].streak>=drillNeeded(state[q.id]));
export function recordDrill(state,q,correct){const s=state[q.id];s.asked++;if(correct)s.streak++;else{s.streak=0;s.wrong++;}return s.streak>=drillNeeded(s);}
// Picks what to ask next: never one of the last two (if there is a choice), unasked questions first, mistakes back soon.
export function pickDrill(pool,state,recent,random=Math.random){
 const open=pool.filter(q=>state[q.id].streak<drillNeeded(state[q.id]));if(!open.length)return null;
 const fresh=open.filter(q=>!recent.slice(-2).includes(q.id)),choice=fresh.length?fresh:open;
 const wrong=choice.filter(q=>state[q.id].wrong&&state[q.id].asked>0),unasked=choice.filter(q=>!state[q.id].asked);
 const from=wrong.length&&(random()<.5||!unasked.length)?wrong:unasked.length?unasked:choice;
 return from[Math.floor(random()*from.length)];
}

// --- Toetsplanner: a short task for every day until the test. Dates are local days as YYYY-MM-DD.
export const dayKey=(t=Date.now())=>{const d=new Date(t);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const addDays=(day,n)=>{const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return dayKey(d);};
export const daysBetween=(a,b)=>Math.round((Date.parse(b+'T12:00:00')-Date.parse(a+'T12:00:00'))/86400000);
export function planDays(plan){
 const total=daysBetween(plan.start,plan.date),days=[];if(total<=0)return days;
 const items=plan.items;
 for(let i=0;i<total;i++){
  const day=addDays(plan.start,i),left=total-i,item=items[i%items.length];
  let task;
  if(i===0)task={kind:'start',item,text:item.type==='module'?'Lees de samenvatting en begrippen, en doe daarna een korte drill.':'Lees de woordjes één keer door en overhoor ze daarna.'};
  else if(left===1&&total>=3)task={kind:'repeat',item,text:'Laatste herhaling: alleen wat je nog niet beheerst. Daarna rust.'};
  else if(left===2&&total>=4)task={kind:'test',item:items.find(x=>x.type==='module')||item,text:items.some(x=>x.type==='module')?'Maak een proefwerk zonder hints. Zo zie je wat er nog niet zit.':'Overhoor alle woordjes in beide richtingen.'};
  else task={kind:'drill',item,text:item.type==='module'?'Drill tot je alles beheerst wat je al gehad hebt.':'Overhoor de woordjes tot je ze allemaal kent.'};
  days.push({day,left,...task,done:!!plan.checked[day]});
 }
 return days;
}

// --- Rustige motivatie: what happened this week, without points or streaks.
export function weekSummary(attempts,profile,now=Date.now()){
 const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));const start=d.getTime();
 const week=attempts.filter(a=>a.profile===profile&&a.created>=start),days=new Set(week.map(a=>(new Date(a.created).getDay()+6)%7));
 return {days:[0,1,2,3,4,5,6].map(i=>days.has(i)),questions:week.reduce((s,a)=>s+a.results.filter(Boolean).length,0),mastered:masteredIds(attempts,profile).size};
}

// --- Toets op maat. Which paragraph a question belongs to: the AI says so; for older material we infer it.
export function questionChapter(m,q){
 if(Number.isInteger(q.chapter)&&q.chapter<m.chapters.length)return q.chapter;
 const byGoal=m.chapters.findIndex(c=>c.goals.includes(q.goal));if(byGoal>=0)return byGoal;
 const byPage=m.chapters.findIndex(c=>c.cite.source===q.cite.source&&c.cite.page===q.cite.page);return byPage>=0?byPage:0;
}
export const questionsIn=(m,chapters)=>m.questions.filter(q=>!chapters||chapters.includes(questionChapter(m,q)));
// A realistic test: every chosen paragraph, roughly 30% basis, 45% toepassen and 25% inzicht, easiest first, like on paper.
export function chooseTest(m,chapters,count,random=Math.random){
 const pool=questionsIn(m,chapters),n=Math.min(count||pool.length,pool.length),share={1:.3,2:.45,3:.25},picked=[];
 const shuffle=a=>a.map(q=>[random(),q]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);
 const byLevel=l=>shuffle(pool.filter(q=>q.level===l));
 const groups={1:byLevel(1),2:byLevel(2),3:byLevel(3)};
 for(const l of [1,2,3])picked.push(...groups[l].splice(0,Math.round(n*share[l])));
 // Fill up with what is left (some levels may have too few questions), spreading over paragraphs.
 const rest=shuffle([...groups[1],...groups[2],...groups[3]]);while(picked.length<n&&rest.length)picked.push(rest.shift());
 return picked.slice(0,n).sort((a,b)=>a.level-b.level||questionChapter(m,a)-questionChapter(m,b));
}
// After a test: per paragraph and learning goal how it went, and what to study and why.
export function testFeedback(m,attempt){
 const rows=m.chapters.map((c,i)=>({chapter:i,title:c.title,points:0,max:0,pending:0,goals:new Map(),mistakes:new Map()}));
 attempt.questions.forEach((q,i)=>{const r=attempt.results[i],row=rows[questionChapter(m,q)]||rows[0];if(!r)return;
  row.max+=q.points;row.points+=r.points;if(r.pending)row.pending++;
  const g=row.goals.get(q.goal)||{goal:q.goal,points:0,max:0};g.points+=r.points;g.max+=q.points;row.goals.set(q.goal,g);
  if(!r.pending&&r.points<q.points)row.mistakes.set(r.category,(row.mistakes.get(r.category)||0)+1);});
 return rows.filter(r=>r.max).map(r=>{const pct=Math.round(r.points/r.max*100),goals=[...r.goals.values()].map(g=>({...g,pct:Math.round(g.points/g.max*100)})),weak=goals.filter(g=>g.pct<70).map(g=>g.goal);
  const status=r.pending&&pct<80?'voorlopig':pct>=80?'goed':pct>=55?'bijna':'meer leren';
  const why=status==='goed'?'Je hebt bijna alles goed. Herhaal later nog eens om het vast te houden.':`${weak.length?`Vooral bij ${weak.join(', ')} ging het nog niet goed. `:''}${[...r.mistakes].map(([c,n])=>`${n}× ${c.toLowerCase()}`).join(', ')||'Een deel van de antwoorden wacht nog op beoordeling'}.`;
  return {chapter:r.chapter,title:r.title,points:r.points,max:r.max,pct,status,pending:r.pending,goals,weak,why};});
}

// --- Papieren proefwerk: printed with a code, photographed when done, graded against the same questions.
export const validPaper=p=>!!p&&isId(p.id)&&isId(p.profile)&&isId(p.module)&&shortText(p.title,150)&&/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(p.code||'')&&list(p.questions)&&p.questions.length>0&&p.questions.length<=60&&p.questions.every(validQuestion)&&Number.isFinite(p.created)&&optTime(p.gradedAt)&&(p.attempt===undefined||isId(p.attempt));
export function paperCode(random=Math.random){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<8;i++)s+=a[Math.floor(random()*a.length)];return s.slice(0,4)+'-'+s.slice(4);}

// Per kind of question (learning goal, for maths: the type of sum), across the whole attempt.
export function goalFeedback(attempt){
 const goals=new Map();attempt.questions.forEach((q,i)=>{const r=attempt.results[i];if(!r||r.pending)return;const g=goals.get(q.goal)||{goal:q.goal,points:0,max:0,count:0};g.points+=r.points;g.max+=q.points;g.count++;goals.set(q.goal,g);});
 return [...goals.values()].map(g=>({...g,pct:Math.round(g.points/g.max*100)})).sort((a,b)=>b.pct-a.pct);
}
// The questions of a module grouped as the AI recognised them: paragraph → learning goals.
export function topics(m){return m.chapters.map((c,i)=>({chapter:i,title:c.title,goals:[...new Set(m.questions.filter(q=>questionChapter(m,q)===i).map(q=>q.goal))]})).filter(t=>t.goals.length);}

// --- Advies: at most three concrete suggestions for today, each with the reason.
export function advise({modules,wordlists,plans,attempts},profile,now=Date.now()){
 const today=dayKey(now),out=[],mine=attempts.filter(a=>a.profile===profile),done=masteredIds(attempts,profile);
 const pct=qs=>qs.length?Math.round(qs.filter(q=>done.has(q.id)).length/qs.length*100):0;
 const itemQs=i=>i.type==='module'?modules.find(m=>m.id===i.id)?.questions||[]:(w=>w?wordQuestions(w,'both'):[])(wordlists.find(w=>w.id===i.id));
 for(const p of plans.filter(p=>p.profile===profile&&p.date>=today).sort((a,b)=>a.date<b.date?-1:1)){
  const left=daysBetween(today,p.date),ready=pct(p.items.flatMap(itemQs)),idx=planDays(p).findIndex(d=>d.day===today);
  if(left<=7&&ready<80)out.push({kind:'plan',text:`${p.title}: over ${left} dag${left===1?'':'en'}. Je bent nu ${ready}% klaar.`,why:left<=2?'De toets is bijna. Herhaal vooral wat nog niet zit.':'Elke dag een beetje werkt beter dan alles op het laatst.',action:idx>=0?{type:'plan',plan:p.id,index:idx}:null});
 }
 // The weakest learning goal in the latest test or drill of each module.
 const latest=new Map();for(const a of mine.filter(a=>modules.some(m=>m.id===a.module)).sort((x,y)=>x.created-y.created))latest.set(a.module,a);
 const weak=[...latest.values()].flatMap(a=>goalFeedback(a).filter(g=>g.pct<60&&g.max>0).map(g=>({...g,module:a.module,title:a.title}))).sort((a,b)=>a.pct-b.pct)[0];
 if(weak)out.push({kind:'goal',text:`Oefen „${weak.goal}” (${weak.title}).`,why:`Bij de laatste keer had je hier ${weak.points} van de ${weak.max} punten. Een drill op alleen dit onderwerp helpt het meest.`,action:{type:'goal',module:weak.module,goal:weak.goal}});
 const due=new Map();for(const a of mine)for(const [id,r] of Object.entries(a.review||{}))due.set(id,{r,module:a.module});
 const dueNow=[...due.values()].filter(x=>x.r.due<=now&&modules.some(m=>m.id===x.module));
 if(dueNow.length){const counts=new Map();dueNow.forEach(x=>counts.set(x.module,(counts.get(x.module)||0)+1));const [module,n]=[...counts].sort((a,b)=>b[1]-a[1])[0];out.push({kind:'repeat',text:`${n} vraag${n===1?'':'en'} uit „${modules.find(m=>m.id===module).title}” ${n===1?'is':'zijn'} klaar voor herhaling.`,why:'Herhalen net voordat je het vergeet, zorgt dat het blijft hangen.',action:{type:'open',module}});}
 const fresh=modules.find(m=>m.approved&&!m.deletedAt&&!m.demo&&!mine.some(a=>a.module===m.id));
 if(fresh)out.push({kind:'new',text:`Begin met „${fresh.title}”.`,why:'Lees eerst de samenvatting en de begrippen, en doe daarna een korte drill.',action:{type:'module',module:fresh.id}});
 const words=wordlists.filter(w=>!w.deletedAt).map(w=>({w,p:pct(wordQuestions(w,'both'))})).filter(x=>x.p<100).sort((a,b)=>a.p-b.p)[0];
 if(words&&out.length<3)out.push({kind:'words',text:`Overhoor „${words.w.title}”: je kent ${words.p}%.`,why:'Woordjes blijven het best hangen als je ze vaak kort herhaalt.',action:{type:'words',list:words.w.id}});
 if(!out.length)out.push({kind:'ok',text:'Alles ligt op koers.',why:'Je hebt geen open herhalingen of zwakke onderwerpen. Plan je volgende toets, of voeg nieuwe leerstof toe.',action:null});
 return out.slice(0,3);
}
