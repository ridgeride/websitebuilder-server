// Local stand-ins for Cloudflare D1 (database) and R2 (files), so the same server code runs on a home computer and in tests.
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
const migrationsDir=new URL('../migrations/',import.meta.url);
const clean=args=>args.map(v=>v===undefined?null:typeof v==='boolean'?Number(v):v);
class Statement{
 constructor(db,sql,args=[]){this.db=db;this.sql=sql;this.args=args;}
 bind(...args){return new Statement(this.db,this.sql,clean(args));}
 runSync(){const r=this.db.prepare(this.sql).run(...this.args);return {success:true,meta:{changes:Number(r.changes)}};}
 async first(){const r=this.db.prepare(this.sql).get(...this.args);return r?{...r}:null;}
 async all(){return {success:true,results:this.db.prepare(this.sql).all(...this.args).map(r=>({...r}))};}
 async run(){return this.runSync();}
}
export function localDatabase(file=':memory:'){
 if(file!==':memory:')fs.mkdirSync(path.dirname(file),{recursive:true});
 const db=new DatabaseSync(file);db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS _local_migrations(name TEXT PRIMARY KEY, at INTEGER)');
 for(const name of fs.readdirSync(migrationsDir).filter(f=>f.endsWith('.sql')).sort()){
  if(db.prepare('SELECT 1 FROM _local_migrations WHERE name=?').get(name))continue;
  db.exec('BEGIN');try{db.exec(fs.readFileSync(new URL(name,migrationsDir),'utf8'));db.prepare('INSERT INTO _local_migrations VALUES(?,?)').run(name,Date.now());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 }
 return {
  prepare:sql=>new Statement(db,sql),
  async batch(statements){db.exec('BEGIN');try{const out=statements.map(s=>s.runSync());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}},
  close:()=>db.close()
 };
}
export function localFiles(dir){
 fs.mkdirSync(dir,{recursive:true});const file=key=>path.join(dir,encodeURIComponent(key));
 const object=buffer=>({body:new Blob([buffer]).stream(),text:async()=>buffer.toString('utf8'),json:async()=>JSON.parse(buffer.toString('utf8')),arrayBuffer:async()=>buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength)});
 return {
  async put(key,value){const tmp=file(key)+'.tmp';fs.writeFileSync(tmp,typeof value==='string'?value:Buffer.from(value));fs.renameSync(tmp,file(key));},
  async get(key){try{return object(fs.readFileSync(file(key)));}catch(e){if(e.code==='ENOENT')return null;throw e;}},
  async delete(keys){for(const k of [keys].flat())fs.rmSync(file(k),{force:true});},
  async list({prefix=''}={}){return {objects:fs.readdirSync(dir).filter(f=>!f.endsWith('.tmp')).map(decodeURIComponent).filter(k=>k.startsWith(prefix)).map(key=>({key})),truncated:false};}
 };
}
export function localEnv({dataDir,...vars}={}){
 const db=dataDir?path.join(dataDir,'leerstap.db'):':memory:';
 return {DB:localDatabase(db),FILES:localFiles(dataDir?path.join(dataDir,'bestanden'):fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR||'/tmp'),'leerstap-'))),...vars};
}
