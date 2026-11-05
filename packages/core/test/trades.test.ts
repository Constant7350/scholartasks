import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TradesPack, addDays, checkTradesPack, checklistSteps, matchTrades, payLine, tradeTaskId } from "../src/trades";

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
