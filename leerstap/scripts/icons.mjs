// Renders the PNG app icons from public/icon.svg. Only needed when the icon changes; the PNGs are committed.
import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
const svg=await fs.readFile('public/icon.svg','utf8');
const maskable=svg.replace('rx="112"','rx="0"').replace('<path ','<path transform="translate(256 256) scale(.72) translate(-256 -256)" ');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium'});
for(const [name,size,source] of [['icon-192.png',192,svg],['icon-512.png',512,svg],['icon-maskable-512.png',512,maskable],['apple-touch-icon.png',180,maskable]]){
 const page=await browser.newPage({viewport:{width:size,height:size}});
 await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${source}`);
 await fs.writeFile('public/'+name,await page.screenshot({omitBackground:true}));await page.close();
}
await browser.close();console.log('Iconen gemaakt in public/.');
