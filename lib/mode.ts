/** Vercel's filesystem is read-only and has no long-running process, so the deployed app is a snapshot. */
export const readOnly = () => Boolean(process.env.VERCEL) || process.env.READ_ONLY === "1";
