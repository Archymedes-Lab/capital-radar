import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // A stray lockfile in $HOME confuses root detection; pin it.
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  // The API routes read these snapshots at runtime.
  outputFileTracingIncludes: { "/api/*": ["./data/*.json"] },
};
