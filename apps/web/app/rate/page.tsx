"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { canRateInStore, platform, rateInStore } from "../../lib/share";
import { NotConfigured, Page } from "../ui";

const WORDS = ["", "Not good", "Could be better", "OK", "Good", "Love it"];

/** Rate ScholarTasks: tap 1 to 5 stars, add a note if you like. In the phone app, also rate it in the store. */
export default function RatePage() {
  const sb = supabase();
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [hadRating, setHadRating] = useState(false);
  const [store, setStore] = useState(false);
  useEffect(() => setStore(canRateInStore()), []);

  useEffect(() => {
    if (!sb) return;
    void (async () => {
      const { data: s } = await sb.auth.getSession();
      setSignedIn(!!s.session);
      if (!s.session) return;
      const { data } = await sb.from("app_ratings").select("stars, note").eq("user_id", s.session.user.id).maybeSingle();
      if (data) { setStars(data.stars as number); setNote((data.note as string | null) ?? ""); setHadRating(true); }
    })();
  }, [sb]);

  if (!sb) return <Page title="Rate ScholarTasks"><NotConfigured /></Page>;

  const send = async () => {
    if (!stars) return;
    setState("sending");
    try {
      const { data } = await sb.auth.getSession();
      const res = await fetch("/api/rate", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ stars, note: note.trim(), platform: platform() }),
      });
      setState(res.ok ? "sent" : "error");
      if (res.ok) setHadRating(true);
    } catch {
      setState("error");
    }
  };

  const storeName = platform() === "android" ? "Google Play" : "the App Store";
  const shown = hover || stars;

  return (
    <Page title="Rate ScholarTasks">
      <p className="hint">How is ScholarTasks working for your family? Our team reads every rating and note.</p>

      {store && (
        <div className="panel">
          <h2>Rate us in {storeName}</h2>
          <p className="hint">A rating in {storeName} helps other families find ScholarTasks. It takes one tap.</p>
          <button type="button" className="btn btn-inline" onClick={rateInStore}>⭐ Rate in {storeName}</button>
        </div>
      )}

      <div className="panel">
        <h2>{store ? "Tell our team" : "Your rating"}</h2>
        {signedIn === false ? (
          <>
            <p className="hint">Sign in to rate ScholarTasks, so we know each rating comes from a real family.</p>
            <a className="btn btn-inline link-btn" href="/signin?next=/rate">Sign in</a>
          </>
        ) : state === "sent" ? (
          <div className="note note-ok" role="status">
            Thank you! {note.trim() ? "Our team will read your note." : "Your rating is saved."} You can change it here any time.
            {" "}<button type="button" className="linkish" onClick={() => setState("idle")}>Change my rating</button>
          </div>
        ) : (
          <>
            <div className="stars" role="radiogroup" aria-label="Stars" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={stars === n}
                  aria-label={`${n} star${n === 1 ? "" : "s"}: ${WORDS[n]}`}
                  className={n <= shown ? "star on" : "star"}
                  onClick={() => setStars(n)}
                  onMouseEnter={() => setHover(n)}
                >
                  ★
                </button>
              ))}
              <span className="stars-word">{shown ? WORDS[shown] : "Tap a star"}</span>
            </div>
            <label className="field">
              <span>{stars && stars <= 3 ? "What would make it better? (optional)" : "Anything you'd like to tell us? (optional)"}</span>
              <textarea className="input" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you like, what's hard to find, what you wish it did…" />
            </label>
            <button type="button" className="btn btn-inline" onClick={send} disabled={!stars || state === "sending" || signedIn === undefined}>
              {state === "sending" ? "Sending…" : hadRating ? "Update my rating" : "Send my rating"}
            </button>
            {state === "error" && <p className="note note-err">Couldn&apos;t send your rating. Please try again, or email support@scholartasks.com.</p>}
          </>
        )}
      </div>

      <p className="hint">Know a family who would like it? <a href="/invite">Invite a friend</a>.</p>
    </Page>
  );
}
