import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TradesPack, addDays, aidFor, checkTradesPack, checkableFacts, checklistSteps, gradeStepsFor, matchTrades, payLine, tradeGradeTaskId, tradeTaskId } from "../src/trades";

const pack = TradesPack.parse(JSON.parse(readFileSync(resolve(__dirname, "../../../packs/trades/trades.json"), "utf8")));

describe("trades pack", () => {
  it("is valid and consistent", () => {
    expect(checkTradesPack(pack)).toEqual([]);
    expect(pack.trades.length).toBeGreaterThan(40);
  });

  it("covers trades mostly found outside Georgia", () => {
    const away = pack.trades.filter((t) => t.thin_in_georgia).map((t) => t.slug);
    expect(away).toEqual(expect.arrayContaining(["wind-turbine-technician", "commercial-diver"]));
  });

  it("flags duplicate slugs and unknown checklists", () => {
    const t = pack.trades[0]!;
    const bad = { ...pack, trades: [t, { ...t, paths: [{ ...t.paths[0]!, checklist: "nope" }] }] };
    expect(checkTradesPack(bad)).toEqual([`duplicate trade ${t.slug}`, `${t.slug}: unknown checklist nope`]);
  });
});

describe("checklists", () => {
  const tech = pack.checklists.find((c) => c.id === "tech-college")!;
  it("drops Georgia-only steps for other states", () => {
    expect(checklistSteps(tech, "GA").some((s) => s.key === "hope")).toBe(true);
    expect(checklistSteps(tech, "TX").some((s) => s.key === "hope")).toBe(false);
  });
  it("makes stable task ids and due dates", () => {
    expect(tradeTaskId("cdl", "permit")).toBe("tr:cdl:permit");
    expect(addDays("2026-12-25", 10)).toBe("2027-01-04");
  });
});

describe("quiz", () => {
  it("ranks by matching interests, then pay", () => {
    const r = matchTrades(pack.trades, ["animals"], 20).map((m) => m.trade.slug);
    expect(r).toContain("vet-technician");
    expect(r).toContain("farrier");
    expect(r).not.toContain("welder");
    expect(matchTrades(pack.trades, [])).toEqual([]);
  });
  it("shows Georgia pay, or US pay when Georgia has none", () => {
    const wind = pack.trades.find((t) => t.slug === "wind-turbine-technician")!;
    expect(payLine(wind)).toBe("$64,120 typical in the US");
  });
});

describe("aid, grade steps and checks", () => {
  it("lists home-state and federal aid first, other states after", () => {
    const ga = aidFor(pack.aid, "GA");
    expect(ga.here.map((a) => a.id)).toContain("hope-grant");
    expect(ga.here.map((a) => a.id)).toContain("pell");
    expect(ga.elsewhere.map((a) => a.id)).toContain("tn-promise");
    const tn = aidFor(pack.aid, "TN");
    expect(tn.here.map((a) => a.id)).toContain("tn-promise");
    expect(tn.elsewhere.map((a) => a.id)).toContain("hope-grant");
  });
  it("has trade steps for grades 8 to 12", () => {
    for (const g of [8, 9, 10, 11, 12]) expect(gradeStepsFor(pack, g).length).toBeGreaterThan(0);
    expect(gradeStepsFor(pack, 6)).toEqual(gradeStepsFor(pack, 8));
    expect(tradeGradeTaskId(10, "dual")).toBe("tg:10:dual");
  });
  it("lists facts for the monthly check with unique subjects", () => {
    const facts = checkableFacts(pack);
    expect(facts.length).toBe(pack.aid.length + pack.trades.filter((t) => t.license.url).length);
    expect(new Set(facts.map((f) => f.subject)).size).toBe(facts.length);
    for (const f of facts) expect(f.subject).toMatch(/^[a-z]+:[a-z0-9-]+$/);
  });
});
