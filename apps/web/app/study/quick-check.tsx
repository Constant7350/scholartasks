"use client";

import { useEffect, useState } from "react";
import type { Check } from "./lessons";

/** Multiple-choice checks with instant feedback. Free, no AI. */
export function QuickCheck({ checks, onDone }: { checks: Check[]; onDone?: (right: number) => void }) {
  const [picked, setPicked] = useState<(number | null)[]>(checks.map(() => null));
  const answered = picked.filter((p) => p !== null).length;
  const right = picked.filter((p, i) => p === checks[i]!.answer).length;
  useEffect(() => { if (answered === checks.length) onDone?.(right); }, [answered]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      {checks.map((c, i) => {
        const p = picked[i];
        return (
          <fieldset key={i} className="checkin-q">
            <legend>{i + 1}. {c.q}</legend>
            <div className="chips">
              {c.options.map((o, j) => (
                <button key={j} type="button" disabled={p !== null}
                  className={`chip ${p !== null && j === c.answer ? "chip-right" : ""} ${p === j && j !== c.answer ? "chip-wrong" : ""}`}
                  onClick={() => setPicked(picked.map((x, k) => (k === i ? j : x)))}>{o}</button>
              ))}
            </div>
            {p !== null && <p className={`note ${p === c.answer ? "note-ok" : "note-info"}`} style={{ marginTop: 8 }}>{p === c.answer ? "✓ Right. " : "Not quite. "}{c.explain}</p>}
          </fieldset>
        );
      })}
      {answered === checks.length && (
        <p className="hint"><b>{right} of {checks.length} right.</b> {right === checks.length ? "Nice work!" : ""}
          <button className="linklike" style={{ marginLeft: 8 }} onClick={() => setPicked(checks.map(() => null))}>Try again</button></p>
      )}
    </div>
  );
}
