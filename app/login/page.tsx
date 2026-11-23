import type { Metadata } from "next";
import { safeNext } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in — Archymedes Capital Radar", robots: { index: false } };

const MESSAGE: Record<string, string> = {
  wrong: "That password is not right.",
  locked: "Too many attempts. Try again in 15 minutes.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="login">
      <p className="login-brand">Archymedes<sup>®</sup> Capital Radar</p>
      <h1>Private.</h1>
      <form method="post" action="/api/login">
        <input type="hidden" name="next" value={safeNext(next)} />
        <label htmlFor="pw">Password</label>
        <input id="pw" name="password" type="password" autoComplete="current-password" autoFocus required />
        {error && <p className="login-err" role="alert">{MESSAGE[error] ?? "Could not sign in."}</p>}
        <button className="btn" type="submit">Enter</button>
      </form>
    </main>
  );
}
