// One source for the security headers: the build writes them to dist/public/_headers for Cloudflare, the local server sends them directly.
export const SECURITY_HEADERS={
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=(), interest-cohort=()',
 'Cross-Origin-Opener-Policy':'same-origin',
 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
};
export const HTTPS_HEADERS={'Strict-Transport-Security':'max-age=31536000; includeSubDomains'};
