import { fmtTicket } from "@/lib/score";
import { ACCESS_LONG, STATUSES } from "@/lib/ui";
import { OrionPanel } from "./OrionPanel";
import type { LiveEntry } from "@/lib/live-types";
import type { OrionResult } from "@/lib/orion-types";
import type { Opportunity, PipelineEntry, PipelineStatus, ScoreBreakdown } from "@/lib/types";

const PARTS = [["Sector", "sector", 40], ["Stage", "stage", 25], ["Ticket", "ticket", 20], ["Access", "access", 15]] as const;

export function Detail({
  o, s, live, orion, entry, onChange,
}: {
  o: Opportunity;
  s: ScoreBreakdown;
  live?: LiveEntry;
  orion?: OrionResult;
  entry: PipelineEntry;
  onChange: (patch: Partial<Pick<PipelineEntry, "status" | "note">>) => void;
}) {
  return (
    <div className="detail">
      {o.angle ? (
        <section className="d-angle">
          <h4>Angle</h4>
          <p>{o.angle}</p>
        </section>
      ) : null}
      <section className="d-caveat">
        <h4>Confirm first</h4>
        <p>{o.caveat}</p>
        <p className="d-meta">{ACCESS_LONG[o.access]} · {fmtTicket(o.ticket)}</p>
      </section>
      <section className="d-score">
        <h4>Heuristic fit {s.total}/100</h4>
        {PARTS.map(([label, key, max]) => (
          <div className="d-bar" key={key}>
            <span>{label}</span>
            <i style={{ ["--w" as string]: `${(s[key] / max) * 100}%` }} />
            <em>{s[key]}/{max}</em>
          </div>
        ))}
      </section>

      <OrionPanel r={orion} />

      {live && (
        <section className="d-live">
          <h4>Live signals <small>fetched {new Date(live.fetchedAt).toLocaleDateString()} · extracted text, verify at source</small></h4>
          <ul>
            {live.hits.slice(0, 3).map((h) => (
              <li key={h.url}>
                <a href={h.url} target="_blank" rel="noreferrer">{h.title} ↗</a>
                {h.published && <small> {h.published.slice(0, 10)}</small>}
                {h.snippets.map((t) => <p key={t}>“{t}”</p>)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="d-track">
        <h4>Pipeline</h4>
        <div className="d-track-row">
          <select value={entry.status} onChange={(e) => onChange({ status: e.target.value as PipelineStatus })} aria-label="Status">
            {STATUSES.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
          </select>
          <input value={entry.note} placeholder="Contact, intro path, next step" onChange={(e) => onChange({ note: e.target.value })} aria-label="Notes" />
          <a className="btn" href={o.url} target="_blank" rel="noreferrer">Official site ↗</a>
        </div>
      </section>
    </div>
  );
}
