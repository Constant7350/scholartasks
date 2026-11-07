// Finds every English line people can see in the web app and writes
// apps/web/lib/i18n/lines.json: one entry per line with the screen it is on.
// The Spanish lives in apps/web/lib/i18n/es/*.json (English -> Spanish).
// The team language check page (/check) reads lines.json, so new lines show up
// there by themselves after this runs.
//
//   node scripts/i18n/extract.mjs            write lines.json and list lines with no Spanish yet
//   node scripts/i18n/extract.mjs --check    fail if lines.json is out of date (CI)
//
// Lines with changing parts are templates: "You have {n} colleges" matches
// "You have 3 colleges" on screen, and the Spanish keeps the same {n}.
import { createRequire } from "module";
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "fs";
import { join, relative, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(join(root, "apps/web/package.json"));
const ts = require("typescript");

const web = join(root, "apps/web");
const OUT = join(web, "lib/i18n/lines.json");

// Folders that are not part of the family app (team-only pages stay in English).
const SKIP_DIRS = new Set(["node_modules", ".next", "admin", "i18n", "check"]);
const SKIP_FILES = [/app\/translator\.tsx$/, /lib\/ics\.ts$/, /lib\/progress-email\.ts$/, /nav-es\.ts$/, /\(site\)\/es\//, /help\/content-es\.ts$/, /lib\/stage-brief\.ts$/, /api\/cron\/plan-level\//, /api\/cron\/school-year\//, /lib\/current-students\.ts$/];

function files(dir, list = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) files(p, list);
    } else if (/\.(tsx|ts)$/.test(name) && !/\.d\.ts$/.test(name) && !/\.test\.tsx?$/.test(name)) list.push(p);
  }
  return list;
}

const core = join(root, "packages/core/src");
const all = [...files(join(web, "app")), ...files(join(web, "lib")), ...files(core).filter((p) => !p.includes("/cli/"))]
  .filter((p) => !SKIP_FILES.some((re) => re.test(p)))
  .sort();

const ENT = { apos: "'", quot: '"', amp: "&", nbsp: " ", lt: "<", gt: ">", rarr: "→", larr: "←", middot: "·", mdash: "—", ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", copy: "©" };
const decode = (s) => s.replace(/&([a-z]+);/g, (m, n) => ENT[n] ?? m).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const norm = (s) => s.replace(/\s+/g, " ").trim();
const hasWords = (s) => /[A-Za-z]{2,}/.test(s);

// Attributes whose text is never shown.
const CODE_ATTRS = new Set([
  "className", "href", "src", "id", "type", "key", "name", "rel", "target", "role", "method", "autoComplete",
  "inputMode", "style", "htmlFor", "action", "encType", "accept", "pattern", "lang", "dir", "value", "defaultValue",
  "form", "media", "sizes", "srcSet", "as", "data-menu-toggle", "capture", "enterKeyHint", "step", "min", "max",
  "download", "translate", "spellCheck", "autoCapitalize", "wrap", "kind", "group", "slug", "path", "icon", "tone",
  "variant", "size", "color", "status", "mode", "field", "area", "k", "to", "query", "param", "next", "back",
  "anchor", "tab", "section", "topic",
]);
// Calls whose string arguments are code, not words.
const CODE_CALLS = /^(require|import|fetch|from|select|eq|neq|in|is|order|rpc|match|ilike|like|gte|lte|gt|lt|or|not|contains|upsert|insert|update|delete|limit|range|single|maybeSingle|querySelector|querySelectorAll|getElementById|addEventListener|removeEventListener|getItem|setItem|removeItem|get|set|has|startsWith|endsWith|includes|indexOf|split|replace|replaceAll|join|padStart|toLocaleString|toLocaleDateString|toLocaleTimeString|Intl|DateTimeFormat|NumberFormat|createElement|setAttribute|setProperty|getAttribute|closest|matches|log|warn|error|info|debug|redirect|push|replaceState|pushState|test|exec|RegExp|URL|URLSearchParams|append|searchParams|cookies|headers|env|Date|parse|stringify|localeCompare|toFixed|createHmac|createHash|digest|update|sign|verify|storage|upload|download|createSignedUrl|getPublicUrl|channel|on|emit|track|postMessage|encodeURIComponent|decodeURIComponent|atob|btoa|Buffer|TextEncoder|charCodeAt|fromCharCode|normalize|toLowerCase|toUpperCase|cookie|header|setHeader|NextResponse\.redirect|useSearchParams|usePathname|useRouter|dynamic|notFound)$/;

// Variables and properties that hold AI instructions, ids, styles or other code text.
const CODE_NAMES = /(prompt|system|instruction|regex|pattern|class|css|style|url|href|path|route|key|slug|id|ids|table|column|cols|select|query|sql|cookie|header|mime|type|types|ext|accept|format|tag|token|secret|env|model|status|kind|mode|role|field|fields|sort|order|lang|locale|icon|color|tone|variant|endpoint|bucket|file|filename|cron|schedule|code|codes|es|cip|soc|unitid|fips|zip|state_code|action|event|method|selector|storagekey|storage_key|tz|timezone)$/i;

// Strings that look like code even when they are not caught by where they are.
function looksLikeCode(s) {
  if (!hasWords(s)) return true;
  if (/^(https?:|mailto:|tel:|sms:|data:|\/|\.\/|#|\?|&|@|\$|<|\{|\[|--?\w)/.test(s)) return true;
  if (/^[a-z0-9_.:-]+$/.test(s)) return true; // single lowercase token: ids, statuses
  if (/^[a-z][a-z0-9-]*( [a-z][a-z0-9-]*)*$/.test(s) && /-/.test(s) && !/ (and|or|the|a|to|of|for|in|on|with|your|you) /.test(` ${s} `)) return true; // class names
  if (/^[A-Z0-9_]+$/.test(s) && s.length > 3 && /_/.test(s)) return true; // CONSTANTS
  if (/[{};=]\s*$|=>|\bfunction\b|\bconst\b|\breturn\b|\(\)|&&|\|\||!==|===|\bvar\(--/.test(s)) return true;
  if (/^[\w-]+\/[\w.+-]+$/.test(s)) return true; // mime types
  if (/^\d/.test(s) && !/[a-z]{3,} [a-z]{3,}/i.test(s)) return true;
  if (/^[a-z]+[A-Z]\w*$/.test(s)) return true; // camelCase
  if (/\.(png|jpe?g|svg|pdf|mp3|mp4|json|csv|ics|webp|docx?|xlsx?|txt)$/i.test(s) && !/ /.test(s)) return true;
  if (/^(select|insert|update|delete|create|alter|drop) /i.test(s) && /[,*()]/.test(s)) return true;
  if (/^[\w-]+(,\s*[\w-]+)+$/.test(s) && !/[A-Z]/.test(s)) return true; // column lists
  if (/^(auto|none|inherit|hidden|visible|block|flex|grid|nowrap|center|left|right|top|bottom)\b/.test(s) && s.length < 30) return true;
  if (/\b\d+(px|rem|em|vh|vw|%)\b/.test(s) && !/[a-z]{4,} [a-z]{4,}/.test(s)) return true;
  if (/^(Bearer |st-|aid:|license:|tg:|tr:|bg:|Pack |Student state |Invalid packs|Today is |Stripe error|Slide Xx:|Xx<w:|Xx=Xx;|XxFrom Xx)/.test(s) || /<w:|max-age=|\?e=Xx|Xx\/join\?|Xx\/unsubscribe/.test(s)) return true;
  if (/^[A-Z]{2}$/.test(s) || /^(LANGUAGE:|Grade (Xx|\{\w+\}|\d+): (use|they|middle))/.test(s) || /^ScholarTasks: \{lines\}/.test(s)) return true;
  if (/^rgba?\(|^#[0-9a-f]{3,8}$/i.test(s) || /gradient\(|^(TRUE|FALSE|ScholarTasks)$/.test(s)) return true;
  // Already Spanish (the menu's own Spanish, the /es page).
  if (/[áéíóúñ¿¡]/.test(s) && !/\b(the|and|your|you|with|for|of)\b/.test(s)) return true;
  return false;
}

const out = new Map(); // en -> { files:Set }
function add(en, file) {
  en = norm(en);
  if (!en || en.length > 700) return;
  const probe = en.replace(/\{[A-Za-z0-9]+\}/g, "Xx").replace(/<\/?\d+>/g, "");
  if (looksLikeCode(probe) || !/[A-Za-z]{2,}/.test(en.replace(/\{[A-Za-z0-9]+\}/g, ""))) return;
  let e = out.get(en);
  if (!e) out.set(en, (e = { files: new Set() }));
  e.files.add(file);
}

// A name for a changing part: {n}, {name}, {count}…
function holeName(expr, used) {
  let base = "x";
  let e = expr;
  while (e && (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAsExpression(e))) e = e.expression;
  if (e && ts.isIdentifier(e)) base = e.text;
  else if (e && ts.isPropertyAccessExpression(e)) base = e.name.text;
  else if (e && ts.isCallExpression(e)) {
    const c = e.expression;
    if (ts.isIdentifier(c)) base = c.text;
    else if (ts.isPropertyAccessExpression(c)) base = ts.isIdentifier(c.expression) || ts.isPropertyAccessExpression(c.expression) ? holeBase(c.expression) : c.name.text;
  } else if (e && ts.isElementAccessExpression(e)) base = holeBase(e.expression);
  base = base.replace(/[^A-Za-z0-9]/g, "") || "x";
  if (/^(toLocaleString|toFixed|String|Number|round|fmt|money|format|formatMoney|toString|trim|join|map)$/.test(base)) base = "n";
  let name = base;
  let i = 2;
  while (used.has(name)) name = `${base}${i++}`;
  used.add(name);
  return `{${name}}`;
}
const holeBase = (e) => (ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : "x");

// Is this expression just text-ish (not JSX, not a conditional with elements)?
const isPlainExpr = (e) => !!e && !containsJsx(e);
function containsJsx(n) {
  let found = false;
  const walk = (x) => {
    if (found) return;
    if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) { found = true; return; }
    ts.forEachChild(x, walk);
  };
  walk(n);
  return found;
}

function calleeName(call) {
  const c = call.expression;
  if (ts.isIdentifier(c)) return c.text;
  if (ts.isPropertyAccessExpression(c)) return c.name.text;
  return "";
}

function nameOf(node) {
  if (!node) return "";
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isPrivateIdentifier?.(node)) return node.text;
  return "";
}

// Should this string literal be skipped because of where it sits?
function codeContext(node, isApi) {
  const p = node.parent;
  if (!p) return true;
  // Server lines wrapped in T(...) are translated for emails and texts.
  if (ts.isCallExpression(p) && calleeName(p) === "T") return false;
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p)) return true;
  if (ts.isLiteralTypeNode(p)) return true;
  if (ts.isExpressionStatement(p)) return true; // "use client"
  if (ts.isPropertyAssignment(p) && p.name === node) return true;
  if (ts.isPropertyAssignment(p) && CODE_NAMES.test(nameOf(p.name))) return true;
  // Arrays of search words, selectors and routes.
  for (let x = p; x && (ts.isArrayLiteralExpression(x) || ts.isPropertyAssignment(x) || ts.isVariableDeclaration(x)); x = x.parent) {
    if ((ts.isPropertyAssignment(x) || ts.isVariableDeclaration(x)) && /^(keywords|words|synonyms|aliases|sel|selector|selectors|routes|courses|COURSES|matchWords|stop|STOP|tags)$/.test(nameOf(x.name))) return true;
    if (!ts.isArrayLiteralExpression(x)) break;
  }
  if (ts.isVariableDeclaration(p) && CODE_NAMES.test(nameOf(p.name))) return true;
  if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.InKeyword, ts.SyntaxKind.InstanceOfKeyword].includes(p.operatorToken.kind)) return true;
  if (ts.isCaseClause(p)) return true;
  if (ts.isElementAccessExpression(p)) return true;
  if (ts.isComputedPropertyName(p)) return true;
  if (ts.isJsxAttribute(p) || (ts.isJsxExpression(p) && p.parent && ts.isJsxAttribute(p.parent))) {
    const attr = ts.isJsxAttribute(p) ? p : p.parent;
    const n = attr.name.getText();
    if (CODE_ATTRS.has(n) || /^(on[A-Z]|data-|aria-(controls|describedby|labelledby|hidden|expanded|pressed|current|live|haspopup|selected|checked|invalid|busy|modal|owns|level))/.test(n)) return true;
  }
  if (ts.isCallExpression(p) || ts.isNewExpression(p)) {
    const name = ts.isCallExpression(p) ? calleeName(p) : p.expression.getText();
    if (CODE_CALLS.test(name)) return true;
  }
  // In API routes only error/message texts are shown to people.
  if (isApi) {
    let x = node;
    while (x.parent && !ts.isPropertyAssignment(x.parent) && !ts.isBlock(x.parent) && !ts.isSourceFile(x.parent)) x = x.parent;
    if (!(x.parent && ts.isPropertyAssignment(x.parent) && /^(error|message|reason|detail|hint|warning|ok)$/i.test(nameOf(x.parent.name)))) return true;
  }
  return false;
}

// AI instruction text: inside a variable or property named like a prompt.
function insidePrompt(node) {
  for (let x = node.parent; x; x = x.parent) {
    if ((ts.isVariableDeclaration(x) || ts.isPropertyAssignment(x) || ts.isFunctionDeclaration(x)) && /prompt|system|instruction|guide|rules?$|^ask/i.test(nameOf(x.name))) return true;
    if (ts.isCallExpression(x) && /create|stream|messages/.test(calleeName(x)) && x.expression.getText().includes("anthropic")) return true;
  }
  return false;
}

// JSX text the way React shows it: lines trimmed, blank lines dropped.
function jsxText(t) {
  const lines = t.split(/\r\n|\n|\r/);
  if (lines.length === 1) return t;
  return lines
    .map((l, i) => (i > 0 ? l.trimStart() : l))
    .map((l, i, a) => (i < a.length - 1 ? l.trimEnd() : l))
    .filter((l) => l.length)
    .join(" ");
}
const INLINE = new Set(["a", "Link", "b", "strong", "em", "i", "span", "small", "u", "mark", "abbr", "time", "sup", "sub", "kbd", "q", "cite"]);
const consumed = new Set();
const plainKid = (k) => ts.isJsxText(k) || (ts.isJsxExpression(k) && isPlainExpr(k.expression));
const emptyKid = (k) => (ts.isJsxText(k) && !k.text.trim() && /\n/.test(k.text)) || (ts.isJsxExpression(k) && !k.expression);
function inlineKid(k) {
  if (!ts.isJsxElement(k)) return false;
  if (!INLINE.has(k.openingElement.tagName.getText())) return false;
  const inner = k.children.filter((c) => !emptyKid(c));
  return inner.length > 0 && inner.every(plainKid);
}
function piece(k, used, out) {
  if (ts.isJsxText(k)) { out.used.push(k); return decode(jsxText(k.text)); }
  const e = k.expression;
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  return holeName(e, used);
}
/** A whole sentence: text, {changing parts} and <1>inline tags</1>. */
function sentenceOf(kids) {
  const list = kids.filter((k) => !emptyKid(k));
  if (list.length < 2) return null;
  if (!list.every((k) => plainKid(k) || inlineKid(k))) return null;
  if (!list.some((k) => ts.isJsxText(k) && hasWords(k.text))) return null;
  const used = new Set();
  const out = { text: "", used: [] };
  let n = 0;
  for (const k of list) {
    if (ts.isJsxElement(k)) {
      n++;
      let inner = "";
      for (const c of k.children.filter((c) => !emptyKid(c))) inner += piece(c, used, out);
      out.text += `<${n}>${inner}</${n}>`;
    } else out.text += piece(k, used, out);
  }
  return out;
}

for (const path of all) {
  const rel = path.startsWith(core) ? "core/" + relative(core, path) : relative(web, path);
  const src = readFileSync(path, "utf8");
  if (/^\s*\/\/\s*i18n-skip/.test(src)) continue;
  const sf = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true, path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const isApi = rel.startsWith("app/api/") || /route\.ts$/.test(rel);

  const visit = (node) => {
    // JSX children: plain text, and whole sentences with changing parts and
    // links or bold words inside them (numbered tags, the same way the page
    // translator reads the screen).
    if ((ts.isJsxElement(node) || ts.isJsxFragment(node)) && !isApi) {
      const tag = ts.isJsxElement(node) ? node.openingElement.tagName.getText() : "";
      if (tag === "code" || tag === "pre" || tag === "script" || tag === "style") return;
      const sentence = sentenceOf(node.children);
      if (sentence) {
        add(sentence.text, rel);
        for (const n of sentence.used) consumed.add(n);
      }
    }
    if (ts.isJsxText(node) && !isApi) {
      if (!consumed.has(node) && hasWords(node.text)) add(decode(jsxText(node.text)), rel);
    } else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !codeContext(node, isApi) && !insidePrompt(node)) {
      add(node.text, rel);
    } else if (ts.isTemplateExpression(node) && !codeContext(node, isApi) && !insidePrompt(node)) {
      const used = new Set();
      let t = node.head.text;
      for (const span of node.templateSpans) t += holeName(span.expression, used) + span.literal.text;
      if (hasWords(t.replace(/\{[A-Za-z0-9]+\}/g, ""))) add(t, rel);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

// State packs and guides (JSON): the words families read on the aid, grades and trades pages.
const PACK_SKIP_KEYS = /^(id|ids|url|urls|kind|version|status|slug|category|state|states|regions|type|courses|rounding|gpa_formula|levels|applies_to|stage|who|source_url|source|pay_source|cip|soc|onet|code|codes|unitid|zip|date|dates|opens|deadline|federal_deadline|corrections_deadline|icon|tone|key|keys|program|programs_ids|name|short|agency_name|abbr)$/;
function packStrings(v, key, rel) {
  if (typeof v === "string") {
    if (!PACK_SKIP_KEYS.test(key) && / /.test(v) && /[a-z]{3,}/.test(v) && !/^https?:/.test(v)) add(v, rel);
  } else if (Array.isArray(v)) v.forEach((x) => packStrings(x, key, rel));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) packStrings(x, k, rel);
}
const PACK_SCREEN = { federal: "app/aid/pack.json", states: "app/aid/pack.json", regions: "app/aid/pack.json", trades: "app/trades/pack.json" };
for (const dir of Object.keys(PACK_SCREEN)) {
  const d = join(root, "packs", dir);
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d).sort()) if (f.endsWith(".json")) packStrings(JSON.parse(readFileSync(join(d, f), "utf8")), "", PACK_SCREEN[dir]);
}

// Screens: the page folder a file belongs to (app/grades/record/page.tsx -> /grades/record).
function screenOf(file) {
  if (/^(lib\/(reminder-words|sms)\.ts|app\/api\/(cron\/reminders|cron\/progress|sms)\/)/.test(file)) return "Emails and texts";
  const m = file.match(/^app\/(.*?)(?:\/[^/]+)?\.(tsx|ts|json)$/);
  if (!m) return "Shared pieces";
  if (file.startsWith("lib/") || file.startsWith("core/")) return "Shared pieces";
  const dir = file.replace(/^app\//, "").replace(/\/[^/]+$/, "");
  if (!file.includes("/") || dir === file.replace(/^app\//, "")) return "Shared pieces";
  return "/" + dir.replace(/\(site\)\/?/, "").replace(/\[([^\]]+)\]/g, ":$1").replace(/^api\/.*$/, "messages") || "/";
}

// The Spanish so far.
const esDir = join(web, "lib/i18n/es");
const es = {};
if (existsSync(esDir)) for (const f of readdirSync(esDir).sort()) if (f.endsWith(".json")) Object.assign(es, JSON.parse(readFileSync(join(esDir, f), "utf8")));

const lines = [...out.entries()]
  .map(([en, e]) => {
    const fl = [...e.files].sort();
    const screens = [...new Set(fl.map(screenOf))].sort();
    return { en, screens, files: fl };
  })
  .sort((a, b) => a.screens[0].localeCompare(b.screens[0]) || a.files[0].localeCompare(b.files[0]) || a.en.localeCompare(b.en));

const json = JSON.stringify({ note: "Made by scripts/i18n/extract.mjs. Do not edit.", count: lines.length, lines: lines.map(({ en, screens }) => ({ en, screens })) }, null, 0).replace(/\},\{/g, "},\n{");

const missing = lines.filter((l) => !(l.en in es));

// Every {hole} and <1>tag</1> in the English must be in the Spanish, or a name or a link
// would vanish. Plural endings ({x}, {x2}) may be dropped, since Spanish words carry their own.
const parts = (s, re) => [...new Set(s.match(re) ?? [])];
const broken = Object.entries(es).filter(([en, sp]) => {
  if (sp === "=") return false;
  const holes = parts(en, /\{[A-Za-z0-9_]+\}/g).filter((h) => !/^\{x\d*\}$/.test(h));
  return holes.some((h) => !sp.includes(h)) || parts(en, /<\/?\d+>/g).some((t) => !sp.includes(t));
});
if (broken.length) {
  for (const [en, sp] of broken) console.error("Spanish line is missing a {part} or <tag>:\n  " + en + "\n  " + sp);
  if (process.argv.includes("--check")) process.exit(1);
}
if (process.argv.includes("--check")) {
  const now = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (now.trim() !== json.trim()) {
    console.error("apps/web/lib/i18n/lines.json is out of date. Run: node scripts/i18n/extract.mjs");
    process.exit(1);
  }
  console.log(`${lines.length} lines, ${lines.length - missing.length} in Spanish.`);
  process.exit(0);
}
writeFileSync(OUT, json + "\n");
if (process.argv.includes("--missing")) {
  const want = process.argv[process.argv.indexOf("--missing") + 1];
  for (const l of missing) if (!want || l.files.some((f) => f.includes(want))) console.log(JSON.stringify(l.en) + "  // " + l.files.join(", "));
}
console.log(`${lines.length} lines, ${lines.length - missing.length} in Spanish, ${missing.length} still English.`);
