import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadPacks } from "../packs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../packs");
try {
  const packs = loadPacks(root);
  for (const s of packs.states)
    console.log(`ok  state ${s.state} v${s.version} [${s.status}] ${s.programs.length} programs, ${s.deadlines.length} deadlines`);
  for (const r of packs.regions) console.log(`ok  region ${r.id} v${r.version} [${r.status}] ${r.members.length} members`);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
