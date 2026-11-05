// Builds everything the presentation needs from the files in this folder.
//
//   node presentation/build.mjs            render changed slides, narrate changed text, rebuild the video
//   node presentation/build.mjs --check    only check that deck.json, slides/ and narration.json agree (CI runs this)
//   node presentation/build.mjs --dry      show what would be rebuilt and the ElevenLabs cost, change nothing
//   node presentation/build.mjs --share DIR   also copy the MP3s, all-slides.mp3 and the MP4 to DIR
//
// One-time setup: npm install --prefix presentation   (Playwright's Chromium and ffmpeg must be on the machine)
// Cloud session: NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node presentation/build.mjs
// (the api.elevenlabs.io key is injected by the network proxy; elsewhere set ELEVENLABS_API_KEY).
//
// Only slides whose HTML or pictures changed are re-rendered, and only slides whose narration text
// changed are sent to ElevenLabs (build-manifest.json remembers the hashes), so small edits cost little.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const pub = join(repo, 'apps/web/public/presentation');
const listFile = join(repo, 'apps/web/app/admin/presentation/slides.json');
const manifestFile = join(here, 'build-manifest.json');
const VOICE = 'Gfpl8Yo74Is0W6cPUWWT'; // ElevenLabs "Max"
const MODEL = 'eleven_multilingual_v2';
const GAP = 1.1; // seconds of silence after each slide in the video
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const DRY = args.includes('--dry');
const shareAt = args.indexOf('--share');
const SHARE = shareAt >= 0 ? args[shareAt + 1] : null;

const sha = (...parts) => { const h = createHash('sha256'); for (const p of parts) h.update(p); return h.digest('hex').slice(0, 16); };
const deck = JSON.parse(readFileSync(join(here, 'deck.json'), 'utf8'));
const narration = JSON.parse(readFileSync(join(here, 'narration.json'), 'utf8'));
const order = deck.order;

// ---- 1. Check that everything agrees -------------------------------------------------------
const problems = [];
const narr = new Map(narration.slides.map((s) => [s.id, s]));
for (const id of order) {
  const f = join(here, 'slides', `${id}.html`);
  if (!existsSync(f)) { problems.push(`slides/${id}.html is missing`); continue; }
  const html = readFileSync(f, 'utf8');
  if (!html.includes(`<section id="${id}"`)) problems.push(`slides/${id}.html: <section id> must be "${id}"`);
  for (const [, blob] of html.matchAll(/\/_blob\/([0-9a-f]+)/g)) if (!imageFor(blob)) problems.push(`slides/${id}.html uses /_blob/${blob} but images/ has no ${blob}.*`);
  const n = narr.get(id);
  if (!n) problems.push(`narration.json has no entry for "${id}"`);
  else if (!n.narration?.trim() || !n.title?.trim()) problems.push(`narration.json "${id}" needs a title and narration`);
  if (/\bpay\b/i.test(n?.title ?? '')) problems.push(`"${id}" title uses the word "Pay"; use Fund instead`);
  if (/sponsor/i.test(html + (n?.narration ?? ''))) problems.push(`"${id}" uses the word "sponsor"`);
}
for (const s of narration.slides) if (!order.includes(s.id)) problems.push(`narration.json has "${s.id}" but deck.json order does not`);
if (narration.slides.map((s) => s.id).join() !== order.join()) problems.push('narration.json must list the slides in the same order as deck.json');
for (const f of readdirSync(join(here, 'slides'))) if (!order.includes(f.replace(/\.html$/, ''))) problems.push(`slides/${f} is not in deck.json order (remove it or add it)`);
if (problems.length) { console.error('Presentation problems:\n- ' + problems.join('\n- ')); process.exit(1); }
if (CHECK) {
  // The admin page's slide list must match too.
  const list = existsSync(listFile) ? JSON.parse(readFileSync(listFile, 'utf8')) : null;
  if (!list || list.slides.map((s) => s.id).join() !== order.join()) { console.error('apps/web/app/admin/presentation/slides.json is out of date: run node presentation/build.mjs'); process.exit(1); }
  for (const id of order) for (const ext of ['jpg', 'mp3']) if (!existsSync(join(pub, `slide-${id}.${ext}`))) { console.error(`public/presentation/slide-${id}.${ext} is missing: run node presentation/build.mjs`); process.exit(1); }
  console.log(`Presentation OK: ${order.length} slides.`);
  process.exit(0);
}

function imageFor(blob) {
  const f = readdirSync(join(here, 'images')).find((n) => n.startsWith(blob + '.'));
  return f ? join(here, 'images', f) : null;
}

// ---- 2. Work out what changed --------------------------------------------------------------
const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : { slides: {} };
const plan = order.map((id) => {
  const html = readFileSync(join(here, 'slides', `${id}.html`), 'utf8');
  const pics = [...html.matchAll(/\/_blob\/([0-9a-f]+)/g)].map(([, b]) => readFileSync(imageFor(b)));
  const slideHash = sha(html, ...pics);
  const text = narr.get(id).narration;
  const narrationHash = sha(VOICE, MODEL, text);
  const old = manifest.slides[id] ?? {};
  return {
    id, html, text, slideHash, narrationHash,
    render: old.slideHash !== slideHash || !existsSync(join(pub, `slide-${id}.jpg`)),
    narrate: old.narrationHash !== narrationHash || !existsSync(join(pub, `slide-${id}.mp3`)),
  };
});
const toRender = plan.filter((p) => p.render);
const toNarrate = plan.filter((p) => p.narrate);
console.log(`Slides to render: ${toRender.map((p) => p.id).join(', ') || 'none'}`);
console.log(`Narration to make: ${toNarrate.map((p) => p.id).join(', ') || 'none'} (about ${toNarrate.reduce((n, p) => n + p.text.length, 0)} ElevenLabs credits)`);
if (DRY) process.exit(0);
mkdirSync(pub, { recursive: true });

// ---- 3. Render slide pictures (1920x1080 JPG) ----------------------------------------------
if (toRender.length) {
  const req = createRequire(join(here, 'package.json'));
  let chromium;
  try { ({ chromium } = req('playwright')); } catch { ({ chromium } = createRequire(import.meta.url)('playwright')); }
  const font = (pkg, file) => pathToFileURL(req.resolve(`${pkg}/files/${file}`)).href;
  const lucideDir = dirname(req.resolve('lucide-static/package.json'));
  const ICONS = { Chart: 'chart-column', CheckCircle: 'circle-check', Verified: 'badge-check' };
  const kebab = (n) => ICONS[n] ?? n.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  const icon = (name, style) => {
    const f = join(lucideDir, 'icons', `${kebab(name)}.svg`);
    if (!existsSync(f)) throw new Error(`No icon file for x-icon name="${name}" (looked for ${kebab(name)}.svg)`);
    return readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace('<svg', `<svg style="flex:none;${style}"`);
  };
  const head = `<meta charset="utf-8"><style>
@font-face{font-family:'Domine';src:url(${font('@fontsource-variable/domine', 'domine-latin-wght-normal.woff2')}) format('woff2');font-weight:400 700}
@font-face{font-family:'Nunito Sans';src:url(${font('@fontsource-variable/nunito-sans', 'nunito-sans-latin-wght-normal.woff2')}) format('woff2');font-weight:200 1000}
*{margin:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden;background:#000}
section{position:relative;width:1920px;height:1080px;overflow:hidden}
section>aside{display:none}
ul,ol{padding-left:1.25em}
li{padding-left:.15em}
a{color:inherit;text-decoration:none}
table{border-collapse:collapse;width:100%}
th,td{padding:12px 16px;text-align:left;vertical-align:top}
th{font-weight:800}
</style>`;
  const tmp = join(here, '.render');
  mkdirSync(tmp, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  for (const p of toRender) {
    const body = p.html
      .replace(/\/_blob\/([0-9a-f]+)/g, (_, b) => pathToFileURL(imageFor(b)).href)
      .replace(/<x-icon name="([^"]+)"(?: style="([^"]*)")?>\s*<\/x-icon>/g, (_, n, s = '') => icon(n, s));
    const f = join(tmp, `${p.id}.html`);
    writeFileSync(f, `<!doctype html><html><head>${head}</head><body>${body}</body></html>`);
    await page.goto(pathToFileURL(f).href);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(pub, `slide-${p.id}.jpg`), type: 'jpeg', quality: 90 });
    console.log('rendered', p.id);
  }
  await browser.close();
  rmSync(tmp, { recursive: true, force: true });
}

// ---- 4. Narrate changed slides with ElevenLabs ---------------------------------------------
const headers = { 'Content-Type': 'application/json', Accept: 'audio/mpeg' };
if (process.env.ELEVENLABS_API_KEY) headers['xi-api-key'] = process.env.ELEVENLABS_API_KEY;
for (const p of toNarrate) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST', headers, body: JSON.stringify({ text: p.text, model_id: MODEL }),
  });
  if (!res.ok) throw new Error(`ElevenLabs, slide ${p.id}: ${res.status} ${await res.text()}`);
  writeFileSync(join(pub, `slide-${p.id}.mp3`), Buffer.from(await res.arrayBuffer()));
  console.log('narrated', p.id);
}

// ---- 5. Video: each slide held for its narration plus a short pause ------------------------
const seconds = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
const video = join(pub, 'scholartasks-presentation.mp4');
const durations = order.map((id) => seconds(join(pub, `slide-${id}.mp3`)));
if (toRender.length || toNarrate.length || !existsSync(video) || order.join() !== (manifest.order ?? []).join()) {
  const work = join(here, '.video');
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  const parts = order.map((id, i) => {
    const out = join(work, `${String(i).padStart(2, '0')}.mp4`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-loop', '1', '-framerate', '30', '-i', join(pub, `slide-${id}.jpg`),
      '-i', join(pub, `slide-${id}.mp3`), '-af', `apad=pad_dur=${GAP}`, '-t', String(durations[i] + GAP),
      '-c:v', 'libx264', '-tune', 'stillimage', '-preset', 'medium', '-crf', '28', '-pix_fmt', 'yuv420p', '-r', '30',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', out]);
    console.log('video part', id);
    return out;
  });
  writeFileSync(join(work, 'list.txt'), parts.map((p) => `file '${p}'`).join('\n'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(work, 'list.txt'), '-c', 'copy', '-movflags', '+faststart', video]);
  rmSync(work, { recursive: true, force: true });
  console.log('made scholartasks-presentation.mp4');
}

// ---- 6. Remove pictures and audio of slides that left the deck -----------------------------
for (const f of readdirSync(pub)) {
  const m = f.match(/^slide-(.+)\.(jpg|mp3)$/);
  if (m && !order.includes(m[1])) { unlinkSync(join(pub, f)); console.log('removed', f); }
}

// ---- 7. Slide list for the admin page and the website ---------------------------------------
const total = durations.reduce((a, b) => a + b + GAP, 0);
writeFileSync(listFile, JSON.stringify({
  note: 'Made by presentation/build.mjs. Do not edit by hand.',
  minutes: Math.round(total / 60),
  slides: order.map((id) => ({ id, title: narr.get(id).title })),
}, null, 2) + '\n');
writeFileSync(manifestFile, JSON.stringify({
  note: 'Made by presentation/build.mjs: hashes of what was last rendered and narrated.',
  order,
  slides: Object.fromEntries(plan.map((p, i) => [p.id, { slideHash: p.slideHash, narrationHash: p.narrationHash, seconds: Math.round(durations[i] * 10) / 10 }])),
}, null, 2) + '\n');
console.log(`Done: ${order.length} slides, about ${Math.round(total / 60)} minutes.`);

// ---- 8. Optional copy to a shared folder ----------------------------------------------------
if (SHARE) {
  mkdirSync(join(SHARE, 'audio'), { recursive: true });
  const all = [];
  order.forEach((id, i) => {
    const name = `slide-${String(i + 1).padStart(2, '0')}-${id}.mp3`;
    copyFileSync(join(pub, `slide-${id}.mp3`), join(SHARE, 'audio', name));
    all.push(readFileSync(join(pub, `slide-${id}.mp3`)));
  });
  for (const f of readdirSync(join(SHARE, 'audio'))) {
    const m = f.match(/^slide-\d+-(.+)\.mp3$/);
    if (m && !order.some((id, i) => f === `slide-${String(i + 1).padStart(2, '0')}-${id}.mp3`)) unlinkSync(join(SHARE, 'audio', f));
  }
  writeFileSync(join(SHARE, 'audio', 'all-slides.mp3'), Buffer.concat(all));
  copyFileSync(video, join(SHARE, 'ScholarTasks-presentation-narrated.mp4'));
  console.log('copied to', SHARE);
}
