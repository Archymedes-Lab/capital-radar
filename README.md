# Capital Radar

Finds and ranks funding opportunities (investors, accelerators, grants) for an early-stage startup across the US, EU, UK and APAC.
The investee in this repo is an example (`lib/profile.ts`, `data/dossier.example.md`): replace it with your own.

- **Base list** — `data/opportunities.ts`, curated, *not live-verified*.
- **Exa** refreshes each funder's public signals (cheque size, deadlines, status) and discovers new funders on a schedule.
- **Orion** decides what is worth pursuing. For each funder, Jev (through the Orion server) scores three options — *pursue now*, *park until revenue*, *skip* — against eight weighted factors, given your company dossier (a plain-text file named by `DOSSIER_FILE`, kept outside the repo). Orion's deterministic engine then picks, applies hard limits (funders needing a local entity cannot be pursued now) and reports uncertainty. The model scores; the math decides.

## Run

```sh
bun install
cp .env.example .env.local        # EXA_API_KEY, REFRESH_SECRET, DOSSIER_FILE
(cd ~/orion && bun run server)     # Orion on :3001 holds the Jev key; this app never does
bun run build && bun run start
bun scripts/orion-rank.ts          # or press "Ask Orion"; --force re-scores everything
bun test
```

## Notes

- Judgments are cached by input hash (`data/orion.json`): re-runs spend model calls only when a funder's facts, live signals or the dossier change. Changing weights in `data/strategy.ts` needs no calls.
- If Orion can't score a funder the UI says so. It never shows an invented number.
- Weights are assumptions (`data/strategy.ts`), shown in the UI. Doing nothing is free, so *skip* scores well on effort and entity burden; a funder must earn its place on odds, cash and credibility.
- Orion rate-limits clients (60/min); the runner honours `Retry-After`.
- The dossier is sent to the Orion server and on to TypeSafe/Jev with every judgment.

## Licence

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
