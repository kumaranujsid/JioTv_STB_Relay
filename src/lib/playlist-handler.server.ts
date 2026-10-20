// Shared GET/HEAD handler, tuned for OTT Navigator and NS Player.
import { getPlaylist, getStatus } from "./playlist-cache.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const UA = "plaYtv/7.1.3 (Linux;Android 13) ExoPlayerLib/2.11.7";

// Jio CDN wants the __hdnea__ token as a cookie plus an app user-agent.
// Add them in the forms OTT Navigator and NS Player understand.
function addHeaders(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const tok = !line.startsWith("#") ? /__hdnea__=[^&|\s]+/.exec(line)?.[0] : undefined;
    if (tok && !line.includes("|")) {
      out.push(`#EXTVLCOPT:http-user-agent=${UA}`);
      out.push(`#EXTHTTP:${JSON.stringify({ cookie: tok, "User-Agent": UA })}`);
      out.push(`${line}|cookie=${tok}&User-Agent=${encodeURIComponent(UA)}`);
    } else out.push(line);
  }
  return out;
}

function normalize(body: string): string {
  let t = body.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!t.startsWith("#EXTM3U")) t = "#EXTM3U\n" + t;
  return addHeaders(t.split("\n")).join("\n") + "\n";
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
