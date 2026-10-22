// Reads text from photos on the device itself (Tesseract, LSTM models served from our own site), so reading pages costs nothing.
import {createWorker} from 'tesseract.js';
const LANGS={Frans:'fra',Engels:'eng',Duits:'deu',Spaans:'spa'};
// Phone photos keep their rotation in a tag; drawing them once makes the pixels upright. Optionally turned a quarter.
// The site's security rules forbid fetch() on data: URLs, so the image is decoded directly.
export function dataUrlBlob(url){const [head,b64]=url.split(','),bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));return new Blob([bytes],{type:head.match(/^data:([^;]+)/)?.[1]||'image/jpeg'});}
async function upright(src,turn=0,max=2400){const blob=dataUrlBlob(src),img=await createImageBitmap(blob,{imageOrientation:'from-image'}),scale=Math.min(1,max/Math.max(img.width,img.height)),w=Math.round(img.width*scale),h=Math.round(img.height*scale),c=document.createElement('canvas'),side=turn%180!==0;
 c.width=side?h:w;c.height=side?w:h;const g=c.getContext('2d');g.translate(c.width/2,c.height/2);g.rotate(turn*Math.PI/180);g.drawImage(img,-w/2,-h/2,w,h);return c;}
// Edges, shadows and the table behind the book come out as rows of symbols; those lines and trailing marks are dropped.
export function tidy(text){return text.split('\n').map(l=>l.replace(/(\s+[=_—–~|®©:;.,'"`]+[A-Za-z]?)+\s*$/,'').replace(/\s+[A-Z]?[=_—–]{2,}$/,'').trimEnd()).filter(l=>!l.trim()||/[A-Za-zÀ-ÿ]{3,}/.test(l)||/\d/.test(l)&&/[=+×x·*/√²%]/.test(l)).join('\n').replace(/\n{3,}/g,'\n\n').trim();}
export async function readPhotos(images,subject,progress=()=>{}){
 const langs=['nld',LANGS[subject]].filter(Boolean).join('+');
 const worker=await createWorker(langs,1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr/core',langPath:'/ocr/lang',workerBlobURL:false});
 try{const out=[];for(const [i,img] of images.entries()){progress(i+1,images.length);
   let best=null;for(const turn of [0,90,270,180]){const {data}=await worker.recognize(await upright(img,turn));const r={text:tidy(data.text),confidence:Math.round(data.confidence),turn};if(!best||r.confidence>best.confidence)best=r;if(best.confidence>=70)break;}
   out.push(best);}
  return out;}
 finally{await worker.terminate();}
}
