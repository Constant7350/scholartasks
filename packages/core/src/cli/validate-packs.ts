import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { loadPacks } from "../packs";
import { AidGuide, checkAidGuide } from "../aid";
import { TradesPack, checkTradesPack } from "../trades";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../packs");
try {
  const packs = loadPacks(root);
  for (const s of packs.states)
    console.log(`ok  state ${s.state} v${s.version} [${s.status}] ${s.programs.length} programs, ${s.deadlines.length} deadlines`);
  for (const r of packs.regions) console.log(`ok  region ${r.id} v${r.version} [${r.status}] ${r.members.length} members`);
  const guide = AidGuide.parse(JSON.parse(readFileSync(resolve(root, "federal/aid-guide.json"), "utf8")));
  const problems = packs.states.flatMap((s) => checkAidGuide(guide, s.aid_steps).map((p) => `aid guide + ${s.state}: ${p}`));
  if (problems.length) throw new Error(`Invalid aid guide:\n${problems.join("\n")}`);
  const trades = TradesPack.parse(JSON.parse(readFileSync(resolve(root, "trades/trades.json"), "utf8")));
  const tradeProblems = checkTradesPack(trades);
  if (tradeProblems.length) throw new Error(`Invalid trades pack:\n${tradeProblems.join("\n")}`);
  console.log(`ok  trades v${trades.version} ${trades.trades.length} trades, ${trades.checklists.length} checklists, ${trades.aid.length} aid programs, ${Object.values(trades.grade_steps).flat().length} grade steps`);
  console.log(`ok  federal aid guide v${guide.version} [${guide.status}] ${guide.cycles.length} cycles, ${guide.steps.length} steps, ${guide.documents.length} documents`);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
