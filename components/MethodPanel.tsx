import { FACTORS } from "@/data/strategy";
import type { OrionData } from "@/lib/orion-types";

/** Everything Orion was told, so its answers can be audited and argued with. */
export function MethodPanel({ orion }: { orion: OrionData }) {
  const d = orion.dossier;
  return (
    <section className="method grid" id="method">
      <h2>What Orion knows</h2>
      <div className="m-brief">
        <h4>Company dossier <small>sent with every judgment{d ? ` · built ${new Date(d.builtAt).toLocaleString()}` : ""}</small></h4>
        {d ? d.brief.split("\n").map((p) => <p key={p.slice(0, 24)}>{p}</p>) : <p className="muted">Run Orion to load the company dossier (DOSSIER_FILE, or the example).</p>}
        {d && (
          <details>
            <summary>Sources read ({d.sources.filter((s) => s.found).length}/{d.sources.length})</summary>
            <ul className="m-src">{d.sources.map((s) => <li key={s.path} className={s.found ? "" : "missing"}><code>{s.path}</code> — {s.used}{s.found ? "" : " (not found)"}</li>)}</ul>
          </details>
        )}
      </div>
      <div className="m-factors">
        <h4>How it weighs a funder</h4>
        <ul>
          {FACTORS.map((f) => (
            <li key={f.id}>
              <span className="m-w">{Math.round(f.weight * 100)}</span>
              <span><b>{f.label}</b><small>{f.why}</small></span>
            </li>
          ))}
        </ul>
        <p className="m-note">
          Orion's rule: the model scores, the math decides. Jev judges each option on each factor; Orion's engine applies these weights,
          rules out options a hard limit forbids (funders needing a local entity cannot be pursued now), and widens its bands where Jev is unsure.
          Weights are our assumptions. Note that doing nothing is free: it scores well on effort and entity burden, so a funder must earn its place
          through odds, cash and credibility.
        </p>
      </div>
    </section>
  );
}
