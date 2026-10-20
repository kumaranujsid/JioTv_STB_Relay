import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JioSTB Playlist Proxy" },
      { name: "description", content: "M3U playlist proxy with a 3-hour cache." },
      { property: "og:title", content: "JioSTB Playlist Proxy" },
      { property: "og:description", content: "M3U playlist proxy with a 3-hour cache." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Status = { exists: boolean; size: number; age_sec: number | null; ttl_sec: number; next_fetch: number };
const fmt = (s: number) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;

function Index() {
  const [status, setStatus] = useState<Status | null>(null);
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = () => fetch("/api/public/jiostb?status=1").then((r) => r.json()).then(setStatus);
  useEffect(() => {
    setOrigin(window.location.origin);
    load();
  }, []);

  const refresh = async () => {
    setBusy(true);
    await fetch("/api/public/jiostb?refresh=1");
    await load();
    setBusy(false);
  };

  const link = `${origin}/api/public/jiostb.m3u`;

  return (
    <main className="min-h-screen bg-background px-5 py-12 font-mono text-foreground">
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">● live proxy</p>
          <h1 className="mt-2 text-3xl font-bold">JioSTB Playlist</h1>
          <p className="mt-1 text-sm text-muted-foreground">Refreshes automatically every 3 hours.</p>
        </div>

        <section className="rounded-lg border border-border bg-card p-4">
          <p className="mb-2 text-xs text-muted-foreground">Playlist link (use in your IPTV player)</p>
          <code className="block break-all text-sm text-primary">{link}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="mt-3 w-full rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </section>

        <section className="grid grid-cols-3 gap-3 text-center">
          {[
            ["Cached", status ? (status.exists ? "Yes" : "No") : "…"],
            ["Age", status?.age_sec != null ? fmt(status.age_sec) : "—"],
            ["Next", status ? fmt(status.next_fetch) : "…"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="mt-1 font-semibold">{v}</p>
            </div>
          ))}
        </section>

        <button
          onClick={refresh}
          disabled={busy}
          className="w-full rounded-md border border-primary py-2 text-sm text-primary disabled:opacity-50"
        >
          {busy ? "Refreshing…" : "Force refresh now"}
        </button>
      </div>
    </main>
  );
}
