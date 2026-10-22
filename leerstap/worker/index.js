import {handleApi} from './server.js';
// Cloudflare Worker entry: /api/* runs here, everything else is served from the static assets in dist/public.
export default {
 async fetch(request,env){return new URL(request.url).pathname.startsWith('/api/')?handleApi(request,env):env.ASSETS.fetch(request);},
 // Daily cleanup of expired sessions and old throttle counters (cron in wrangler.toml).
 async scheduled(_event,env){const now=Date.now();await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires<?').bind(now),env.DB.prepare('DELETE FROM throttle WHERE first<?').bind(now-86400000)]);}
};
