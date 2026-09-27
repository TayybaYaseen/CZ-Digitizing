const CONFIGURED_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// localhost / loopback / RFC 1918 private LAN addresses — i.e. "a dev machine", never a real
// deployment host.
function isLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
    /^192\.168\.\d+\.\d+$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hostname)
  );
}

// Local dev only: reach the API on the same hostname the page itself was opened on. .env points
// NEXT_PUBLIC_API_URL at the LAN IP so a phone on the same wifi can test too, but a page opened at
// http://localhost:3000 then calls http://192.168.x.x:4000 — a different *site*, so the browser
// never sends the SameSite=Lax httpOnly czd_device_id cookie back on the next request. The
// new-device flow then breaks: login mints one device id, verify-new-device mints another, finds
// no pending session, and a correct emailed code is rejected as "Invalid or expired code".
// Swapping only the hostname (port/protocol kept) keeps page + API same-site whichever address
// the page was opened on. Real (non-local) hosts on either side are left exactly as configured,
// and server-side code (no window) always uses the configured URL.
function resolveApiUrl(): string {
  if (typeof window === 'undefined') return CONFIGURED_API_URL;
  try {
    const url = new URL(CONFIGURED_API_URL);
    const pageHost = window.location.hostname;
    if (url.hostname === pageHost || !isLocalHost(url.hostname) || !isLocalHost(pageHost)) return CONFIGURED_API_URL;
    url.hostname = pageHost;
    return url.toString().replace(/\/$/, '');
  } catch {
    return CONFIGURED_API_URL;
  }
}

export const API_URL = resolveApiUrl();
