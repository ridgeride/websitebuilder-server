import {demoModule} from '../src/core.js';
import {makePDF} from '../src/pdf.js';
import fs from 'node:fs/promises';
const m=demoModule();
for(const answers of [false,true])await fs.writeFile('../'+(answers?'voorbeeld-antwoorden.pdf':'voorbeeld-opgaven.pdf'),Buffer.from(makePDF(m,m.questions,answers).output('arraybuffer')));
console.log('Voorbeeld-PDFs gegenereerd met dezelfde functie als in de app.');
