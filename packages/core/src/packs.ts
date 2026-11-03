import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RegionPack, StatePack, checkStatePack } from "./schema";
import type { LoadedPacks } from "./selection";

/** Loads and validates every pack under packs/states and packs/regions. Throws on any problem. */
export function loadPacks(root: string): LoadedPacks {
  const read = (dir: string) =>
    readdirSync(join(root, dir))
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({ file: join(dir, f), data: JSON.parse(readFileSync(join(root, dir, f), "utf8")) }));

  const errors: string[] = [];
  const states: StatePack[] = [];
  for (const { file, data } of read("states")) {
    const parsed = StatePack.safeParse(data);
    if (!parsed.success) {
      errors.push(`${file}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
      continue;
    }
    errors.push(...checkStatePack(parsed.data).map((p) => `${file}: ${p}`));
    states.push(parsed.data);
  }
  const regions: RegionPack[] = [];
  for (const { file, data } of read("regions")) {
    const parsed = RegionPack.safeParse(data);
    if (!parsed.success) errors.push(`${file}: ${parsed.error.message}`);
    else regions.push(parsed.data);
  }
  for (const s of states)
    for (const r of s.regions)
      if (!regions.some((x) => x.id === r)) errors.push(`states/${s.state}: unknown region ${r}`);
  if (errors.length) throw new Error(`Invalid packs:\n${errors.join("\n")}`);
  return { states, regions };
}

