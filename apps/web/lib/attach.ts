// Photos and files a student adds to get help: a photo of their work, a PDF
// of the assignment, or their essay draft from Word. Everything is read in the
// browser first so uploads stay small. Safe to import in the browser.

export type Attachment =
  | { kind: "image"; name: string; dataUrl: string }
  | { kind: "pdf"; name: string; dataUrl: string }
  | { kind: "text"; name: string; text: string };

/** What the "Upload a file" button accepts. */
export const FILE_ACCEPT = "image/*,application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,text/plain,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.csv,text/csv";
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

/** Reads a picked file into something we can show and send. Throws a friendly message if it won't work. */
export async function readAttachment(file: File, opts: { pdf?: boolean } = {}): Promise<Attachment> {
  const name = file.name || "file";
  const lower = name.toLowerCase();
  if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|gif)$/.test(lower)) {
    return { kind: "image", name, dataUrl: await shrinkPhoto(file) };
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
  if (lower.endsWith(".doc") || lower.endsWith(".pages") || lower.endsWith(".odt")) {
    throw new Error("That kind of file can't be read here. Save it as a Word (.docx) file or a PDF and try again. In Google Docs: File, then Download, then Microsoft Word.");
  }
  if (lower.endsWith(".xls") || lower.endsWith(".numbers") || lower.endsWith(".ods")) {
    throw new Error("That kind of spreadsheet can't be read here. Save it as an Excel (.xlsx) file and try again. In Google Sheets: File, then Download, then Microsoft Excel.");
  }
  throw new Error("That kind of file can't be read here. Use a photo, a PDF, a Word (.docx) file or an Excel (.xlsx) file.");
}
