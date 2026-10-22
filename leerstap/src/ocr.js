// Reads text from photos on the device itself (Tesseract, LSTM models served from our own site), so reading pages costs nothing.
import {createWorker} from 'tesseract.js';
const LANGS={Frans:'fra',Engels:'eng',Duits:'deu',Spaans:'spa'};
export async function readPhotos(images,subject,progress=()=>{}){
 const langs=['nld',LANGS[subject]].filter(Boolean).join('+');
 const worker=await createWorker(langs,1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr/core',langPath:'/ocr/lang',workerBlobURL:false,logger:m=>{if(m.status==='recognizing text')progress(m.progress);}});
 try{const out=[];for(const [i,img] of images.entries()){progress(0,i+1,images.length);const {data}=await worker.recognize(img);out.push({text:data.text.replace(/\n{3,}/g,'\n\n').trim(),confidence:Math.round(data.confidence)});}return out;}
 finally{await worker.terminate();}
}
