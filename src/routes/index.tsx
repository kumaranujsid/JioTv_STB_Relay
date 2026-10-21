import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JioSTB Streaming Hub — Playlist & Web Player" },
      { name: "description", content: "1,100+ live channels. Copy the M3U link for NS Player or OTT Navigator, or watch online." },
      { property: "og:title", content: "JioSTB Streaming Hub" },
      { property: "og:description", content: "1,100+ live channels. M3U playlist for NS Player & OTT Navigator, plus a web player." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Status = { exists: boolean; size: number; age_sec: number | null; ttl_sec: number; next_fetch: number };
const fmt = (s: number) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;

const guides = {
  "NS Player": [
    "Open NS Player and tap the menu → Playlists.",
    "Tap + Add playlist and choose URL / Remote.",
    "Paste the playlist link and save.",
    "Open the playlist and pick any channel.",
  ],
  "OTT Navigator": [
    "Open OTT Navigator → Settings → Provider setup.",
    "Tap Add provider → Playlist (M3U).",
    "Paste the playlist link, keep EPG empty, and confirm.",
    "Wait for channels to load, then start watching.",
  ],
} as const;

function Index() {
  const [status, setStatus] = useState<Status | null>(null);
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [tab, setTab] = useState<keyof typeof guides>("NS Player");

  const load = () => fetch("/api/public/jiostb?status=1").then((r) => r.json()).then(setStatus).catch(() => {});
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
  const copy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />

      <div className="relative mx-auto max-w-5xl px-5 py-12">
        {/* Hero */}
        <header className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {status?.exists ? "Live · playlist ready" : "Live proxy"}
          </span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-6xl">
            Your <span className="text-primary">Streaming Hub</span>
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            1,100+ live channels in one playlist. Auto-refreshed every 3 hours, ready for NS Player and OTT Navigator.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/player"
              className="rounded-xl bg-primary px-8 py-3 font-semibold text-primary-foreground shadow-[0_0_40px_-8px_var(--primary)] transition hover:scale-[1.03]"
            >
              ▶ Watch online
            </Link>
            <button onClick={copy} className="rounded-xl border border-border bg-card/60 px-8 py-3 font-semibold backdrop-blur transition hover:border-primary">
              {copied ? "✓ Link copied" : "Copy playlist link"}
            </button>
          </div>
        </header>

        {/* Stats */}
        <section className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Channels", "1,100+"],
            ["Cached", status ? (status.exists ? "Yes" : "No") : "…"],
            ["Updated", status?.age_sec != null ? `${fmt(status.age_sec)} ago` : "—"],
            ["Next refresh", status ? fmt(status.next_fetch) : "…"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{k}</p>
              <p className="mt-1 text-xl font-bold">{v}</p>
            </div>
          ))}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          {/* Playlist card */}
          <section className="rounded-2xl border border-primary/30 bg-card/60 p-6 backdrop-blur lg:col-span-3">
            <h2 className="text-lg font-bold">Playlist link</h2>
            <p className="text-sm text-muted-foreground">Paste this into your IPTV app.</p>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-background/60 p-2">
              <code className="flex-1 truncate px-2 font-mono text-sm text-primary">{link}</code>
              <button onClick={copy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => setShowQr((s) => !s)} className="rounded-lg border border-border px-4 py-2 text-sm hover:border-primary">
                {showQr ? "Hide QR code" : "Show QR code for TV"}
              </button>
              <button onClick={refresh} disabled={busy} className="rounded-lg border border-border px-4 py-2 text-sm hover:border-primary disabled:opacity-50">
                {busy ? "Refreshing…" : "↻ Force refresh"}
              </button>
            </div>
            {showQr && origin && (
              <div className="mt-5 flex flex-col items-center gap-2">
                <div className="rounded-xl bg-foreground p-4">
                  <QRCodeSVG value={link} size={180} bgColor="transparent" fgColor="var(--background)" />
                </div>
                <p className="text-xs text-muted-foreground">Scan with your phone or TV to get the link.</p>
              </div>
            )}
          </section>

          {/* Guides */}
          <section className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur lg:col-span-2">
            <h2 className="text-lg font-bold">Setup guide</h2>
            <div className="mt-3 flex gap-1 rounded-xl bg-background/60 p-1">
              {(Object.keys(guides) as (keyof typeof guides)[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setTab(g)}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${tab === g ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  {g}
                </button>
              ))}
            </div>
            <ol className="mt-4 space-y-3">
              {guides[tab].map((step, i) => (
                <li key={step} className="flex gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <footer className="mt-12 text-center text-xs text-muted-foreground">
          Tip: if a channel won't play in the browser, use NS Player or OTT Navigator.
        </footer>
      </div>
    </main>
  );
}
