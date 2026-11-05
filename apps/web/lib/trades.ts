import { TradesPack, type ApplyChecklist, type Trade } from "@scholartasks/core";
import packJson from "../../../packs/trades/trades.json";

/** The trades list (packs/trades/trades.json), checked against its schema once. */
export const TRADES_PACK = TradesPack.parse(packJson);
export const TRADES: Trade[] = TRADES_PACK.trades;
export const CHECKLISTS: ApplyChecklist[] = TRADES_PACK.checklists;

export const tradeBySlug = (slug: string) => TRADES.find((t) => t.slug === slug);
export const checklistById = (id: string) => CHECKLISTS.find((c) => c.id === id);

export const dollars = (n: number | null | undefined) => (n == null ? "—" : `$${n.toLocaleString("en-US")}`);

export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", PR: "Puerto Rico",
};

/** Links that find training and apprenticeships for a trade in any state. */
export const NATIONAL_FINDERS = [
  { label: "Apprenticeship openings in every state (U.S. Department of Labor)", url: "https://www.apprenticeship.gov/finder" },
  { label: "Training programs near any ZIP code (CareerOneStop)", url: "https://www.careeronestop.org/Toolkit/Training/find-local-training.aspx" },
];

/** Ways to pay for trade training: federal, Georgia and other states' programs. */
export const TRADE_AID = TRADES_PACK.aid;
