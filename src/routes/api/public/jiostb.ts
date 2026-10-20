import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/jiostb")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getPlaylist, getStatus } = await import("@/lib/playlist-cache.server");
        const url = new URL(request.url);
        const cors = { "Access-Control-Allow-Origin": "*" };

        if (url.searchParams.has("status")) {
          return new Response(JSON.stringify(getStatus(), null, 2), {
            headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
          });
        }

        const entry = await getPlaylist(url.searchParams.get("refresh") === "1");
        if (!entry) {
          return new Response(
            "#EXTM3U\n# Upstream API unavailable and no cache yet. Retry shortly.\n",
            {
              status: 503,
              headers: { ...cors, "Content-Type": "text/plain; charset=utf-8", "Retry-After": "300" },
            },
          );
        }
        return new Response(entry.body, {
          headers: {
            ...cors,
            "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
            "Content-Disposition": 'inline; filename="jiostb.m3u"',
            "Cache-Control": "no-cache, must-revalidate",
            "X-Cache-Age": String(Math.floor((Date.now() - entry.fetchedAt) / 1000)),
          },
        });
      },
    },
  },
});
