import { FACTORS, OPTIONS, TIER, type OptionKey } from "@/data/strategy";
import type { OrionResult } from "@/lib/orion-types";

const NAME: Record<OptionKey, string> = { now: "Pursue now", later: "Park until revenue", skip: "Skip" };
const pos = (v: number) => `${((Math.max(-10, Math.min(10, v)) + 10) / 20) * 100}%`;

/** Orion's judgment on one funder: the engine's pick, its uncertainty bands, why, and the raw Jev judgments behind it. */
export function OrionPanel({ r }: { r?: OrionResult }) {
  if (!r) return <section className="d-orion"><h4>Orion</h4><p className="muted">Not assessed yet.</p></section>;
  if (r.status !== "assessed" || !r.bands)
    return <section className="d-orion"><h4>Orion</h4><p className="muted">{r.error ?? "Not assessed."} No score is shown rather than an invented one.</p></section>;

  const lead = r.pick ? TIER[r.pick] : r.tier ?? "No pick";
  return (
    <section className="d-orion">
      <h4>Orion · {lead}</h4>
      <p className="o-line">
        {r.pick
          ? <>The engine leans <b>{NAME[r.pick].toLowerCase()}</b>{r.gap != null && <> by {r.gap.toFixed(2)}</>}.</>
          : <>No clear leader: the options are within the noise.</>}
        {" "}Confidence {Math.round((r.confidence ?? 0) * 100)}%{r.needsReview ? " — needs your review" : ""}{r.stable === false ? ", not stable" : ""}.
      </p>

      <div className="o-bands" role="img" aria-label="Expected value per option with uncertainty range">
        <div className="o-axis"><span>−10</span><span>0</span><span>+10</span></div>
        {OPTIONS.map(({ key }) => {
          const b = r.bands![key];
          if (!b) return null;
          const blocked = r.blocked?.find((x) => x.option === key);
          return (
            <div className={`o-band ${r.pick === key ? "is-pick" : ""} ${blocked ? "is-blocked" : ""}`} key={key}>
              <span className="o-name">{NAME[key]}</span>
              <span className="o-track">
                <i className="o-zero" />
                <i className="o-range" style={{ left: pos(b.low), width: `calc(${pos(b.high)} - ${pos(b.low)})` }} />
                <i className="o-jev" style={{ left: pos(b.jev) }} />
              </span>
              <em>{b.jev > 0 ? "+" : ""}{b.jev.toFixed(2)}</em>
              {blocked && <small className="o-why">ruled out: {blocked.reason}</small>}
            </div>
          );
        })}
      </div>

      {r.reasons && r.reasons.length > 0 && <ul className="o-reasons">{r.reasons.map((t) => <li key={t}>{t}</li>)}</ul>}
      {r.flips && r.flips[0] && <p className="o-flip"><b>What would change it.</b> {r.flips[0]}</p>}

      {r.scores && (
        <details className="o-judg">
          <summary>Jev's judgments (−10 worse … +10 better; paler = less sure)</summary>
          <div className="o-grid" style={{ ["--cols" as string]: OPTIONS.length }}>
            <span />
            {OPTIONS.map((o) => <b key={o.key}>{NAME[o.key]}</b>)}
            {FACTORS.map((f) => (
              <Row key={f.id} label={f.label} cells={OPTIONS.map((o) => r.scores!.find((s) => s.optionId === o.key && s.factorId === f.id))} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function Row({ label, cells }: { label: string; cells: ({ value: number; probabilityConfidence: number } | undefined)[] }) {
  return (
    <>
      <span className="o-f">{label}</span>
      {cells.map((c, i) => (
        <span
          key={i}
          className={`o-cell ${c && c.value < 0 ? "neg" : "pos"}`}
          style={{ ["--a" as string]: c ? (Math.abs(c.value) / 10) * (0.25 + 0.75 * c.probabilityConfidence) : 0 }}
          title={c ? `value ${c.value}, confidence ${Math.round(c.probabilityConfidence * 100)}%` : ""}
        >{c ? (c.value > 0 ? "+" : "") + Math.round(c.value) : "–"}</span>
      ))}
    </>
  );
}
