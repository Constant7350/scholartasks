// Photos and files a student adds to get help: a photo of their work, a PDF
// of the assignment, or their essay draft from Word. Everything is read in the
// browser first so uploads stay small. Safe to import in the browser.

export type Attachment =
  | { kind: "image"; name: string; dataUrl: string }
  | { kind: "pdf"; name: string; dataUrl: string }
  | { kind: "text"; name: string; text: string };

/** What the "Upload a file" button accepts. */
export const FILE_ACCEPT = "image/*,application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,text/plain,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.csv,text/csv,.doc,application/msword,.rtf,.odt,.ods,.odp,.xls,application/vnd.ms-excel,.xlsb,.numbers,.pages,.key,.pptx";
/** Biggest PDF we send (the server takes about 3.5 MB once encoded). */
export const MAX_PDF_BYTES = 2_500_000;
const MAX_TEXT_CHARS = 20000;

/** Shrinks a photo so it uploads fast and costs less to read. */
export async function shrinkPhoto(file: Blob, maxSide = 1600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That photo couldn't be opened. Try another one, or take a new photo."));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff"; // transparent PNGs read better on white
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const toDataUrl = (file: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(new Error("That file couldn't be read. Try again."));
  r.readAsDataURL(file);
});

/** Reads the files inside a zip (.docx and .xlsx files are zips) whose names pass the test. */
export async function unzipEntries(buf: ArrayBuffer, want: (name: string) => boolean): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  let end = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) return out;
  const count = dv.getUint16(end + 10, true);
  let p = dv.getUint32(end + 16, true);
  const dec = new TextDecoder();
  for (let n = 0; n < count && p + 46 <= u8.length; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), noteLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
    if (want(name) && (method === 0 || method === 8)) {
      const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const data = u8.slice(start, start + size);
      if (method === 0) out.set(name, data);
      else {
        const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        out.set(name, new Uint8Array(await new Response(stream).arrayBuffer()));
      }
    }
    p += 46 + nameLen + extraLen + noteLen;
  }
  return out;
}

/** Finds one file inside a zip and returns its bytes. */
export async function unzipEntry(buf: ArrayBuffer, name: string): Promise<Uint8Array | null> {
  return (await unzipEntries(buf, (n) => n === name)).get(name) ?? null;
}

const unescapeXml = (t: string) => t
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
  .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&amp;/g, "&");
const runText = (xml: string) => [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1]!)).join("");

/**
 * The cells of an Excel workbook as plain text, one line per row with each
 * cell's address (e.g. "A2 Emma | B2 93 (=B1*2)"), so the helper can talk
 * about a specific cell. Formulas are shown next to their values.
 */
export function workbookToText(files: Map<string, string>): string {
  const shared = [...(files.get("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => runText(m[1]!));
  const names = [...(files.get("xl/workbook.xml") ?? "").matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map((m) => unescapeXml(m[1]!));
  const sheets = [...files.keys()].filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
  const parts: string[] = [];
  sheets.forEach((key, i) => {
    const rows: string[] = [];
    for (const row of (files.get(key) ?? "").matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const c of row[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1]!, body = c[2] ?? "";
        const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1] ?? "";
        const type = /\bt="(\w+)"/.exec(attrs)?.[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        const f = /<f\b[^>]*>([\s\S]*?)<\/f>/.exec(body)?.[1];
        let value = type === "s" ? shared[Number(v)] ?? "" : type === "inlineStr" ? runText(body) : v !== undefined ? unescapeXml(v) : "";
        if (type === "b") value = value === "1" ? "TRUE" : "FALSE";
        if (f) value = `${value} (=${unescapeXml(f)})`.trim();
        if (value.trim()) cells.push(`${ref} ${value.trim()}`);
      }
      if (cells.length) rows.push(cells.join(" | "));
    }
    if (rows.length) parts.push(`${sheets.length > 1 ? `Sheet "${names[i] ?? i + 1}":\n` : ""}${rows.join("\n")}`);
  });
  return parts.join("\n\n");
}

/** The plain text of a Word document's body, one blank line between paragraphs. */
export function wordXmlToText(xml: string): string {
  // Deleted text from tracked changes is not part of the draft.
  const body = xml.replace(/<w:delText\b[^>]*>[\s\S]*?<\/w:delText>/g, "");
  return body
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:(?:br|cr)\b[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** An OpenDocument text or slides file's content.xml as plain text. */
export function odfXmlToText(xml: string): string {
  return unescapeXml(xml
    .replace(/<text:tab\/>/g, "\t")
    .replace(/<text:line-break\/>/g, "\n")
    .replace(/<text:s(?:\s+text:c="(\d+)")?\/>/g, (_, n?: string) => " ".repeat(Number(n ?? 1)))
    .replace(/<\/text:(?:p|h)>/g, "\n\n")
    .replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** The words on each PowerPoint slide, in order. */
export function slidesToText(files: Map<string, string>): string {
  return [...files.keys()].filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]))
    .map((k, i) => {
      const lines = files.get(k)!.split(/<\/a:p>/).map((p) => [...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => unescapeXml(m[1]!)).join("")).filter((l) => l.trim());
      return lines.length ? `Slide ${i + 1}:\n${lines.join("\n")}` : "";
    }).filter(Boolean).join("\n\n");
}

/** Plain text from an RTF file (WordPad, TextEdit). Skips fonts, colors, pictures and other hidden parts. */
export function rtfToText(rtf: string): string {
  const SKIP = /^(fonttbl|colortbl|stylesheet|info|pict|header|footer|headerl|headerr|footerl|footerr|listtable|listoverridetable|rsidtbl|generator|xmlnstbl|themedata|colorschememapping|latentstyles|datastore)$/;
  let out = "";
  const stack: boolean[] = [];
  let skip = false;
  for (let i = 0; i < rtf.length; i++) {
    const ch = rtf[i]!;
    if (ch === "{") { stack.push(skip); continue; }
    if (ch === "}") { skip = stack.pop() ?? false; continue; }
    if (ch === "\\") {
      const next = rtf[i + 1] ?? "";
      if (next === "*") { skip = true; i++; continue; }
      if (next === "'") { if (!skip) out += String.fromCharCode(parseInt(rtf.slice(i + 2, i + 4), 16)); i += 3; continue; }
      if (/[\\{}]/.test(next)) { if (!skip) out += next; i++; continue; }
      const m = /^([a-z]+)(-?\d+)? ?/i.exec(rtf.slice(i + 1));
      if (!m) { i++; continue; }
      i += m[0].length;
      const word = m[1]!;
      if (SKIP.test(word)) skip = true;
      else if (!skip) {
        if (word === "par" || word === "line") out += "\n";
        else if (word === "tab") out += "\t";
        else if (word === "u" && m[2]) {
          out += String.fromCharCode((Number(m[2]) + 65536) % 65536);
          // Skip the plain-text stand-in that follows (one character or one \'hh).
          i += rtf[i + 1] === "\\" && rtf[i + 2] === "'" ? 4 : 1;
        }
      }
      continue;
    }
    if (ch === "\r" || ch === "\n") continue;
    if (!skip) out += ch;
  }
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Older and other spreadsheets (.xls, .xlsb, .ods, Apple Numbers) read with SheetJS, loaded only when needed. */
export async function sheetJsText(file: File): Promise<string> {
  const XLSX = await import("@e965/xlsx");
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array", cellFormula: true, cellDates: true });
  const parts: string[] = [];
  for (const sheet of wb.SheetNames) {
    const ws = wb.Sheets[sheet];
    if (!ws?.["!ref"]) continue;
    const range = XLSX.utils.decode_range(ws["!ref"]);
    const rows: string[] = [];
    for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 1000); r++) {
      const cells: string[] = [];
      for (let c = range.s.c; c <= Math.min(range.e.c, range.s.c + 60); c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr] as { v?: unknown; w?: string; f?: string } | undefined;
        if (!cell) continue;
        let value = (cell.w ?? (cell.v === undefined ? "" : String(cell.v))).trim();
        if (cell.f) value = `${value} (=${cell.f})`.trim();
        if (value) cells.push(`${addr} ${value}`);
      }
      if (cells.length) rows.push(cells.join(" | "));
    }
    if (rows.length) parts.push(`${wb.SheetNames.length > 1 ? `Sheet "${sheet}":\n` : ""}${rows.join("\n")}`);
  }
  return parts.join("\n\n");
}

/** Old Word (.doc) files are turned into text on our server; nothing is saved. */
async function convertOnServer(file: File): Promise<string> {
  if (file.size > 2_500_000) throw new Error("That file is too big. Save it as a PDF with only the pages you need, or copy and paste the text.");
  const dataUrl = await toDataUrl(file);
  const { supabase } = await import("./supabase");
  const sb = supabase();
  const { data } = sb ? await sb.auth.getSession() : { data: { session: null } };
  const res = await fetch("/api/convert-file", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify({ name: file.name, data: dataUrl.slice(dataUrl.indexOf(",") + 1) }),
  });
  const out = (await res.json().catch(() => null)) as { text?: string; error?: string } | null;
  if (!res.ok || !out?.text) throw new Error(out?.error ?? "That file couldn't be opened. Save it as a PDF and try again, or copy and paste the text.");
  return out.text;
}

/** Reads a picked file into something we can show and send. Throws a friendly message if it won't work. */
export async function readAttachment(file: File, opts: { pdf?: boolean } = {}): Promise<Attachment> {
  const name = file.name || "file";
  const lower = name.toLowerCase();
  if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/.test(lower)) {
    try {
      return { kind: "image", name, dataUrl: await shrinkPhoto(file) };
    } catch (e) {
      if (/\.hei[cf]$/.test(lower)) throw new Error("This computer can't open iPhone (HEIC) photos. Send the photo from the phone instead, or take a new photo here.");
      throw e;
    }
  }
  if (file.type === "application/pdf" || lower.endsWith(".pdf")) {
    if (opts.pdf === false) throw new Error("PDFs can't be used here. Take a photo instead.");
    if (file.size > MAX_PDF_BYTES) throw new Error("That PDF is too big. Send only the pages you need (or take a photo of them).");
    const dataUrl = await toDataUrl(file);
    return { kind: "pdf", name, dataUrl: dataUrl.replace(/^data:[^;]*;/, "data:application/pdf;") };
  }
  if (lower.endsWith(".docx")) {
    const xml = await unzipEntry(await file.arrayBuffer(), "word/document.xml").catch(() => null);
    const text = xml ? wordXmlToText(new TextDecoder().decode(xml)) : "";
    if (!text) throw new Error("That Word file couldn't be read. Save it as a PDF and try again, or copy and paste the text.");
    return { kind: "text", name, text: text.slice(0, MAX_TEXT_CHARS) };
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) {
    const entries = await unzipEntries(await file.arrayBuffer(), (n) => n === "xl/sharedStrings.xml" || n === "xl/workbook.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).catch(() => new Map<string, Uint8Array>());
    const dec = new TextDecoder();
    const text = workbookToText(new Map([...entries].map(([k, v]) => [k, dec.decode(v)])));
    if (!text) throw new Error("That Excel file couldn't be read, or it's empty. Save it as a PDF and try again, or take a photo of the screen.");
    return { kind: "text", name, text: text.slice(0, MAX_TEXT_CHARS) };
  }
  if (file.type.startsWith("text/") || lower.endsWith(".txt") || lower.endsWith(".csv")) {
    const text = (await file.text()).trim();
    if (!text) throw new Error("That file is empty.");
    return { kind: "text", name, text: text.slice(0, MAX_TEXT_CHARS) };
  }
  // Everything below is converted automatically, so students never have to re-save a file.
  const asText = (text: string, what: string): Attachment => {
    if (!text.trim()) throw new Error(`That ${what} couldn't be read, or it's empty. Save it as a PDF and try again, or take a photo of it.`);
    return { kind: "text", name, text: text.slice(0, MAX_TEXT_CHARS) };
  };
  if (lower.endsWith(".doc") || lower.endsWith(".dot")) return asText(await convertOnServer(file), "Word file");
  if (lower.endsWith(".rtf")) return asText(rtfToText(await file.text()), "file");
  if (lower.endsWith(".odt") || lower.endsWith(".odp")) {
    const xml = await unzipEntry(await file.arrayBuffer(), "content.xml").catch(() => null);
    return asText(xml ? odfXmlToText(new TextDecoder().decode(xml)) : "", "file");
  }
  if (lower.endsWith(".pptx")) {
    const entries = await unzipEntries(await file.arrayBuffer(), (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).catch(() => new Map<string, Uint8Array>());
    const dec = new TextDecoder();
    return asText(slidesToText(new Map([...entries].map(([k, v]) => [k, dec.decode(v)]))), "PowerPoint file");
  }
  if (/\.(xls|xlsb|ods|numbers)$/.test(lower)) return asText(await sheetJsText(file).catch(() => ""), "spreadsheet");
  if (lower.endsWith(".pages") || lower.endsWith(".key")) {
    // Apple Pages and Keynote files carry a preview of the document; use that.
    const entries = await unzipEntries(await file.arrayBuffer(), (n) => /^(QuickLook\/Preview\.pdf|QuickLook\/Thumbnail\.jpg|preview\.jpg|preview-web\.jpg)$/i.test(n)).catch(() => new Map<string, Uint8Array>());
    const pdf = [...entries].find(([k]) => /\.pdf$/i.test(k))?.[1];
    if (pdf && opts.pdf !== false && pdf.length <= MAX_PDF_BYTES) return { kind: "pdf", name, dataUrl: await toDataUrl(new Blob([pdf as Uint8Array<ArrayBuffer>], { type: "application/pdf" })) };
    const jpg = entries.get("preview.jpg") ?? entries.get("QuickLook/Thumbnail.jpg") ?? entries.get("preview-web.jpg");
    if (jpg) return { kind: "image", name, dataUrl: await shrinkPhoto(new Blob([jpg as Uint8Array<ArrayBuffer>], { type: "image/jpeg" })) };
    throw new Error("That Pages or Keynote file couldn't be read. In Pages: File, then Export To, then PDF or Word.");
  }
  throw new Error("That kind of file can't be read here. Use a photo, a PDF, or a Word, Excel or PowerPoint file.");
}
