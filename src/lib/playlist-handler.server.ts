// Shared GET/HEAD handler, tuned for OTT Navigator and NS Player.
import { getPlaylist, getStatus } from "./playlist-cache.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

function normalize(body: string): string {
  let t = body.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!t.startsWith("#EXTM3U")) t = "#EXTM3U\n" + t;
  return t + "\n";
}

export async function handlePlaylist(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (url.searchParams.has("status")) {
    return new Response(JSON.stringify(getStatus(), null, 2), {
      headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const entry = await getPlaylist(url.searchParams.get("refresh") === "1");
  if (!entry) {
    return new Response("#EXTM3U\n", {
      status: 503,
      headers: { ...cors, "Content-Type": "audio/x-mpegurl; charset=utf-8", "Retry-After": "300" },
    });
  }
  const body = normalize(entry.body);
  const bytes = new TextEncoder().encode(body);
  const headers = {
    ...cors,
    "Content-Type": "audio/x-mpegurl; charset=utf-8",
    "Content-Disposition": 'inline; filename="jiostb.m3u"',
    "Content-Length": String(bytes.byteLength),
    "Cache-Control": "no-cache, must-revalidate",
    "X-Cache-Age": String(Math.floor((Date.now() - entry.fetchedAt) / 1000)),
  };
  return new Response(request.method === "HEAD" ? null : bytes, { headers });
}
