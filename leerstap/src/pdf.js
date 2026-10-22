import {jsPDF} from 'jspdf';
import font from './pdf-font.js';
const printable=s=>String(s).replace(/sqrt\(([^)]*)\)/g,'√($1)').replace(/[\u0000-\u0008]/g,'');
export function makePDF(module,questions,answers=false,code=''){
 const doc=new jsPDF(),max=questions.reduce((s,q)=>s+q.points,0);let y=20;doc.addFileToVFS('Leerstap.ttf',font);doc.addFont('Leerstap.ttf','Leerstap','normal');doc.setFont('Leerstap');
 const header=()=>{doc.setFontSize(10);doc.setTextColor(60,100,88);doc.text('LEERSTAP  /  '+(answers?'ANTWOORDEN & PUNTENMODEL':'PROEFWERK')+(code?'  /  CODE '+code:''),18,14);doc.setTextColor(30,40,40);};header();
 const line=(s,size=11)=>{doc.setFontSize(size);const rows=doc.splitTextToSize(printable(s),174);for(let row of rows){if(y>276){doc.addPage();header();y=24;}doc.text(row,18,y);y+=size*.48;}y+=3;};
 y=26;line(module.title,20);line(`${module.subject} | ${module.level} | ${max} punten`);line('Noteer je berekening duidelijk en controleer de rekenvolgorde.');
 if(!answers){line('Naam: _______________________    Datum: ______________');line('Schrijf je tussenstappen op. Cijfer = 1 + 9 x behaalde punten / totaal.');if(code)line(`Klaar? Maak in Leerstap bij Proefwerk een foto van elke bladzijde (code ${code}). Zet de vraagnummers duidelijk bij je antwoorden.`,10);}
 questions.forEach((q,i)=>{if(y>220){doc.addPage();header();y=24;}line(`${i+1}. ${q.prompt} (${q.points} punten)`,12);if(answers){line('Antwoord: '+q.answer);line('Uitwerking: '+q.explanation);line('Punten: '+q.rubric);line(`Bron: ${module.sourceNames?.[q.cite.source]|| (q.cite.source==='voorbeeld'?'Voorbeeldles':q.cite.source)}, pagina/tekstdeel ${q.cite.page}` ,9);}else{for(let j=0;j<4;j++){doc.setDrawColor(215);doc.line(18,y,192,y);y+=9;}y+=5;}});
 const n=doc.getNumberOfPages();for(let p=1;p<=n;p++){doc.setPage(p);doc.setFontSize(9);doc.text(`Leerstap | ${answers?'Antwoorden apart bewaren':'Opgaven'}${code?' | code '+code:''} | ${p} / ${n}`,18,289);}
 return doc;
}
