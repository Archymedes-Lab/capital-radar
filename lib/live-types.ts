export interface LiveHit {
  url: string;
  title: string;
  published: string | null;
  /** Sentences that mention money, deadlines or application status. */
  snippets: string[];
}

export interface LiveEntry {
  fetchedAt: string;
  hits: LiveHit[];
}

export interface Candidate {
  url: string;
  host: string;
  title: string;
  region: string;
  snippet: string;
  foundAt: string;
}

export interface LiveData {
  refreshedAt: string | null;
  /** Count of per-entry lookups that failed in the last run. */
  failed: number;
  error: string | null;
  signals: Record<string, LiveEntry>;
  candidates: Candidate[];
}

export const EMPTY_LIVE: LiveData = {
  refreshedAt: null, failed: 0, error: null, signals: {}, candidates: [],
};
