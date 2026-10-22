// Password hashing, sessions and throttling. Cloudflare Workers caps PBKDF2 at 100 000 iterations.
const enc=new TextEncoder();
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
export const ITERATIONS=100000,SESSION_DAYS=30;
async function pbkdf2(secret,salt,iterations){const key=await crypto.subtle.importKey('raw',enc.encode(secret),'PBKDF2',false,['deriveBits']);return crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations,hash:'SHA-256'},key,256);}
export async function hashSecret(secret){const salt=crypto.getRandomValues(new Uint8Array(16));return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(await pbkdf2(secret,salt,ITERATIONS))}`;}
function equal(a,b){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a[i]^b[i];return d===0;}
const DUMMY=`pbkdf2$${ITERATIONS}$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=`;
// Always runs a full derivation, also for unknown accounts, so response time does not reveal which logins exist.
export async function verifySecret(secret,stored){const [alg,it,salt,hash]=(stored||DUMMY).split('$');if(alg!=='pbkdf2')return false;const ok=equal(new Uint8Array(await pbkdf2(String(secret),unb64(salt),Number(it))),unb64(hash));return !!stored&&ok;}
export const sha256=async s=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
export function randomToken(bytes=32){return b64(crypto.getRandomValues(new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
// Recovery codes avoid ambiguous characters so parents can copy them from paper.
export function recoveryCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',r=crypto.getRandomValues(new Uint8Array(20));return [...r].map(x=>alphabet[x%alphabet.length]).join('').match(/.{5}/g).join('-');}
// Invite codes: short enough to type from a message, too many combinations to guess with signup throttling.
export function inviteCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',r=crypto.getRandomValues(new Uint8Array(8));return [...r].map(x=>alphabet[x%alphabet.length]).join('').match(/.{4}/g).join('-');}
export const COOKIE='ls_session';
export function sessionCookie(token,url,maxAge=SESSION_DAYS*86400){return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(url).protocol==='https:'?'; Secure':''}`;}
export function readCookie(request){const m=(request.headers.get('Cookie')||'').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([A-Za-z0-9_-]{20,100})`));return m?.[1]||null;}
export async function createSession(env,userId){const token=randomToken(),now=Date.now();await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires,created) VALUES(?,?,?,?)').bind(await sha256(token),userId,now+SESSION_DAYS*86400000,now).run();return token;}
export async function readSession(env,request){
 const token=readCookie(request);if(!token)return null;const hash=await sha256(token);
 const row=await env.DB.prepare('SELECT s.expires,u.id,u.family_id,u.role,u.login,u.name,f.name AS family_name,f.ai_consent_at,f.blocked_at FROM sessions s JOIN users u ON u.id=s.user_id JOIN families f ON f.id=u.family_id WHERE s.token_hash=?').bind(hash).first();
 if(!row||row.expires<Date.now()){if(row)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(hash).run();return null;}
 // A paused family keeps its data but cannot use the app until the administrator resumes it.
 if(row.blocked_at)return null;
 // Sliding expiry: active users stay signed in, a forgotten device expires after 30 days.
 let renewed=null;if(row.expires-Date.now()<(SESSION_DAYS-1)*86400000){await env.DB.batch([env.DB.prepare('UPDATE sessions SET expires=? WHERE token_hash=?').bind(Date.now()+SESSION_DAYS*86400000,hash),env.DB.prepare('UPDATE families SET last_seen=? WHERE id=?').bind(Date.now(),row.family_id)]);renewed=token;}
 return {user:{id:row.id,family:row.family_id,role:row.role,login:row.login,name:row.name,familyName:row.family_name,aiConsent:!!row.ai_consent_at},token,hash,renewed};
}
// Returns false once `limit` failures happened within the window; success callers reset with clearThrottle.
export async function throttled(env,key,limit,windowMs){const row=await env.DB.prepare('SELECT count,first FROM throttle WHERE key=?').bind(key).first();return !!row&&row.first>Date.now()-windowMs&&row.count>=limit;}
export async function countFailure(env,key,windowMs){const now=Date.now();await env.DB.prepare('INSERT INTO throttle(key,count,first) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN first<? THEN 1 ELSE count+1 END, first=CASE WHEN first<? THEN ? ELSE first END').bind(key,now,now-windowMs,now-windowMs,now).run();}
export const clearThrottle=(env,key)=>env.DB.prepare('DELETE FROM throttle WHERE key=?').bind(key).run();
