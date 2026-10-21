# Akindi

A JioTV playlist proxy and web player. It fetches an upstream M3U playlist, caches it for
3 hours, rewrites every channel line so that common IPTV players can actually open the
streams, and serves the result as a single playlist URL you can paste into any app.

A browser player is included too, so you can watch straight from the site without adding
the playlist anywhere.

## What it does

- **Caches** the upstream playlist in memory for 3 hours, so repeated player requests are
  served instantly instead of hitting the upstream API every time.
- **Normalises** the playlist — strips a stray BOM, converts Windows line endings, and
  guarantees the `#EXTM3U` header is present.
- **Rewrites** each protected channel line so players send the token as a cookie with the
  right app user-agent. Every line carrying a `__hdnea__` token gets an
  `#EXTVLCOPT:http-user-agent` line, an `#EXTHTTP` line with the cookie and user-agent as
  JSON, and a pipe-separated `|cookie=...&User-Agent=...` suffix. OTT Navigator and
  NS Player read these; plain `#EXTINF` lists do not carry them.
- **Relays** video requests through the site for the browser player, which would otherwise
  be blocked by cross-origin rules.
- **Serves CORS headers** on every endpoint, so web apps and browser-based players can read
  the playlist.

## Endpoints

Base URL of the published app: `https://akindi.lovable.app`

| Endpoint | Purpose |
| --- | --- |
| `GET /api/public/jiostb.m3u` | The playlist. Use this one — the `.m3u` extension is what most players expect. |
| `GET /api/public/jiostb` | The same playlist, extensionless. |
| `GET /api/public/jiostb?status=1` | JSON cache status. |
| `GET /api/public/jiostb?refresh=1` | Force a fresh fetch from upstream. |
| `GET /api/public/stream?url=...` | Video relay used by the browser player (see below). |
| `GET /player` | The web player. |
| `GET /` | Front page: playlist link, QR code, setup guides. |

`HEAD` and `OPTIONS` are handled on all playlist endpoints.

## Playlist usage

### 1. Get the URL

```
https://akindi.lovable.app/api/public/jiostb.m3u
```

The front page shows this link with a copy button and a QR code you can scan on a TV.

### 2. Add it to a player

**NS Player**
1. Open NS Player → **Playlist** → **Add playlist**.
2. Paste the URL above and save.
3. Open the playlist and pick a channel.

**OTT Navigator**
1. Open OTT Navigator → **Settings** → **Manage playlists** → **Add**.
2. Choose **URL** and paste the link.
3. Let it load the channels, then refresh if the list looks stale.

> If you added the playlist before the player headers were added to the lines, remove it and
> add it again — the old copy will not play.

### 3. Or watch in the browser

Open `https://akindi.lovable.app/player`. It parses the playlist, shows a searchable channel
grid with group filters, and plays a channel directly from your own connection first, falling
back to the relay if that is blocked.

### Response headers

| Header | Value |
| --- | --- |
| `Content-Type` | `audio/x-mpegurl; charset=utf-8` |
| `Content-Disposition` | `inline; filename="jiostb.m3u"` |
| `Cache-Control` | `no-cache, must-revalidate` |
| `X-Cache-Age` | Seconds since this copy was fetched from upstream |
| `Access-Control-Allow-Origin` | `*` |

## Refresh option

```
/api/public/jiostb?refresh=1
```

Any request without this parameter is served from the cache while it is under 3 hours old.
With `refresh=1` the server fetches the upstream playlist again before answering, and the new
copy replaces the cached one. Use it when channels have moved or the list looks out of date.

- Concurrent refreshes are collapsed into one upstream request.
- If the upstream fetch fails, the previously cached copy is kept and served; nothing is
  thrown away.
- If there is no cached copy and the fetch fails, the endpoint returns **503** with a bare
  `#EXTM3U` body and a `Retry-After: 300` header.

## Status option

```
curl "https://akindi.lovable.app/api/public/jiostb?status=1"
```

```json
{
  "exists": true,
  "size": 1031793,
  "age_sec": 595,
  "ttl_sec": 10800,
  "next_fetch": 10205
}
```

| Field | Meaning |
| --- | --- |
| `exists` | Whether this server instance holds a cached copy. `false` means nothing has been fetched yet. |
| `size` | Playlist size in bytes. `0` when nothing is cached. |
| `age_sec` | Seconds since the cached copy was fetched. `null` when nothing is cached. |
| `ttl_sec` | Cache lifetime, always `10800` (3 hours). |
| `next_fetch` | Seconds until the cache goes stale and the next request triggers a refresh. `0` when nothing is cached. |

This endpoint never triggers a fetch — it only reports what is already in memory.

## Stream relay

```
/api/public/stream?url=<encoded jio.com stream url>
```

The browser player uses this when a channel cannot be opened directly. It forwards the
request server-side and copies back `Content-Type`, `Content-Length`, `Content-Range` and
`Accept-Ranges`, so seeking still works.

Guards:
- Only `https://` URLs on `jio.com` or a `jio.com` subdomain are fetched. Anything else gets
  **403**, and a malformed URL gets **400**.
- A `__hdnea__` token found in the query string is forwarded as a `Cookie` header.
- `Range` requests are passed through; the response is marked `no-store`.

## Limitations

- **The cache is per server instance and in memory.** A restart, a redeploy, or a different
  edge instance all start with an empty cache — `exists: false` — and the next request pays
  the upstream fetch.
- **Streams are geo-restricted.** Jio's CDN serves the video only from Indian connections
  (a request from elsewhere comes back `451`). Playlist loading works from anywhere; video
  playback generally needs an Indian internet connection.
- **Tokens expire.** Each `__hdnea__` token carries its own start and expiry time, so an old
  playlist copy eventually stops playing. A refresh gets you new tokens.
- The channel count shown on the front page is fixed text, not a live count.

## Project layout

```
src/lib/playlist-cache.server.ts       upstream fetch + 3-hour in-memory cache
src/lib/playlist-handler.server.ts     shared request handler, normalising and header rewriting
src/routes/api/public/jiostb.ts        playlist endpoint
src/routes/api/public/jiostb[.]m3u.ts  playlist endpoint with .m3u extension
src/routes/api/public/stream.ts        video relay
src/routes/player.tsx                  shaka-player based web player
src/routes/index.tsx                   front page: link, QR code, setup guides
```

The upstream source is configured in `src/lib/playlist-cache.server.ts` (`API_URL`).

## Development

```bash
bun install
bun run dev      # local dev server
bun run build    # production build
bun test         # vitest
bun run lint     # eslint
```

TanStack Start with file-based routing under `src/routes`; Tailwind CSS v4 through
`src/styles.css`.
