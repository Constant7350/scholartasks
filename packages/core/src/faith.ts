// Religious affiliation of colleges, from the federal College Scorecard
// (school.religious_affiliation, the IPEDS RELAFFIL code). Families can pick
// "Christian colleges" (or one church family) when they search for colleges.

/** Scorecard religious affiliation codes and their names. */
export const AFFILIATIONS: Record<number, string> = {
  22: "American Evangelical Lutheran Church", 24: "African Methodist Episcopal Zion Church", 27: "Assemblies of God",
  28: "Brethren Church", 30: "Catholic", 33: "Wisconsin Evangelical Lutheran Synod", 34: "Christian and Missionary Alliance",
  35: "Christian Reformed Church", 36: "Evangelical Congregational Church", 37: "Evangelical Covenant Church",
  38: "Evangelical Free Church of America", 39: "Evangelical Lutheran Church", 40: "International United Pentecostal Church",
  41: "Free Will Baptist", 42: "Interdenominational Christian", 43: "Mennonite Brethren Church", 44: "Moravian Church",
  45: "North American Baptist", 47: "Pentecostal Holiness Church", 48: "Christian Churches and Churches of Christ",
  49: "Reformed Church in America", 50: "Reformed Episcopal Church", 51: "African Methodist Episcopal", 52: "American Baptist",
  53: "American Lutheran", 54: "Baptist", 55: "Christian Methodist Episcopal", 57: "Church of God", 58: "Church of the Brethren",
  59: "Church of the Nazarene", 60: "Cumberland Presbyterian", 61: "Christian Church (Disciples of Christ)", 64: "Free Methodist",
  65: "Friends (Quaker)", 66: "Presbyterian Church (USA)", 67: "Lutheran Church in America", 68: "Lutheran Church - Missouri Synod",
  69: "Mennonite Church", 71: "United Methodist", 73: "Episcopal", 74: "Churches of Christ", 75: "Southern Baptist",
  76: "United Church of Christ", 77: "Protestant", 78: "Multiple Protestant denominations", 79: "Other Protestant",
  80: "Jewish", 81: "Reformed Presbyterian Church", 84: "United Brethren Church", 87: "Missionary Church", 88: "Nondenominational",
  89: "Wesleyan", 91: "Greek Orthodox", 92: "Russian Orthodox", 93: "Unitarian Universalist", 94: "Latter-day Saints",
  95: "Seventh-day Adventist", 97: "Presbyterian Church in America", 99: "Other religious group", 100: "Original Free Will Baptist",
  101: "Ecumenical Christian", 102: "Evangelical Christian", 103: "Presbyterian", 105: "General Baptist", 106: "Muslim",
  107: "Plymouth Brethren", 108: "Nondenominational",
};

/** Codes that are not Christian churches (or not a specific faith). */
const NOT_CHRISTIAN = new Set([80, 93, 99, 106]);

/** Every Christian affiliation code. */
export const CHRISTIAN_CODES: number[] = Object.keys(AFFILIATIONS).map(Number).filter((c) => !NOT_CHRISTIAN.has(c));

/** Church families a family can narrow a Christian college search to. */
export const CHURCH_FAMILIES: { id: string; label: string; codes: number[] }[] = [
  { id: "baptist", label: "Baptist", codes: [41, 45, 52, 54, 75, 100, 105] },
  { id: "catholic", label: "Catholic", codes: [30] },
  { id: "methodist", label: "Methodist and Wesleyan", codes: [24, 51, 55, 64, 71, 89] },
  { id: "presbyterian", label: "Presbyterian and Reformed", codes: [35, 49, 60, 66, 81, 97, 103] },
  { id: "lutheran", label: "Lutheran", codes: [22, 33, 39, 53, 67, 68] },
  { id: "pentecostal", label: "Pentecostal, Church of God and Nazarene", codes: [27, 40, 47, 57, 59] },
  { id: "evangelical", label: "Evangelical and nondenominational", codes: [34, 36, 37, 38, 42, 77, 78, 79, 87, 88, 101, 102, 108] },
  { id: "christ", label: "Churches of Christ and Disciples", codes: [48, 61, 74, 76] },
  { id: "episcopal", label: "Episcopal and Orthodox", codes: [50, 73, 91, 92] },
  { id: "other", label: "Other Christian (Brethren, Mennonite, Quaker, Adventist, Latter-day Saints)", codes: [28, 43, 44, 58, 65, 69, 84, 94, 95, 107] },
];

/** A search's school-type pick: any, public, private (nonprofit) or Christian. */
export type SchoolType = "any" | "public" | "private" | "christian";

export const SCHOOL_TYPES: [SchoolType, string][] = [["any", "Any"], ["public", "Public"], ["private", "Private"], ["christian", "Christian"]];

/** True when the college reports a Christian church affiliation. */
export function isChristian(code: number | null | undefined): boolean {
  return code != null && CHRISTIAN_CODES.includes(code);
}

/** Affiliation codes to search for: all Christian, or one church family. */
export function faithCodes(church?: string | null): number[] {
  return CHURCH_FAMILIES.find((f) => f.id === church)?.codes ?? CHRISTIAN_CODES;
}

/** Short label for a college card, e.g. "Christian (Baptist)"; null when none is reported. */
export function faithLabel(code: number | null | undefined): string | null {
  if (code == null || !AFFILIATIONS[code]) return null;
  if (!isChristian(code)) return AFFILIATIONS[code]!;
  const name = AFFILIATIONS[code]!;
  return /christian/i.test(name) ? name : `Christian (${name})`;
}

/** Whether a college (ownership 1 public, 2 private nonprofit, 3 for-profit) fits a school-type pick. */
export function fitsSchoolType(c: { ownership: number; religiousAffiliation?: number | null }, type: SchoolType, church?: string | null): boolean {
  if (type === "public") return c.ownership === 1;
  if (type === "private") return c.ownership !== 1;
  if (type === "christian") return c.religiousAffiliation != null && faithCodes(church).includes(c.religiousAffiliation);
  return true;
}
