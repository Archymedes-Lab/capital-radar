import { PROFILE } from "@/lib/profile";
import { fmtTicket } from "@/lib/score";
import { axisPos } from "@/lib/ui";
import type { Opportunity } from "@/lib/types";

/** Range of the funder's typical cheque on a log axis, with the Archymedes ask marked. */
export function TicketBar({ ticket }: { ticket: Opportunity["ticket"] }) {
  const ask = axisPos(PROFILE.ask);
  return (
    <span className="tbar" role="img" aria-label={`Ticket ${fmtTicket(ticket)}`}>
      <span className="tbar-axis" />
      {ticket && (
        <span
          className="tbar-range"
          style={{ left: `${axisPos(ticket[0])}%`, width: `${Math.max(1.5, axisPos(ticket[1]) - axisPos(ticket[0]))}%` }}
        />
      )}
      <span className="tbar-ask" style={{ left: `${ask}%` }} />
      <span className="tbar-label">{fmtTicket(ticket)}</span>
    </span>
  );
}
