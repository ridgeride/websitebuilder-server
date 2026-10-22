import * as pdfjs from 'pdfjs-dist';
import JSZip from 'jszip';
import {b64} from './vault.js';
import {uid} from './core.js';
pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.mjs';
export async function extract(file){
 if(file.size>10*1024*1024)throw Error(file.name+': maximaal 10 MB per bestand.');
 const id=uid(),buffer=await file.arrayBuffer(),data=b64(new Uint8Array(buffer)),ext=file.name.split('.').pop().toLowerCase();let pages=[],warnings=[];
 if(ext==='pdf'){
 const pdf=await pdfjs.getDocument({data:new Uint8Array(buffer),isEvalSupported:false,useSystemFonts:true}).promise;
 if(pdf.numPages>30)throw Error('Maximaal 30 pagina’s per bestand. Splits het hoofdstuk.');
 for(let page=1;page<=pdf.numPages;page++){let p=await pdf.getPage(page),text=(await p.getTextContent()).items.map(x=>x.str||'').join(' '),image;
 if(text.trim().length<60){let viewport=p.getViewport({scale:1.2}),canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;await p.render({canvasContext:canvas.getContext('2d'),viewport}).promise;image=canvas.toDataURL('image/jpeg',.8);warnings.push(`Pagina ${page}: weinig tekst. Controleer de scan en AI-uitlezing.`);}
 pages.push({id,page,text,image});}await pdf.destroy();
 }else if(ext==='docx'){const zip=await JSZip.loadAsync(buffer);const entry=zip.file('word/document.xml');if(!entry)throw Error('Dit is geen geldig DOCX-document.');if(entry._data?.uncompressedSize>2000000)throw Error('DOCX-tekst is te groot. Splits het document.');const xml=new DOMParser().parseFromString(await entry.async('string'),'application/xml');if(xml.querySelector('parsererror'))throw Error('DOCX-tekst is beschadigd.');const text=[...xml.getElementsByTagName('w:p')].map(p=>[...p.getElementsByTagName('w:t')].map(n=>n.textContent).join('')).join('\n');pages=[{id,page:1,text}];warnings.push('DOCX heeft geen vaste paginanummers: bronverwijzingen gebruiken tekstdeel 1. Afbeeldingen, formules als object en tekstvakken kunnen ontbreken; controleer de bronextractie.');}
 else if(['txt','md'].includes(ext)){pages=[{id,page:1,text:new TextDecoder().decode(buffer)}];}
 else if(['png','jpg','jpeg','webp'].includes(ext)){const type=ext==='jpg'?'jpeg':ext;pages=[{id,page:1,text:'',image:`data:image/${type};base64,${data}`}];warnings.push('Foto: controleer leesbaarheid, uitsnede en formules. AI-uitlezing vraagt altijd oudercontrole.');}
 else throw Error('Ondersteund: PDF, DOCX, TXT, MD, JPG, PNG en WEBP.');
 if(pages.some(p=>p.text.length>30000))throw Error('Tekstdeel te lang. Splits het document in delen van maximaal 30.000 tekens.');
 return {id,name:file.name,type:file.type||'application/octet-stream',data,pages,warnings,created:Date.now()};
}
