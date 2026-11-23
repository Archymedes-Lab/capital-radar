import { promises as fs } from "node:fs";
import path from "node:path";
import { EMPTY_LIVE, type LiveData } from "./live-types";

const file = () => process.env.LIVE_DATA_PATH ?? path.join(process.cwd(), "data", "live.json");

export async function readLive(): Promise<LiveData> {
  try {
    return { ...EMPTY_LIVE, ...JSON.parse(await fs.readFile(file(), "utf8")) };
  } catch {
    return EMPTY_LIVE;
  }
}

export async function writeLive(d: LiveData): Promise<void> {
  await fs.mkdir(path.dirname(file()), { recursive: true });
  const tmp = `${file()}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(d, null, 2));
  await fs.rename(tmp, file()); // atomic: readers never see a half-written file
}
