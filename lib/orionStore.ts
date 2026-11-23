import { promises as fs } from "node:fs";
import path from "node:path";
import { EMPTY_ORION, type OrionData } from "./orion-types";

const file = () => process.env.ORION_DATA_PATH ?? path.join(process.cwd(), "data", "orion.json");

export async function readOrion(): Promise<OrionData> {
  try { return { ...EMPTY_ORION, ...JSON.parse(await fs.readFile(file(), "utf8")) }; }
  catch { return EMPTY_ORION; }
}

export async function writeOrion(d: OrionData): Promise<void> {
  await fs.mkdir(path.dirname(file()), { recursive: true });
  const tmp = `${file()}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(d, null, 2));
  await fs.rename(tmp, file());
}
