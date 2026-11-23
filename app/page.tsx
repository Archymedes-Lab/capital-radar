"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { opportunities } from "@/data/opportunities";
import { Detail } from "@/components/Detail";
import { MethodPanel } from "@/components/MethodPanel";
import { TicketBar } from "@/components/TicketBar";
import { EMPTY_ORION, type OrionData, type OrionResult } from "@/lib/orion-types";
import { TIER } from "@/data/strategy";
import { EMPTY_LIVE, type LiveData } from "@/lib/live-types";
import { PROFILE } from "@/lib/profile";
import { fmtTicket, fmtUsd, score } from "@/lib/score";
import { usePipeline } from "@/lib/usePipeline";
import { ACCESS_LABEL, KIND_LABEL, STATUSES } from "@/lib/ui";
import type { Kind, Region } from "@/lib/types";

type SortKey = "orion" | "fit" | "name" | "region" | "ticket";
const TIER_RANK = { now: 3, tie: 2, later: 1, skip: 0 } as const;
/** Orion order: tier first, then the score for pursuing now. Unassessed funders sort last. */
const orionKey = (r?: OrionResult) =>
  !r || r.status !== "assessed" ? -1e6 : (r.pick ? TIER_RANK[r.pick] : r.verdict === "tie" ? TIER_RANK.tie : 0) * 1000 + (r.nowScore ?? -99);
const REGIONS: Region[] = ["US", "EU", "UK", "APAC"];
const KINDS = Object.keys(KIND_LABEL).filter((k) => opportunities.some((o) => o.kind === k)) as Kind[];
const pad = (n: number) => String(n).padStart(2, "0");

export default function Page() {
  const [region, setRegion] = useState<Region | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [q, setQ] = useState("");
  const [hideRestricted, setHideRestricted] = useState(false);
  const [onlyPipeline, setOnlyPipeline] = useState(false);
  const [view, setView] = useState<"index" | "grid">("index");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "orion", dir: -1 });
  const [openId, setOpenId] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [live, setLive] = useState<LiveData & { enabled?: boolean }>(EMPTY_LIVE);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshErr, setRefreshErr] = useState<string | null>(null);
  const [orion, setOrion] = useState<OrionData>(EMPTY_ORION);
  const [orionBusy, setOrionBusy] = useState(false);
  const pipe = usePipeline();
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const load = () => fetch("/api/orion").then((r) => r.json()).then((d: OrionData) => { setOrion(d); return d.running; }).catch(() => false);
    load();
    const t = setInterval(async () => { if (await load()) return; }, 20_000);
    return () => clearInterval(t);
  }, []);

  async function askOrion(force = false) {
    setOrionBusy(true);
    try {
      const res = await fetch(`/api/orion/rank${force ? "?force=1" : ""}`, { method: "POST" });
      setOrion(await res.json());
    } finally { setOrionBusy(false); }
  }

  useEffect(() => {
    fetch("/api/live").then((r) => r.json()).then(setLive).catch(() => {});
  }, []);

  async function refreshNow() {
    setRefreshing(true);
    setRefreshErr(null);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setLive({ ...body, enabled: true });
    } catch (e) {
      setRefreshErr(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  const scored = useMemo(() => opportunities.map((o) => ({ o, s: score(o) })), []);
  const statusSig = opportunities.map((o) => pipe.get(o.id).status).join();

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const mid = (t: [number, number] | null) => (t ? (t[0] + t[1]) / 2 : -1);
    return scored
      .filter(({ o }) => !region || o.region === region)
      .filter(({ o }) => !kind || o.kind === kind)
      .filter(({ o }) => !hideRestricted || o.access !== "restricted")
      .filter(({ o }) => !onlyPipeline || pipe.get(o.id).status !== "new")
      .filter(({ o }) => !needle || `${o.name} ${o.country} ${o.angle ?? ""} ${o.sectors.join(" ")}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        const d =
          sort.key === "orion" ? orionKey(orion.results[a.o.id]) - orionKey(orion.results[b.o.id])
          : sort.key === "fit" ? a.s.total - b.s.total
          : sort.key === "ticket" ? mid(a.o.ticket) - mid(b.o.ticket)
          : sort.key === "region" ? a.o.region.localeCompare(b.o.region)
          : a.o.name.localeCompare(b.o.name);
        return (d || a.o.name.localeCompare(b.o.name)) * sort.dir;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scored, region, kind, q, hideRestricted, onlyPipeline, sort, statusSig, pipe.ready, orion.results]);

  const regionCount = (r: Region) => opportunities.filter((o) => o.region === r).length;
  const open = rows.find(({ o }) => o.id === openId) ?? null;

  const toggle = useCallback((id: string | null) => setOpenId((cur) => (cur === id ? null : id)), []);

  // Grid view opens details in a native modal; index view expands inline.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (view === "grid" && openId && !d.open) d.showModal();
    if ((view !== "grid" || !openId) && d.open) d.close();
  }, [view, openId]);

  useEffect(() => { if (cursor >= rows.length) setCursor(Math.max(0, rows.length - 1)); }, [rows.length, cursor]);

  // Keyboard: / search · j k move · enter open · esc close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement;
      if (e.key === "Escape") { if (typing) t.blur(); else setOpenId(null); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(rows.length - 1, c + 1)); }
      else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
      else if ((e.key === "Enter" || e.key === "o") && rows[cursor] && !(t instanceof HTMLButtonElement || t instanceof HTMLAnchorElement)) {
        e.preventDefault(); toggle(rows[cursor].o.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, cursor, toggle]);

  // Only follow the cursor after the user has moved it; never scroll on first paint.
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) { moved.current = true; return; }
    document.querySelector(`[data-row="${rows[cursor]?.o.id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  const sortBtn = (key: SortKey, label: string, cls = "") => (
    <button
      className={`th ${cls}`}
      aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
      onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((s.dir * -1) as 1 | -1) : key === "fit" || key === "ticket" || key === "orion" ? -1 : 1 }))}
    >
      {label}<span aria-hidden>{sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}</span>
    </button>
  );

  function exportCsv() {
    const head = ["Name", "Region", "Kind", "Orion", "Fit", "Ticket", "Access", "Status", "Note", "URL"];
    const lines = rows.map(({ o, s }) => {
      const p = pipe.get(o.id);
      return [o.name, o.region, KIND_LABEL[o.kind], orion.results[o.id]?.tier ?? "not assessed", s.total, fmtTicket(o.ticket), ACCESS_LABEL[o.access], p.status, p.note, o.url]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
    a.download = "funding-pipeline.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const inPipeline = opportunities.filter((o) => pipe.get(o.id).status !== "new").length;

  return (
    <>
      <a className="skip" href="#index">Skip to index</a>
      <header className="bar">
        <span className="brand">Archymedes<sup>®</sup></span>
        <span className="bar-mid">Capital Radar</span>
        <span className="bar-end">{new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" })}{orion.readOnly && <form method="post" action="/api/logout" className="logout"><button type="submit">Sign out</button></form>}</span>
      </header>

      <main>
        <section className="hero grid">
          <h1 className="hero-title">
            <span>{opportunities.length} doors.</span>
            <span>One round<span className="dot">.</span></span>
          </h1>
          <p className="hero-lede">
            Investors, accelerators and grants across the US, EU, UK and APAC, ranked by fit with a {PROFILE.stage}{" "}
            {fmtUsd(PROFILE.ask)} raise from {PROFILE.base}.
          </p>
          <dl className="facts">
            <div><dt>Lead products</dt><dd>{PROFILE.lead.join(" / ")}</dd></div>
            <div><dt>Traction</dt><dd>{PROFILE.traction}</dd></div>
            <div><dt>Revenue</dt><dd>{fmtUsd(PROFILE.revenue)} — {PROFILE.bar}</dd></div>
          </dl>
        </section>

        <section className="regions grid" aria-label="Regions">
          {REGIONS.map((r, i) => (
            <button key={r} className="region" aria-pressed={region === r} onClick={() => setRegion(region === r ? null : r)}>
              <span className="region-no">{pad(i + 1)}</span>
              <span className="region-n">{regionCount(r)}</span>
              <span className="region-name">{r}</span>
            </button>
          ))}
        </section>

        <Shortlist
          orion={orion}
          busy={orionBusy}
          onAsk={askOrion}
          rows={scored.map((x) => x.o).filter((o) => !region || o.region === region)}
          onOpen={(id) => { setView("index"); setQ(""); setKind(null); setOpenId(id); document.getElementById(`row-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
        />

        <div className="toolbar" role="search">
          <div className="grid toolbar-in">
            <div className="tb-search">
              <input ref={searchRef} type="search" placeholder="Search" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
              <kbd>/</kbd>
            </div>
            <div className="seg tb-kind" role="group" aria-label="Type">
              <button aria-pressed={!kind} onClick={() => setKind(null)}>All</button>
              {KINDS.map((k) => <button key={k} aria-pressed={kind === k} onClick={() => setKind(kind === k ? null : k)}>{KIND_LABEL[k]}</button>)}
            </div>
            <div className="tb-toggles">
              <label><input type="checkbox" checked={hideRestricted} onChange={(e) => setHideRestricted(e.target.checked)} />Hide local-entity</label>
              <label><input type="checkbox" checked={onlyPipeline} onChange={(e) => setOnlyPipeline(e.target.checked)} />My pipeline ({inPipeline})</label>
            </div>
            <div className="seg tb-view" role="group" aria-label="View">
              <button aria-pressed={view === "index"} onClick={() => { setOpenId(null); setView("index"); }}>Index</button>
              <button aria-pressed={view === "grid"} onClick={() => { setOpenId(null); setView("grid"); }}>Grid</button>
            </div>
            <button className="btn tb-csv" onClick={exportCsv}>CSV ↓</button>
          </div>
        </div>

        <div className="live grid" aria-live="polite">
          <span className="live-text">
            <i className={`pulse ${live.refreshedAt ? "on" : ""}`} />
            {live.refreshedAt
              ? `Exa · refreshed ${new Date(live.refreshedAt).toLocaleString()}`
              : orion.readOnly ? "Snapshot: live Exa refresh runs on the local app"
              : live.enabled === false ? "Exa not configured — set EXA_API_KEY in .env.local" : "No live refresh yet"}
            {live.error && <em> · {live.error}</em>}
            {refreshErr && <em> · {refreshErr}</em>}
          </span>
          <span className="live-count">{rows.length} / {opportunities.length}</span>
          {live.enabled !== false && !orion.readOnly && <button className="btn" onClick={refreshNow} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh"}</button>}
        </div>

        {view === "index" ? (
          <div id="index" className="index" role="table" aria-label="Funding opportunities">
            <div className="grid thead" role="row">
              <span className="c-no" role="columnheader">No.</span>
              {sortBtn("name", "Name", "c-name")}
              {sortBtn("region", "Region", "c-region")}
              {sortBtn("ticket", `Ticket · ▏= ${fmtUsd(PROFILE.ask)} ask`, "c-ticket")}
              {sortBtn("orion", "Orion", "c-orion")}
              {sortBtn("fit", "Fit", "c-fit")}
              <span className="c-access" role="columnheader">Access</span>
              <span className="c-status" role="columnheader">Status</span>
            </div>
            {rows.length === 0 && <p className="empty">Nothing matches. Clear a filter.</p>}
            {rows.map(({ o, s }, i) => {
              const p = pipe.get(o.id);
              const isOpen = openId === o.id;
              return (
                <div key={o.id} data-row={o.id} id={`row-${o.id}`} role="rowgroup" className={`item ${isOpen ? "is-open" : ""} ${cursor === i ? "is-cursor" : ""}`} style={{ ["--i" as string]: Math.min(i, 14) }}>
                  <button className="grid row" role="row" aria-expanded={isOpen} onClick={() => { setCursor(i); toggle(o.id); }}>
                    <span className="c-no">{pad(i + 1)}</span>
                    <span className="c-name"><strong>{o.name}</strong><small>{o.country} · {KIND_LABEL[o.kind]}</small></span>
                    <span className="c-region">{o.region}</span>
                    <span className="c-ticket"><TicketBar ticket={o.ticket} /></span>
                    <OrionCell r={orion.results[o.id]} />
                    <span className="c-fit"><b>{s.total}</b></span>
                    <span className={`c-access a-${o.access}`}>{ACCESS_LABEL[o.access]}</span>
                    <span className="c-status">{p.status !== "new" ? STATUSES.find((x) => x.v === p.status)?.label : "—"}</span>
                  </button>
                  <div className="collapse" data-open={isOpen}>
                    <div className="collapse-in"><div className="grid">{isOpen && (
                      <div className="detail-wrap"><Detail o={o} s={s} live={live.signals[o.id]} orion={orion.results[o.id]} entry={p} onChange={(patch) => pipe.update(o.id, patch)} /></div>
                    )}</div></div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div id="index" className="cards grid">
            {rows.length === 0 && <p className="empty">Nothing matches. Clear a filter.</p>}
            {rows.map(({ o, s }, i) => {
              const p = pipe.get(o.id);
              return (
                <button key={o.id} data-row={o.id} className={`card ${cursor === i ? "is-cursor" : ""}`} style={{ ["--i" as string]: Math.min(i, 14) }} onClick={() => { setCursor(i); toggle(o.id); }}>
                  <span className="card-top"><span>{pad(i + 1)} · {o.region}</span><span>{KIND_LABEL[o.kind]}</span></span>
                  <span className="card-fit">{orion.results[o.id]?.status === "assessed" ? (orion.results[o.id].nowScore ?? "–") : s.total}</span>
                  {orion.results[o.id]?.tier && <span className="card-tier">Orion · {orion.results[o.id].tier}</span>}
                  <strong>{o.name}</strong>
                  {o.angle ? <span className="card-angle">{o.angle}</span> : null}
                  <TicketBar ticket={o.ticket} />
                  <span className="card-foot"><span className={`a-${o.access}`}>{ACCESS_LABEL[o.access]}</span><span>{p.status !== "new" ? STATUSES.find((x) => x.v === p.status)?.label : ""}</span></span>
                </button>
              );
            })}
          </div>
        )}

        <dialog ref={dialogRef} className="modal" onClose={() => setOpenId(null)} onClick={(e) => { if (e.target === dialogRef.current) setOpenId(null); }}>
          {open && view === "grid" && (
            <div className="modal-in">
              <div className="modal-head">
                <div><small>{open.o.region} · {open.o.country} · {KIND_LABEL[open.o.kind]}</small><h2>{open.o.name}</h2></div>
                <button className="btn" onClick={() => setOpenId(null)}>Close ✕</button>
              </div>
              <Detail o={open.o} s={open.s} live={live.signals[open.o.id]} orion={orion.results[open.o.id]} entry={pipe.get(open.o.id)} onChange={(patch) => pipe.update(open.o.id, patch)} />
            </div>
          )}
        </dialog>

        <MethodPanel orion={orion} />

        {live.candidates.length > 0 && (
          <section className="discover grid">
            <h2>Newly discovered<span>{live.candidates.length}</span></h2>
            <p className="discover-note">Found by Exa, not vetted or scored. Check before adding to <code>data/opportunities.ts</code>.</p>
            <ul>
              {live.candidates.filter((c) => !region || c.region === region).map((c) => (
                <li key={c.host}>
                  <span className="d-r">{c.region}</span>
                  <a href={c.url} target="_blank" rel="noreferrer">{c.title}</a>
                  <small>{c.host}</small>
                  {c.snippet && <p>{c.snippet}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="foot grid">
        <p>
          Base list curated from general knowledge; Exa signals are extracted text and <b>not verified</b>. Confirm every programme
          on its official site before outreach. Fit = sector 40 + stage 25 + ticket 20 + access 15. Pipeline notes live in this browser only.
        </p>
        <p className="keys"><kbd>/</kbd> search <kbd>j</kbd><kbd>k</kbd> move <kbd>↵</kbd> open <kbd>esc</kbd> close</p>
      </footer>
    </>
  );
}

const pct = (r?: OrionResult) => (r?.confidence != null ? `${Math.round(r.confidence * 100)}%` : "");

/** One short line from the engine's own drivers, not the label-heavy reason sentence. */
function why(r: OrionResult): string {
  const up = (r.drivers ?? []).filter((d) => d.impact > 0).slice(0, 2).map((d) => d.label);
  if (r.pick) return up.length ? `Ahead on: ${up.join(" · ")}.` : r.reasons?.[0] ?? "";
  if (r.verdict === "tie") return `Too close to separate. ${(r.drivers ?? [])[0]?.label ?? "No single factor"} would decide it.`;
  return r.reasons?.[0] ?? "";
}

function OrionCell({ r }: { r?: OrionResult }) {
  if (!r) return <span className="c-orion o-none">—</span>;
  if (r.status !== "assessed") return <span className="c-orion o-none" title={r.error}>Not assessed</span>;
  const key = r.pick ?? (r.verdict === "tie" ? "tie" : "skip");
  return (
    <span className={`c-orion o-${key}`} title={r.reasons?.[0]}>
      <i className="o-dot" />
      <b>{r.tier ?? TIER[key as keyof typeof TIER]}</b>
      {r.nowScore != null && <small>{r.nowScore > 0 ? "+" : ""}{r.nowScore.toFixed(1)}{pct(r) ? ` · ${pct(r)}` : ""}</small>}
    </span>
  );
}

function Shortlist({
  orion, busy, onAsk, rows, onOpen,
}: {
  orion: OrionData;
  busy: boolean;
  onAsk: (force?: boolean) => void;
  rows: { id: string; name: string; region: string }[];
  onOpen: (id: string) => void;
}) {
  const ranked = rows
    .map((o) => ({ o, r: orion.results[o.id] }))
    .filter((x) => x.r?.status === "assessed" && (x.r.pick === "now" || x.r.verdict === "tie"))
    .sort((a, b) => orionKey(b.r) - orionKey(a.r))
    .slice(0, 5);
  const nNow = ranked.filter((x) => x.r!.pick === "now").length;
  const assessed = Object.values(orion.results).filter((r) => r.status === "assessed").length;
  return (
    <section className="short grid" aria-label="Orion shortlist">
      <div className="short-head">
        <h2>Worth your time, per Orion</h2>
        <p>
          {orion.runAt
            ? <>Assessed {assessed} funders against the full Archymedes dossier · {new Date(orion.runAt).toLocaleString()}{orion.server?.model ? ` · ${orion.server.model}` : ""}.</>
            : "Orion has not assessed anything yet."}
          {orion.error && !orion.readOnly && <em> {orion.error}</em>}
        </p>
        <div className="short-actions">
          {orion.readOnly
            ? <span className="snap">Read-only snapshot</span>
            : <button className="btn" onClick={() => onAsk(false)} disabled={busy || orion.running}>{busy || orion.running ? "Orion is thinking…" : "Ask Orion"}</button>}
          <a className="btn" href="#method">What Orion knows</a>
        </div>
      </div>
      <ol className="short-list">
        {ranked.length === 0 && <li className="short-empty">{orion.runAt ? "Orion sees nothing worth pursuing now in this region. Everything else is parked or skipped." : "Run Orion to see what it recommends."}</li>}
        {ranked.map(({ o, r }, i) => (
          <li key={o.id}>
            <button onClick={() => onOpen(o.id)}>
              <span className="s-no">{String(i + 1).padStart(2, "0")}</span>
              <strong>{o.name}</strong>
              <span className="s-meta">{o.region} · {r!.tier}{pct(r) ? ` · confidence ${pct(r)}` : ""}</span>
              <span className="s-why">{why(r!)}</span>
              <span className={`s-score ${r!.pick === "now" ? "hot" : ""}`}>{r!.nowScore != null ? (r!.nowScore > 0 ? "+" : "") + r!.nowScore.toFixed(1) : "—"}</span>
            </button>
          </li>
        ))}
      </ol>
      {orion.runAt && nNow > 0 && nNow < 5 && <p className="short-note">Only {nNow} {nNow === 1 ? "funder clears" : "funders clear"} the bar for "look into now"; the rest are too close to call or not worth the process cost yet.</p>}
    </section>
  );
}
