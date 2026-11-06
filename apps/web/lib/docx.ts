// Makes a simple Word (.docx) file from a student's own essay draft, so they
// can keep working on it in Word, Google Docs or Pages. No library needed:
// a .docx is a zip of a few small XML files. Safe to import in the browser.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A zip file with the files stored as-is (no compression), which Word reads fine. */
export function makeZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, f.data.length, true); lv.setUint32(22, f.data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    const cen = new Uint8Array(46 + name.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, f.data.length, true); cv.setUint32(24, f.data.length, true);
    cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true);
    cen.set(name, 46);
    parts.push(local, f.data);
    central.push(cen);
    offset += local.length + f.data.length;
  }
  const cenSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, cenSize, true); ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + cenSize + 22);
  let p = 0;
  for (const part of [...parts, ...central, end]) { out.set(part, p); p += part.length; }
  return out;
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  // Characters Word's XML can't hold.
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

/** One Word paragraph; line breaks inside it stay as line breaks. */
function para(text: string, opts: { bold?: boolean; size?: number; italic?: boolean } = {}): string {
  const rpr = opts.bold || opts.size || opts.italic
    ? `<w:rPr>${opts.bold ? "<w:b/>" : ""}${opts.italic ? "<w:i/>" : ""}${opts.size ? `<w:sz w:val="${opts.size}"/>` : ""}</w:rPr>` : "";
  const runs = text.split("\n").map((line, i) => `${i ? "<w:r><w:br/></w:r>" : ""}<w:r>${rpr}<w:t xml:space="preserve">${esc(line)}</w:t></w:r>`).join("");
  return `<w:p>${runs}</w:p>`;
}

/** The bytes of a .docx: an optional bold title and note, then the text with one paragraph per blank-line block. */
export function makeDocx(text: string, opts: { title?: string; note?: string } = {}): Uint8Array {
  const enc = new TextEncoder();
  const body = [
    opts.title ? para(opts.title, { bold: true, size: 32 }) : "",
    opts.note ? para(opts.note, { italic: true, size: 20 }) : "",
    ...text.replace(/\r\n?/g, "\n").split(/\n{2,}/).map((p) => para(p.trim())),
  ].join("");
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  return makeZip([
    { name: "[Content_Types].xml", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`) },
    { name: "_rels/.rels", data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`) },
    { name: "word/document.xml", data: enc.encode(doc) },
  ]);
}

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Saves the draft as a Word file. On phones that can share files (iPhone,
 * Android), the share sheet opens so it can go to Files, Drive or Word;
 * otherwise the browser downloads it.
 */
export async function downloadDocx(text: string, fileName: string, opts: { title?: string; note?: string } = {}): Promise<void> {
  const name = `${fileName.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "My essay"}.docx`;
  const bytes = makeDocx(text, opts);
  const file = new File([bytes as Uint8Array<ArrayBuffer>], name, { type: DOCX_TYPE });
  const touch = typeof navigator !== "undefined" && /iPhone|iPad|Android|ScholarTasksApp/i.test(navigator.userAgent);
  if (touch && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if ((e as Error).name === "AbortError") return; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
