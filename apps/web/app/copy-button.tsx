"use client";

import { useState } from "react";

/** Copies text to the clipboard and says so. Falls back to selecting the text when copying is blocked. */
export function CopyButton({ text, label = "Copy", targetId }: { text: string; label?: string; targetId?: string }) {
  const [state, setState] = useState<"idle" | "done" | "select">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      const el = targetId ? document.getElementById(targetId) : null;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      setState("select");
    }
    setTimeout(() => setState("idle"), 2500);
  };
  return (
    <button type="button" className="btn btn-ghost btn-inline btn-sm" onClick={() => void copy()} disabled={!text} aria-live="polite">
      {state === "done" ? "✓ Copied" : state === "select" ? "Selected, press copy" : label}
    </button>
  );
}
