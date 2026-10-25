// In-memory 3-hour cache of the upstream M3U playlist (per server instance).
export const API_URL = "https://jiostbapiplugx.lovable.app/api/jiostb";
export const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 30_000;

type Entry = { body: string; fetchedAt: number };
let cache: Entry | null = null;
let inflight: Promise<void> | null = null;

async function fetchUpstream(): Promise<string | null> {
  try {
    const res = await fetch(API_URL, {
      headers: { "User-Agent": "JioSTB-LocalProxy/1.0" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[jiostb] upstream HTTP ${res.status}`);
      return null;
    }
    const text = await res.text();
    return text.length > 20 ? text : null;
  } catch (e) {
    console.error("[jiostb] fetch failed", e);
    return null;
  }
}

// Earliest __hdnea__ token expiry (ms) in the playlist, if any.
export function tokenExpiry(body: string): number | null {
  let min: number | null = null;
  for (const m of body.matchAll(/exp=(\d{9,11})/g)) {
    const t = Number(m[1]) * 1000;
    if (min === null || t < min) min = t;
  }
  return min;
}

const EXPIRY_MARGIN_MS = 10 * 60 * 1000;

export function isStale(e: Entry | null, now = Date.now()): boolean {
  if (!e) return true;
  if (now - e.fetchedAt >= CACHE_TTL_MS) return true;
  const exp = tokenExpiry(e.body);
  // Refetch when tokens are about to expire, but at most once every 2 minutes.
  return exp !== null && now >= exp - EXPIRY_MARGIN_MS && now - e.fetchedAt > 120_000;
}

export async function getPlaylist(force = false): Promise<Entry | null> {
  if (force || isStale(cache)) {
    if (!inflight) {
      inflight = (async () => {
        const body = await fetchUpstream();
        if (body) cache = { body, fetchedAt: Date.now() };
      })().finally(() => {
        inflight = null;
      });
    }
    await inflight;
  }
  return cache;
}

export function getStatus() {
  const exists = !!cache;
  const age = cache ? Math.floor((Date.now() - cache.fetchedAt) / 1000) : null;
  return {
    exists,
    size: cache ? cache.body.length : 0,
    age_sec: age,
    ttl_sec: CACHE_TTL_MS / 1000,
    next_fetch: age === null ? 0 : Math.max(0, CACHE_TTL_MS / 1000 - age),
  };
}
