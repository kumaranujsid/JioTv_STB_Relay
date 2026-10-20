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

export async function getPlaylist(force = false): Promise<Entry | null> {
  const stale = !cache || Date.now() - cache.fetchedAt >= CACHE_TTL_MS;
  if (force || stale) {
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
