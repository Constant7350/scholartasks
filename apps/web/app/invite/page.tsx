"use client";

import { useEffect, useState } from "react";
import { canShareSheet, shareSheet } from "../../lib/share";
import { Page } from "../ui";

const LINK = "https://scholartasks.com";

type Who = "parent" | "student";
const MESSAGES: Record<Who, { subject: string; body: string }> = {
  parent: {
    subject: "Try ScholarTasks for college planning",
    body: `Hi! I've been using ScholarTasks to plan for college. It keeps track of deadlines, finds scholarships our kid qualifies for, checks state scholarship GPAs, walks through the FAFSA and has free SAT and ACT practice. You can try it free: ${LINK}`,
  },
  student: {
    subject: "Check out ScholarTasks",
    body: `Hey! I'm using ScholarTasks for college stuff: deadlines, scholarships, SAT and ACT practice, and homework hints that help you figure it out yourself. It's free to try: ${LINK}`,
  },
};

/** Invite a friend (another parent or a student) to try ScholarTasks. Works signed in or not. */
export default function InvitePage() {
  const [who, setWho] = useState<Who>("parent");
  const [text, setText] = useState(MESSAGES.parent.body);
  const [edited, setEdited] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sheet, setSheet] = useState(false);
  useEffect(() => setSheet(canShareSheet()), []);

  const pick = (w: Who) => {
    setWho(w);
    if (!edited) setText(MESSAGES[w].body);
  };
  const subject = MESSAGES[who].subject;

  return (
    <Page title="Invite a friend">
      <p className="hint">Know another family or a friend who is planning for college or a trade? Send them ScholarTasks in one tap.</p>

      <div className="panel invite">
        <h2>Who are you inviting?</h2>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={who === "parent"} onClick={() => pick("parent")}>👪 A parent</button>
          <button role="tab" aria-selected={who === "student"} onClick={() => pick("student")}>🎒 A student</button>
        </div>

        <label className="field">
          <span>Your message (change it if you like)</span>
          <textarea className="input" rows={7} maxLength={1000} value={text} onChange={(e) => { setText(e.target.value); setEdited(true); }} />
        </label>

        <div className="share-row">
          <a className="btn btn-inline share-btn" href={`sms:?&body=${encodeURIComponent(text)}`}>💬 Text it</a>
          <a className="btn btn-inline share-btn" href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`}>✉️ Email it</a>
          {sheet && (
            <button type="button" className="btn btn-ghost btn-inline" onClick={() => shareSheet({ title: subject, text })}>
              More ways…
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-inline"
            onClick={async () => {
              try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch {}
            }}
          >
            {copied ? "✓ Copied" : "Copy message"}
          </button>
        </div>
        <p className="hint" style={{ margin: "10px 0 0", fontSize: 13 }}>
          Your texting or email app opens with the message ready. Pick your friend and press send. ScholarTasks never sees your contacts.
        </p>
      </div>

      <p className="hint">
        Adding your own student to your family? Use the family code on <a href="/family">Family and permissions</a> instead.
        Like ScholarTasks? <a href="/rate">Rate it</a>.
      </p>
    </Page>
  );
}
