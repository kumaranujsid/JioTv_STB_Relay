import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/player")({
  head: () => ({
    meta: [
      { title: "JioSTB Online Player" },
      { name: "description", content: "Watch JioSTB playlist channels in your browser." },
      { property: "og:title", content: "JioSTB Online Player" },
      { property: "og:description", content: "Watch JioSTB playlist channels in your browser." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlayerPage,
});

type Channel = { name: string; logo: string; group: string; url: string; keys: Record<string, string> };

function parse(m3u: string): Channel[] {
  const out: Channel[] = [];
  let cur: Partial<Channel> = {};
  for (const raw of m3u.split("\n")) {
    const l = raw.trim();
    if (!l) continue;
    if (l.startsWith("#EXTINF")) {
      cur = {
        name: l.split(",").pop() || "Channel",
        logo: /tvg-logo="([^"]*)"/.exec(l)?.[1] || "",
        group: /group-title="([^"]*)"/.exec(l)?.[1] || "Other",
        keys: {},
      };
    } else if (l.startsWith("#KODIPROP:inputstream.adaptive.license_key=")) {
      const v = l.split("=").slice(1).join("=");
      for (const pair of v.split(",")) {
        const [k, key] = pair.split(":");
        if (k && key) cur.keys![k] = key;
      }
    } else if (!l.startsWith("#") && cur.name) {
      out.push({ ...(cur as Channel), url: l.split("|")[0] ?? l });
      cur = {};
    }
  }
  return out;
}

function PlayerPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("All");
  const [current, setCurrent] = useState<Channel | null>(null);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    fetch("/api/public/jiostb.m3u").then((r) => r.text()).then((t) => setChannels(parse(t)));
  }, []);

  useEffect(() => {
    if (!current || !videoRef.current) return;
    let cancelled = false;
    setError("");
    (async () => {
      const shaka = (await import("shaka-player")).default as any;
      shaka.polyfill.installAll();
      if (!playerRef.current) {
        playerRef.current = new shaka.Player();
        await playerRef.current.attach(videoRef.current);
      }
      const p = playerRef.current;
      p.configure({ drm: { clearKeys: current.keys } });
      const token = new URL(current.url).search;
      const net = p.getNetworkingEngine();
      net.clearAllRequestFilters();
      net.registerRequestFilter((_type: number, req: { uris: string[] }) => {
        req.uris = req.uris.map((uri) => {
          if (uri.includes("/api/public/stream?url=")) {
            const inner = decodeURIComponent(uri.split("url=")[1] ?? "");
            uri = inner;
          }
          if (!/^https:\/\/[^/]*jio\.com\//.test(uri)) return uri;
          const u = new URL(uri);
          if (!u.search && token) u.search = token;
          return `${window.location.origin}/api/public/stream?url=${encodeURIComponent(u.toString())}`;
        });
      });
      try {
        await p.load(current.url);
        if (!cancelled) videoRef.current?.play().catch(() => {});
      } catch (e: any) {
        if (!cancelled) setError(`Couldn't play this channel in the browser (code ${e?.code ?? "?"}). Try it in OTT Navigator or NS Player.`);
      }
    })();
    return () => { cancelled = true; };
  }, [current]);

  const groups = useMemo(() => ["All", ...Array.from(new Set(channels.map((c) => c.group)))], [channels]);
  const list = channels.filter(
    (c) => (group === "All" || c.group === group) && c.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <main className="min-h-screen bg-background px-4 py-6 font-mono text-foreground">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Online Player</h1>
          <Link to="/" className="text-sm text-primary">← Playlist link</Link>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <video ref={videoRef} controls playsInline className="aspect-video w-full bg-background" />
          <div className="p-3 text-sm">
            {current ? <span className="font-semibold">{current.name}</span> : <span className="text-muted-foreground">Pick a channel below</span>}
            {error && <p className="mt-1 text-destructive">{error}</p>}
          </div>
        </div>

        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search channels…"
            className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm"
          />
          <select value={group} onChange={(e) => setGroup(e.target.value)} className="rounded-md border border-input bg-card px-2 text-sm">
            {groups.map((g) => <option key={g}>{g}</option>)}
          </select>
        </div>

        <p className="text-xs text-muted-foreground">{list.length} channels</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
          {list.map((c, i) => (
            <button
              key={c.url + i}
              onClick={() => setCurrent(c)}
              className={`rounded-lg border p-2 text-center text-xs ${current === c ? "border-primary" : "border-border"} bg-card`}
            >
              {c.logo && <img src={c.logo} alt="" loading="lazy" className="mx-auto mb-1 h-12 w-full object-contain" />}
              <span className="line-clamp-2">{c.name}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
