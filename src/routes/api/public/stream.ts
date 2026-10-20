import { createFileRoute } from "@tanstack/react-router";

// Stream relay: fetches Jio video/manifest files server-side (at the edge nearest the viewer)
// so the browser avoids CORS blocks. Only jio.com hosts are allowed.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

const h = async ({ request }: { request: Request }) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const target = new URL(request.url).searchParams.get("url");
  let u: URL;
  try {
    u = new URL(target || "");
  } catch {
    return new Response("bad url", { status: 400, headers: cors });
  }
  if (u.protocol !== "https:" || !(u.hostname === "jio.com" || u.hostname.endsWith(".jio.com"))) {
    return new Response("host not allowed", { status: 403, headers: cors });
  }
  const headers: Record<string, string> = {
    "User-Agent": "plaYtv/7.1.3 (Linux;Android 13) ExoPlayerLib/2.11.7",
  };
  const range = request.headers.get("range");
  if (range) headers.Range = range;
  const res = await fetch(u.toString(), { method: request.method, headers });
  const out = new Headers(cors);
  for (const k of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = res.headers.get(k);
    if (v) out.set(k, v);
  }
  out.set("Cache-Control", "no-store");
  return new Response(request.method === "HEAD" ? null : res.body, { status: res.status, headers: out });
};

export const Route = createFileRoute("/api/public/stream")({
  server: { handlers: { GET: h, HEAD: h, OPTIONS: h } },
});
