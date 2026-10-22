// Talks to the server and works out what changed since the last save, so only those records are sent.
export async function call(method,path,body){
 let res;try{res=await fetch(path,{method,credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});}
 catch{throw Object.assign(Error('Geen verbinding met Leerstap. Controleer je internet; we bewaren je wijziging zodra het weer lukt.'),{status:0});}
 let data={};try{data=await res.json();}catch{}
 if(!res.ok)throw Object.assign(Error(data.error||'Er ging iets mis. Probeer het opnieuw.'),{status:res.status});
 return data;
}
// One entry per server record, as JSON text. Documents travel without their pages and original file; those are uploaded once.
export function records(state,drafts,profile){
 const out=new Map(),put=(key,value)=>out.set(key,JSON.stringify(value));
 for(const m of state.modules)put('module:'+m.id,m);
 for(const {pages,data,...meta} of state.documents)put('document:'+meta.id,meta);
 for(const a of state.attempts)put('attempt:'+a.id,a);
 for(const [id,draft] of Object.entries({...drafts,[profile]:state.draft}))if(draft)put('draft:'+id,draft);
 for(const {id,name,schoolType,year,subjects} of state.profiles)put('profile:'+id,{name,schoolType,year,subjects});
 return out;
}
// Profiles are removed through their own endpoint, never by leaving them out of a save.
export function diff(previous,current){
 const put=[...current.keys()].filter(k=>previous.get(k)!==current.get(k)),del=[...previous.keys()].filter(k=>!current.has(k)&&!k.startsWith('profile:'));
 return {put,del};
}
export const splitKey=key=>{const i=key.indexOf(':');return [key.slice(0,i),key.slice(i+1)];};
