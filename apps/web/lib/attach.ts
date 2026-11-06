// Photos and files a student adds to get help: a photo of their work, a PDF
// of the assignment, or their essay draft from Word. Everything is read in the
// browser first so uploads stay small. Safe to import in the browser.

export type Attachment =
  | { kind: "image"; name: string; dataUrl: string }
  | { kind: "pdf"; name: string; dataUrl: string }
  | { kind: "text"; name: string; text: string };

/** What the "Upload a file" button accepts. */
export const FILE_ACCEPT = "image/*,application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,text/plain";
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

/** Finds one file inside a zip (a .docx is a zip) and returns its bytes. */
export async function unzipEntry(buf: ArrayBuffer, name: string): Promise<Uint8Array | null> {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  let end = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) return null;
  const count = dv.getUint16(end + 10, true);
  let p = dv.getUint32(end + 16, true);
  const dec = new TextDecoder();
  for (let n = 0; n < count && p + 46 <= u8.length; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) return null;
    const method = dv.getUint16(p + 10, true);
    const size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), noteLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    if (dec.decode(u8.subarray(p + 46, p + 46 + nameLen)) === name) {
      const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const data = u8.slice(start, start + size);
      if (method === 0) return data;
      if (method !== 8) return null;
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    p += 46 + nameLen + extraLen + noteLen;
  }
  return null;
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
  if (file.type.startsWith("text/") || lower.endsWith(".txt")) {
    const text = (await file.text()).trim();
    if (!text) throw new Error("That file is empty.");
    return { kind: "text", name, text: text.slice(0, MAX_TEXT_CHARS) };
  }
  if (lower.endsWith(".doc") || lower.endsWith(".pages") || lower.endsWith(".odt")) {
    throw new Error("That kind of file can't be read here. Save it as a Word (.docx) file or a PDF and try again. In Google Docs: File, then Download, then Microsoft Word.");
  }
  throw new Error("That kind of file can't be read here. Use a photo, a PDF, or a Word (.docx) file.");
}
