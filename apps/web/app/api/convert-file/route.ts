import { createClient } from "@supabase/supabase-js";
import WordExtractor from "word-extractor";

// Turns an old Word (.doc) file into plain text so a student can use it with
// the Homework Helper or an essay coach without re-saving it. No AI is used
// and nothing is stored: the file is read in memory and only the text goes back.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_CHARS = 3_500_000; // base64
const json = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return json(503, "File conversion isn't switched on yet.");
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, "Please sign in again.");

  let body: { name?: unknown; data?: unknown };
  try { body = await req.json(); } catch { return json(400, "Something went wrong. Please try again."); }
  const name = typeof body.name === "string" ? body.name.toLowerCase() : "";
  const data = typeof body.data === "string" ? body.data : "";
  if (!/\.(doc|dot)$/.test(name)) return json(400, "Only old Word (.doc) files are converted here.");
  if (!data || data.length > MAX_CHARS || !/^[A-Za-z0-9+/=]+$/.test(data)) return json(400, "That file is too big or couldn't be read.");

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: user, error } = await sb.auth.getUser(token);
  if (error || !user.user) return json(401, "Please sign in again.");

  try {
    const doc = await new WordExtractor().extract(Buffer.from(data, "base64"));
    const text = doc.getBody().replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!text) return json(422, "That Word file looks empty. Save it as a PDF and try again, or copy and paste the text.");
    return Response.json({ text: text.slice(0, 20000) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("convert-file failed", (e as Error).message);
    return json(422, "That Word file couldn't be opened. Save it as a PDF and try again, or copy and paste the text.");
  }
}
