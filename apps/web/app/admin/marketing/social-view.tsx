"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { friendly } from "../../../lib/supabase";
import { StatusPill, whenOf } from "../review-kit";
import { CONSENT_TEMPLATE, NETWORKS, POST_NETWORKS, SOCIAL_TIPS, TOPICS, mondayOf, type Network } from "./social";

/**
 * The "Social media" tab on /admin/marketing: weekly AI-written short-video scripts
 * and written posts, the finished videos, who is on camera (with a parent's
 * permission for students), and the weekly writer's settings. Tables from
 * database update 56. Nothing is posted by itself.
 */
type Status = "draft" | "approved" | "filmed" | "scheduled" | "posted" | "skip";
interface Item {
  id: string; kind: "video" | "post"; network: Network; week_of: string; topic: string | null; title: string;
  hook: string | null; body: string; caption: string | null; hashtags: string | null; shot_notes: string | null;
  status: Status; person_id: string | null; video_path: string | null; video_link: string | null; post_on: string | null;
  post_url: string | null; posted_at: string | null; note: string | null; ai_written: boolean; updated_at: string;
}
interface Person { id: string; name: string; is_minor: boolean; parent_name: string | null; consent_on: string | null; consent_note: string | null; active: boolean }
interface Settings { auto_weekly: boolean; videos_per_week: number; networks: Network[]; host_note: string; focus_note: string | null }

const LABEL: Record<Status, string> = { draft: "Draft", approved: "Approved", filmed: "Filmed", scheduled: "Scheduled", posted: "Posted", skip: "Skipped" };
const VIDEO_FLOW: Status[] = ["draft", "approved", "filmed", "scheduled", "posted"];
const POST_FLOW: Status[] = ["draft", "approved", "scheduled", "posted"];
const pillOf = (s: Status) => (s === "posted" ? "ok" : s === "draft" || s === "skip" ? "off" : "wait");
const topicLabel = (id: string | null) => TOPICS.find((t) => t.id === id)?.label;
const weekLabel = (w: string) => `Week of ${new Date(`${w}T12:00:00`).toLocaleDateString([], { month: "long", day: "numeric" })}`;
const consentOk = (p?: Person) => !!p && (!p.is_minor || !!p.consent_on);

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export function Social({ sb }: { sb: SupabaseClient }) {
  const [items, setItems] = useState<Item[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState("");
  const [which, setWhich] = useState<"this" | "next">("this");
  const [week, setWeek] = useState<string>(mondayOf(new Date()));
  const [show, setShow] = useState<"week" | "todo">("week");

  const load = useCallback(async () => {
    const [i, p, s] = await Promise.all([
      sb.from("social_items").select("*").order("week_of", { ascending: false }).order("kind", { ascending: false }).order("created_at").limit(400),
      sb.from("social_people").select("*").order("created_at"),
      sb.from("social_settings").select("auto_weekly, videos_per_week, networks, host_note, focus_note").maybeSingle(),
    ]);
    if (i.error) { if (/social_items/.test(i.error.message)) setNeedsUpdate(true); else setError(friendly(i.error)); return; }
    setItems((i.data as Item[]) ?? []);
    setPeople((p.data as Person[]) ?? []);
    if (s.data) setSettings(s.data as Settings);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  const weeks = useMemo(() => {
    const all = new Set(items.map((x) => x.week_of));
    all.add(mondayOf(new Date()));
    return [...all].sort().reverse();
  }, [items]);

  const call = async (path: string, body: object) => {
    const { data: s } = await sb.auth.getSession();
    const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${s.session?.access_token ?? ""}` }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error ?? "Something went wrong.");
    return j;
  };

  const write = async (only?: "videos" | "posts") => {
    setBusy(true); setError(null); setMsg(null);
    try {
      const j = await call("/api/social/write", { week: which, focus, only });
      setMsg(`✓ ${j.added} new drafts for the ${weekLabel(j.weekOf).toLowerCase()}. Read each one before it goes out.`);
      setWeek(j.weekOf); setShow("week"); setFocus("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    setBusy(false);
  };

  const patch = async (id: string, fields: Partial<Item>) => {
    setError(null);
    const before = items;
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...fields } : x)));
    const { data, error: e } = await sb.from("social_items").update(fields).eq("id", id).select("*").single();
    if (e) { setItems(before); setError(friendly(e)); return false; }
    setItems((xs) => xs.map((x) => (x.id === id ? (data as Item) : x)));
    return true;
  };
  const remove = async (it: Item) => {
    if (it.video_path) await sb.storage.from("social-videos").remove([it.video_path]);
    const { error: e } = await sb.from("social_items").delete().eq("id", it.id);
    if (e) setError(friendly(e)); else setItems((xs) => xs.filter((x) => x.id !== it.id));
  };
  const addBlank = async (kind: "video" | "post") => {
    const { data, error: e } = await sb.from("social_items").insert({ kind, network: kind === "video" ? "tiktok" : "facebook", week_of: week, title: kind === "video" ? "New video" : "New post", body: "" }).select("*").single();
    if (e) setError(friendly(e)); else setItems((xs) => [...xs, data as Item]);
  };

  if (needsUpdate) return <p className="note" role="status">Run <b>database update 56</b> in Supabase to turn on the Social media section.</p>;

  const todo = items.filter((x) => !["posted", "skip"].includes(x.status));
  const shown = show === "todo" ? todo : items.filter((x) => x.week_of === week);
  const videos = shown.filter((x) => x.kind === "video");
  const posts = shown.filter((x) => x.kind === "post");
  const thisWeek = items.filter((x) => x.week_of === mondayOf(new Date()));

  return (
    <>
      {error && <p className="note note-err" role="alert">{error}</p>}
      {msg && <p className="note" role="status">{msg}</p>}

      <section className="panel">
        <h2>This week on social media</h2>
        <div className="mk-stats">
          <Count label="Videos to film" value={thisWeek.filter((x) => x.kind === "video" && ["draft", "approved"].includes(x.status)).length} />
          <Count label="Videos ready to post" value={thisWeek.filter((x) => x.kind === "video" && ["filmed", "scheduled"].includes(x.status)).length} />
          <Count label="Posts to put up" value={thisWeek.filter((x) => x.kind === "post" && !["posted", "skip"].includes(x.status)).length} />
          <Count label="Posted this week" value={thisWeek.filter((x) => x.status === "posted").length} />
        </div>
        <h3 style={{ marginTop: 16 }}>Ask the AI to write</h3>
        <p className="hint">{settings?.auto_weekly === false ? "The Monday writer is off, so use this button." : "New drafts are written by themselves every Monday morning. Use this for more, or for next week."} Scripts are easy for any student to film with a phone.</p>
        <div className="field" style={{ margin: "0 0 8px" }}>
          <label htmlFor="sm-focus">Anything special to cover? (optional)</label>
          <input id="sm-focus" className="input" maxLength={600} placeholder="For example: FAFSA tips for parents, or a funny one about deadlines" value={focus} onChange={(e) => setFocus(e.target.value)} />
        </div>
        <div className="share-row" style={{ alignItems: "center" }}>
          <select className="input input-sm" value={which} onChange={(e) => setWhich(e.target.value as "this" | "next")} aria-label="Which week">
            <option value="this">This week</option>
            <option value="next">Next week</option>
          </select>
          <button className="btn btn-inline" disabled={busy} onClick={() => void write()}>{busy ? "Writing… (about a minute)" : "Write scripts and posts"}</button>
          <button className="btn btn-inline btn-ghost btn-sm" disabled={busy} onClick={() => void write("videos")}>Only video scripts</button>
          <button className="btn btn-inline btn-ghost btn-sm" disabled={busy} onClick={() => void write("posts")}>Only written posts</button>
        </div>
      </section>

      <nav className="review-nav" aria-label="Which drafts">
        <a href="#todo" aria-current={show === "todo" ? "page" : undefined} onClick={(e) => { e.preventDefault(); setShow("todo"); }}>Everything not posted yet ({todo.length})</a>
        {weeks.slice(0, 8).map((w) => (
          <a key={w} href={`#${w}`} aria-current={show === "week" && week === w ? "page" : undefined} onClick={(e) => { e.preventDefault(); setShow("week"); setWeek(w); }}>{weekLabel(w)}</a>
        ))}
      </nav>

      <section className="panel">
        <h2>🎬 Short videos <span className="hint" style={{ fontWeight: 400 }}>· TikTok, Instagram Reels, YouTube Shorts</span></h2>
        {videos.length === 0 && <p className="hint">No video scripts here yet. Press "Write scripts and posts" above.</p>}
        {videos.map((it) => <ItemCard key={it.id} it={it} sb={sb} people={people} onPatch={patch} onRemove={remove} onRewrite={async (ask) => { const j = await call("/api/social/rewrite", { id: it.id, ask }); setItems((xs) => xs.map((x) => (x.id === it.id ? j.item : x))); }} />)}
        {show === "week" && <button className="btn btn-inline btn-ghost btn-sm" onClick={() => void addBlank("video")}>+ Add my own video idea</button>}
      </section>

      <section className="panel">
        <h2>✍️ Written posts <span className="hint" style={{ fontWeight: 400 }}>· Facebook, Instagram, X, Nextdoor and more</span></h2>
        {posts.length === 0 && <p className="hint">No written posts here yet.</p>}
        {posts.map((it) => <ItemCard key={it.id} it={it} sb={sb} people={people} onPatch={patch} onRemove={remove} onRewrite={async (ask) => { const j = await call("/api/social/rewrite", { id: it.id, ask }); setItems((xs) => xs.map((x) => (x.id === it.id ? j.item : x))); }} />)}
        {show === "week" && <button className="btn btn-inline btn-ghost btn-sm" onClick={() => void addBlank("post")}>+ Add my own post</button>}
      </section>

      <PeoplePanel sb={sb} people={people} setPeople={setPeople} setError={setError} />
      {settings && <SettingsPanel sb={sb} settings={settings} setSettings={setSettings} setError={setError} />}

      <section className="panel">
        <h2>Tips and rules</h2>
        <ul className="mk-list">{SOCIAL_TIPS.map((t) => <li key={t}>{t}</li>)}</ul>
      </section>
    </>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return <div className="mk-stat"><span className="mk-stat-value">{value}</span><span className="mk-stat-label">{label}</span></div>;
}

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return <button className="btn btn-inline btn-ghost btn-sm" onClick={async () => { if (await copy(text)) { setDone(true); setTimeout(() => setDone(false), 1500); } }}>{done ? "✓ Copied" : label}</button>;
}

function ItemCard({ it, sb, people, onPatch, onRemove, onRewrite }: {
  it: Item; sb: SupabaseClient; people: Person[];
  onPatch: (id: string, f: Partial<Item>) => Promise<boolean>; onRemove: (it: Item) => Promise<void>; onRewrite: (ask: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(it.status === "draft" || it.status === "approved");
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(it);
  const [ask, setAsk] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [link, setLink] = useState(it.post_url ?? "");
  useEffect(() => { setDraft(it); setLink(it.post_url ?? ""); }, [it]);
  const isVideo = it.kind === "video";
  const person = people.find((p) => p.id === it.person_id);
  const flow = isVideo ? VIDEO_FLOW : POST_FLOW;
  const net = NETWORKS[it.network];
  const fullCaption = [isVideo ? it.caption : it.body, it.hashtags].filter(Boolean).join("\n\n");

  const setStatus = async (s: Status) => {
    setErr(null);
    if (isVideo && (s === "scheduled" || s === "posted") && person && !consentOk(person)) {
      setErr(`Add ${person.name}'s parent permission under People on camera first.`); return;
    }
    await onPatch(it.id, { status: s });
  };
  const upload = async (f: File) => {
    setErr(null);
    if (f.size > 50 * 1024 * 1024) { setErr("That file is over 50 MB. Paste a Google Drive or Dropbox link instead."); return; }
    setWorking("Uploading…");
    const path = `${it.week_of}/${it.id}-${Date.now()}.${(f.name.split(".").pop() ?? "mp4").toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    const up = await sb.storage.from("social-videos").upload(path, f, { contentType: f.type, upsert: false });
    if (up.error) setErr(friendly(up.error));
    else {
      const old = it.video_path;
      if (await onPatch(it.id, { video_path: path, status: it.status === "draft" || it.status === "approved" ? "filmed" : it.status }) && old) await sb.storage.from("social-videos").remove([old]);
    }
    setWorking(null);
  };
  const openVideo = async (download: boolean) => {
    if (!it.video_path) return;
    const { data, error } = await sb.storage.from("social-videos").createSignedUrl(it.video_path, 600, download ? { download: true } : undefined);
    if (error || !data) setErr(friendly(error)); else window.open(data.signedUrl, "_blank", "noopener");
  };
  const rewrite = async () => {
    if (!ask.trim()) return;
    setErr(null); setWorking("Rewriting… (about 20 seconds)");
    try { await onRewrite(ask); setAsk(""); } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); }
    setWorking(null);
  };
  const saveEdit = async () => {
    const f: Partial<Item> = { title: draft.title.trim() || it.title, hook: draft.hook || null, body: draft.body, caption: draft.caption || null, hashtags: draft.hashtags || null, shot_notes: draft.shot_notes || null, network: draft.network };
    if (await onPatch(it.id, f)) setEdit(false);
  };

  return (
    <div className={`mk-step ${it.status === "posted" || it.status === "skip" ? "mk-step-done" : ""}`}>
      <div className="mk-step-head">
        <b style={{ cursor: "pointer" }} onClick={() => setOpen(!open)}>{it.status === "posted" ? "✓ " : ""}{it.title}</b>
        <span><span className="pill">{net.label}</span><StatusPill status={pillOf(it.status)} label={LABEL[it.status]} /></span>
      </div>
      <p className="hint" style={{ margin: "4px 0" }}>
        {topicLabel(it.topic) ? `${topicLabel(it.topic)} · ` : ""}{it.ai_written ? "Written by AI, a person must check it" : "Written by our team"}
        {isVideo && (person ? ` · On camera: ${person.name}${consentOk(person) ? "" : " (parent permission missing)"}` : "")}
        {it.posted_at ? ` · Posted ${whenOf(it.posted_at)}` : ""}
        {" · "}<button className="btn-link" onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"}</button>
      </p>
      {open && !edit && (
        <div style={{ display: "grid", gap: 8, margin: "6px 0 10px" }}>
          {isVideo && it.hook && <p style={{ margin: 0 }}><b>Hook:</b> {it.hook}</p>}
          {it.body && <div style={{ whiteSpace: "pre-wrap", background: "var(--warm-tint)", borderRadius: 10, padding: 10 }}>{isVideo && <b>Script{"\n"}</b>}{it.body}</div>}
          {isVideo && it.shot_notes && <p className="hint" style={{ margin: 0, whiteSpace: "pre-wrap" }}><b>How to film it:</b> {it.shot_notes}</p>}
          {isVideo && it.caption && <p style={{ margin: 0 }}><b>Caption:</b> {it.caption}</p>}
          {it.hashtags && <p className="hint" style={{ margin: 0 }}>{it.hashtags}</p>}
          <div className="share-row">
            {isVideo && it.body && <CopyBtn text={[it.hook && `HOOK: ${it.hook}`, it.body, it.shot_notes && `HOW TO FILM IT: ${it.shot_notes}`].filter(Boolean).join("\n\n")} label="Copy script" />}
            {fullCaption && <CopyBtn text={fullCaption} label={isVideo ? "Copy caption" : "Copy post"} />}
            <a className="btn btn-inline btn-ghost btn-sm" href={net.open} target="_blank" rel="noreferrer">Open {net.label}</a>
            <button className="btn btn-inline btn-ghost btn-sm" onClick={() => setEdit(true)}>Edit</button>
          </div>
        </div>
      )}
      {open && edit && (
        <div style={{ display: "grid", gap: 8, margin: "6px 0 10px" }}>
          <input className="input" aria-label="Title" maxLength={200} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <select className="input input-sm" aria-label="Where it goes" value={draft.network} onChange={(e) => setDraft({ ...draft, network: e.target.value as Network })}>
            {(Object.keys(NETWORKS) as Network[]).filter((n) => NETWORKS[n].kind === it.kind).map((n) => <option key={n} value={n}>{NETWORKS[n].label}</option>)}
          </select>
          {isVideo && <input className="input" aria-label="Hook" placeholder="Hook (first 2 seconds)" maxLength={400} value={draft.hook ?? ""} onChange={(e) => setDraft({ ...draft, hook: e.target.value })} />}
          <textarea className="input" aria-label={isVideo ? "Script" : "Post"} rows={8} maxLength={8000} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          {isVideo && <textarea className="input" aria-label="How to film it" placeholder="How to film it" rows={3} maxLength={2000} value={draft.shot_notes ?? ""} onChange={(e) => setDraft({ ...draft, shot_notes: e.target.value })} />}
          {isVideo && <textarea className="input" aria-label="Caption" placeholder="Caption" rows={2} maxLength={2200} value={draft.caption ?? ""} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} />}
          <input className="input" aria-label="Hashtags" placeholder="#hashtags" maxLength={500} value={draft.hashtags ?? ""} onChange={(e) => setDraft({ ...draft, hashtags: e.target.value })} />
          <div className="share-row">
            <button className="btn btn-inline btn-sm" onClick={() => void saveEdit()}>Save</button>
            <button className="btn btn-inline btn-ghost btn-sm" onClick={() => { setDraft(it); setEdit(false); }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="share-row" style={{ alignItems: "center" }}>
        {flow.map((s) => <button key={s} className={`btn btn-inline btn-sm ${it.status === s ? "" : "btn-ghost"}`} aria-pressed={it.status === s} onClick={() => void setStatus(s)}>{LABEL[s]}</button>)}
        <button className={`btn btn-inline btn-sm ${it.status === "skip" ? "" : "btn-ghost"}`} aria-pressed={it.status === "skip"} onClick={() => void setStatus("skip")}>Skip</button>
      </div>

      {open && (
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {isVideo && (
            <>
              <div className="share-row" style={{ alignItems: "center" }}>
                <label className="hint" htmlFor={`who-${it.id}`}>On camera</label>
                <select id={`who-${it.id}`} className="input input-sm" value={it.person_id ?? ""} onChange={(e) => void onPatch(it.id, { person_id: e.target.value || null })}>
                  <option value="">Not picked yet</option>
                  {people.filter((p) => p.active || p.id === it.person_id).map((p) => <option key={p.id} value={p.id}>{p.name}{consentOk(p) ? "" : " (needs parent permission)"}</option>)}
                </select>
                <label className="btn btn-inline btn-ghost btn-sm" style={{ cursor: "pointer" }}>
                  {it.video_path ? "Replace video" : "Upload the video"}
                  <input type="file" accept="video/mp4,video/quicktime,video/webm" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
                </label>
                {it.video_path && <button className="btn btn-inline btn-ghost btn-sm" onClick={() => void openVideo(false)}>Watch</button>}
                {it.video_path && <button className="btn btn-inline btn-ghost btn-sm" onClick={() => void openVideo(true)}>Download to post</button>}
              </div>
              <input className="input input-sm" placeholder="Or paste a Google Drive or Dropbox link to the video" defaultValue={it.video_link ?? ""} aria-label="Video link"
                onBlur={(e) => { const v = e.target.value.trim(); if (v !== (it.video_link ?? "")) { if (v && !/^https:\/\/\S{4,}$/.test(v)) setErr("Paste a link that starts with https://"); else void onPatch(it.id, { video_link: v || null }); } }} />
              {it.video_link && <a className="hint" href={it.video_link} target="_blank" rel="noreferrer">Open the video link</a>}
            </>
          )}
          <div className="share-row" style={{ alignItems: "center" }}>
            <label className="hint" htmlFor={`on-${it.id}`}>Post on</label>
            <input id={`on-${it.id}`} type="date" className="input input-sm" value={it.post_on ?? ""} onChange={(e) => void onPatch(it.id, { post_on: e.target.value || null })} />
            <input className="input input-sm" style={{ flex: "1 1 200px", minWidth: 0 }} placeholder="Link to the post once it's up" value={link} aria-label="Link to the post"
              onChange={(e) => setLink(e.target.value)}
              onBlur={() => { const v = link.trim(); if (v !== (it.post_url ?? "")) { if (v && !/^https:\/\/\S{4,}$/.test(v)) setErr("Paste a link that starts with https://"); else void onPatch(it.id, v ? { post_url: v, status: "posted" } : { post_url: null }); } }} />
            {it.post_url && <a className="hint" href={it.post_url} target="_blank" rel="noreferrer">See the post</a>}
          </div>
          <div className="share-row" style={{ alignItems: "center" }}>
            <input className="input input-sm" style={{ flex: "1 1 220px", minWidth: 0 }} maxLength={600} placeholder="Ask the AI for a change: shorter, funnier, for parents…" value={ask} aria-label="Ask for a change"
              onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void rewrite(); }} />
            <button className="btn btn-inline btn-ghost btn-sm" disabled={!!working || !ask.trim()} onClick={() => void rewrite()}>Rewrite</button>
            <input className="input input-sm" style={{ flex: "1 1 160px", minWidth: 0 }} maxLength={1000} placeholder="Team note" defaultValue={it.note ?? ""} aria-label="Team note"
              onBlur={(e) => { if (e.target.value !== (it.note ?? "")) void onPatch(it.id, { note: e.target.value || null }); }} />
            <button className="btn btn-inline btn-ghost btn-sm" onClick={() => { if (window.confirm("Delete this draft?")) void onRemove(it); }}>Delete</button>
          </div>
        </div>
      )}
      {working && <p className="hint" role="status" style={{ margin: "6px 0 0" }}>{working}</p>}
      {err && <p className="note note-err" role="alert" style={{ margin: "6px 0 0" }}>{err}</p>}
    </div>
  );
}

function PeoplePanel({ sb, people, setPeople, setError }: { sb: SupabaseClient; people: Person[]; setPeople: (f: (p: Person[]) => Person[]) => void; setError: (e: string | null) => void }) {
  const [name, setName] = useState("");
  const [minor, setMinor] = useState(true);
  const [parent, setParent] = useState("");
  const [date, setDate] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [parentDraft, setParentDraft] = useState<Record<string, string>>({});

  const add = async () => {
    setError(null);
    if (!name.trim()) return;
    if (minor && date && !parent.trim()) { setError("Add the parent's name with the permission date."); return; }
    const { data, error } = await sb.from("social_people").insert({ name: name.trim(), is_minor: minor, parent_name: parent.trim() || null, consent_on: date || null }).select("*").single();
    if (error) setError(friendly(error));
    else { setPeople((p) => [...p, data as Person]); setName(""); setParent(""); setDate(""); setShowForm(false); }
  };
  const update = async (id: string, f: Partial<Person>) => {
    setError(null);
    const { data, error } = await sb.from("social_people").update(f).eq("id", id).select("*").single();
    if (error) setError(/consent_whole/.test(error.message) ? "Add the parent's name first, then the date." : friendly(error));
    else setPeople((p) => p.map((x) => (x.id === id ? (data as Person) : x)));
  };

  return (
    <section className="panel">
      <h2>🎥 People on camera</h2>
      <p className="hint">Only our team sees this list. A student under 18 can be in a video that is scheduled or posted only after a parent agrees in writing. Names are never shown in posts.</p>
      {people.length === 0 && <p className="hint">Nobody yet. Add the first student who will be on camera.</p>}
      {people.map((p) => (
        <div key={p.id} className="mk-step" style={{ opacity: p.active ? 1 : 0.6 }}>
          <div className="mk-step-head">
            <b>{p.name}</b>
            <StatusPill status={consentOk(p) ? "ok" : "wait"} label={!p.is_minor ? "Adult" : p.consent_on ? `Parent agreed ${new Date(`${p.consent_on}T12:00:00`).toLocaleDateString()}` : "Needs parent permission"} />
          </div>
          {p.is_minor && (
            <div className="share-row" style={{ alignItems: "center", marginTop: 6 }}>
              <label className="hint" htmlFor={`pn-${p.id}`}>1. Parent&apos;s name</label>
              <input id={`pn-${p.id}`} className="input input-sm" placeholder="Type the parent's name" value={parentDraft[p.id] ?? p.parent_name ?? ""}
                onChange={(e) => setParentDraft({ ...parentDraft, [p.id]: e.target.value })}
                onBlur={(e) => { if (e.target.value.trim() !== (p.parent_name ?? "")) void update(p.id, { parent_name: e.target.value.trim() || null }); }} />
              <label className="hint" htmlFor={`c-${p.id}`}>2. Date they agreed</label>
              <input id={`c-${p.id}`} type="date" className="input input-sm" value={p.consent_on ?? ""} onChange={(e) => void update(p.id, { consent_on: e.target.value || null })} />
              {!p.consent_on && <button className="btn btn-inline btn-sm" onClick={() => { const n = (parentDraft[p.id] ?? p.parent_name ?? "").trim(); if (!n) { setError(`Type ${p.name}'s parent's name first.`); return; } const d = new Date(); void update(p.id, { parent_name: n, consent_on: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }); }}>Parent agreed today</button>}
            </div>
          )}
          <div className="share-row" style={{ alignItems: "center", marginTop: 6 }}>
            <input className="input input-sm" style={{ flex: "1 1 220px", minWidth: 0 }} placeholder="Note (where the signed form is kept)" maxLength={1000} defaultValue={p.consent_note ?? ""} aria-label={`Note for ${p.name}`}
              onBlur={(e) => { if (e.target.value !== (p.consent_note ?? "")) void update(p.id, { consent_note: e.target.value || null }); }} />
            <button className="btn btn-inline btn-ghost btn-sm" onClick={() => void update(p.id, { active: !p.active })}>{p.active ? "Stop using" : "Use again"}</button>
          </div>
        </div>
      ))}
      {!showForm && <button className="btn btn-inline btn-ghost btn-sm" onClick={() => setShowForm(true)}>+ Add a person</button>}
      {showForm && (
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <input className="input" placeholder="First name (team only)" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} aria-label="First name" />
          <label className="hint" style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={minor} onChange={(e) => setMinor(e.target.checked)} /> Under 18 (needs a parent's permission)</label>
          {minor && <input className="input" placeholder="Parent's name" maxLength={120} value={parent} onChange={(e) => setParent(e.target.value)} aria-label="Parent's name" />}
          {minor && <label className="hint">Date the parent signed (leave empty until it's signed) <input type="date" className="input input-sm" value={date} onChange={(e) => setDate(e.target.value)} /></label>}
          <div className="share-row"><button className="btn btn-inline btn-sm" onClick={() => void add()}>Add</button><button className="btn btn-inline btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button></div>
        </div>
      )}
      <details style={{ marginTop: 12 }}>
        <summary><b>Parent permission form</b> (copy, print and sign; ask our lawyer to look it over)</summary>
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", background: "var(--warm-tint)", borderRadius: 10, padding: 10 }}>{CONSENT_TEMPLATE}</pre>
        <CopyBtn text={CONSENT_TEMPLATE} label="Copy the form" />
      </details>
    </section>
  );
}

function SettingsPanel({ sb, settings, setSettings, setError }: { sb: SupabaseClient; settings: Settings; setSettings: (s: Settings) => void; setError: (e: string | null) => void }) {
  const [s, setS] = useState(settings);
  const [saved, setSaved] = useState(false);
  const save = async () => {
    setError(null);
    const { error } = await sb.from("social_settings").update({ ...s, focus_note: s.focus_note?.trim() || null, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) setError(friendly(error)); else { setSettings(s); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  };
  const toggle = (n: Network) => setS({ ...s, networks: s.networks.includes(n) ? s.networks.filter((x) => x !== n) : [...s.networks, n] });
  return (
    <section className="panel">
      <h2>⚙️ Weekly writer settings</h2>
      <label className="hint" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={s.auto_weekly} onChange={(e) => setS({ ...s, auto_weekly: e.target.checked })} /> Write new drafts every Monday morning
      </label>
      <div className="share-row" style={{ alignItems: "center", marginTop: 8 }}>
        <label className="hint" htmlFor="sm-vpw">Video scripts each week</label>
        <select id="sm-vpw" className="input input-sm" value={s.videos_per_week} onChange={(e) => setS({ ...s, videos_per_week: Number(e.target.value) })}>
          {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <p className="hint" style={{ margin: "10px 0 4px" }}>Written posts each week for:</p>
      <div className="share-row">
        {POST_NETWORKS.map((n) => (
          <label key={n} className="hint" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={s.networks.includes(n)} onChange={() => toggle(n)} /> {NETWORKS[n].label}
          </label>
        ))}
      </div>
      <div className="field" style={{ marginTop: 10 }}>
        <label htmlFor="sm-host">About the student on camera (helps the AI; never shown or said in a video)</label>
        <textarea id="sm-host" className="input" rows={2} maxLength={600} value={s.host_note} onChange={(e) => setS({ ...s, host_note: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="sm-focus-all">Focus for the coming weeks (optional)</label>
        <input id="sm-focus-all" className="input" maxLength={600} placeholder="For example: get parents to try the FAFSA checklist" value={s.focus_note ?? ""} onChange={(e) => setS({ ...s, focus_note: e.target.value })} />
      </div>
      <button className="btn btn-inline btn-sm" onClick={() => void save()}>{saved ? "✓ Saved" : "Save settings"}</button>
    </section>
  );
}
