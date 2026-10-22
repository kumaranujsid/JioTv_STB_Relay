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

const card = "rounded-3xl border border-border/70 bg-card/50 backdrop-blur-xl";

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

  const stats: [string, string][] = [
    ["Channels", "1,100+"],
    ["Cached", status ? (status.exists ? "Ready" : "Empty") : "…"],
    ["Updated", status?.age_sec != null ? `${fmt(status.age_sec)} ago` : "—"],
    ["Next refresh", status ? fmt(status.next_fetch) : "…"],
  ];

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background pb-28 text-foreground sm:pb-12">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[380px] w-[600px] -translate-x-1/2 rounded-full bg-primary/25 blur-[110px] sm:h-[520px] sm:w-[900px]" />
      <div className="pointer-events-none absolute right-[-120px] top-[40%] h-[300px] w-[300px] rounded-full bg-primary/10 blur-[100px]" />

      {/* Top bar */}
      <nav className="sticky top-0 z-20 border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary text-sm font-black text-primary-foreground">▶</span>
            <span className="truncate font-bold tracking-tight">JioSTB Hub</span>
          </div>
          <Link to="/player" className="hidden shrink-0 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground sm:inline-block">
            Watch online
          </Link>
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:hidden">
            <span className="h-2 w-2 rounded-full bg-primary" /> {status?.exists ? "Ready" : "Live"}
          </span>
        </div>
      </nav>

      <div className="relative mx-auto max-w-5xl px-4 pt-10 sm:px-6 sm:pt-16">
        {/* Hero */}
        <header className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {status?.exists ? "Live · playlist ready" : "Live proxy"}
          </span>
          <h1 className="mt-5 text-[2.5rem] font-extrabold leading-[1.05] tracking-tight sm:text-7xl">
            Live TV,
            <br />
            <span className="bg-gradient-to-r from-primary to-foreground bg-clip-text text-transparent">anywhere you watch.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] text-muted-foreground sm:text-base">
            1,100+ channels in one playlist — auto-refreshed every 3 hours for NS Player and OTT Navigator.
          </p>
          <div className="mx-auto mt-7 hidden max-w-md gap-3 sm:flex sm:justify-center">
            <Link to="/player" className="rounded-2xl bg-primary px-8 py-3.5 font-semibold text-primary-foreground shadow-[0_0_50px_-10px_var(--primary)] transition hover:scale-[1.03]">
              ▶ Watch online
            </Link>
            <button onClick={copy} className="rounded-2xl border border-border bg-card/60 px-8 py-3.5 font-semibold backdrop-blur transition hover:border-primary">
              {copied ? "✓ Link copied" : "Copy playlist link"}
            </button>
          </div>
        </header>

        {/* Stats */}
        <section className="mt-10 grid grid-cols-2 gap-2.5 sm:mt-14 sm:grid-cols-4 sm:gap-3">
          {stats.map(([k, v]) => (
            <div key={k} className={`${card} p-4`}>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</p>
              <p className="mt-1 truncate text-lg font-bold sm:text-xl">{v}</p>
            </div>
          ))}
        </section>

        <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-5">
          {/* Playlist */}
          <section className={`${card} border-primary/30 p-5 sm:p-6 lg:col-span-3`}>
            <h2 className="text-lg font-bold">Playlist link</h2>
            <p className="text-sm text-muted-foreground">Paste this into your IPTV app.</p>
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-border bg-background/60 p-1.5">
              <code className="min-w-0 truncate px-2 font-mono text-xs text-primary sm:text-sm">{link}</code>
              <button onClick={copy} className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setShowQr((s) => !s)} className="rounded-xl border border-border px-3 py-2.5 text-sm hover:border-primary">
                {showQr ? "Hide QR" : "QR for TV"}
              </button>
              <button onClick={refresh} disabled={busy} className="rounded-xl border border-border px-3 py-2.5 text-sm hover:border-primary disabled:opacity-50">
                {busy ? "Refreshing…" : "↻ Refresh"}
              </button>
            </div>
            {showQr && origin && (
              <div className="mt-5 flex flex-col items-center gap-2">
                <div className="rounded-2xl bg-foreground p-4">
                  <QRCodeSVG value={link} size={170} bgColor="transparent" fgColor="var(--background)" />
                </div>
                <p className="text-xs text-muted-foreground">Scan with your phone or TV to get the link.</p>
              </div>
            )}
          </section>

          {/* Guides */}
          <section className={`${card} p-5 sm:p-6 lg:col-span-2`}>
            <h2 className="text-lg font-bold">Setup guide</h2>
            <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-background/60 p-1">
              {(Object.keys(guides) as (keyof typeof guides)[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setTab(g)}
                  className={`rounded-xl py-2.5 text-sm font-medium transition ${tab === g ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  {g}
                </button>
              ))}
            </div>
            <ol className="mt-4 space-y-3">
              {guides[tab].map((step, i) => (
                <li key={step} className="flex gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">{i + 1}</span>
                  <span className="min-w-0">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <footer className="mt-10 text-center text-xs text-muted-foreground">
          Tip: if a channel won't play in the browser, use NS Player or OTT Navigator.
        </footer>
      </div>

      {/* Mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/85 p-3 backdrop-blur-xl sm:hidden">
        <div className="grid grid-cols-2 gap-2">
          <Link to="/player" className="rounded-2xl bg-primary py-3.5 text-center font-semibold text-primary-foreground shadow-[0_0_40px_-10px_var(--primary)]">
            ▶ Watch
          </Link>
          <button onClick={copy} className="rounded-2xl border border-border bg-card/70 py-3.5 font-semibold">
            {copied ? "✓ Copied" : "Copy link"}
          </button>
        </div>
      </div>
    </main>
  );
}
