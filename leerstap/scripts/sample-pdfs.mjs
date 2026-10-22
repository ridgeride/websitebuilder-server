import {demoModule} from '../src/core.js';
import {makePDF} from '../src/pdf.js';
import fs from 'node:fs/promises';
const m=demoModule();
for(const answers of [false,true])await fs.writeFile(new URL('../../'+(answers?'voorbeeld-antwoorden.pdf':'voorbeeld-opgaven.pdf'),import.meta.url),Buffer.from(makePDF(m,m.questions,answers).output('arraybuffer')));
console.log('Voorbeeld-PDFs gegenereerd met dezelfde functie als in de app.');
