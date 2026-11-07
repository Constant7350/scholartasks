"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "../app/icons";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A parent's own space. When a parent searches colleges or scholarships "in my parent space",
 * saves go to the parent's own list (table parent_saves), not the student's plan, and the
 * student's search answers are left alone. The choice is kept on this device, like the student picker.
 */

export type Space = "parent" | "student";
export type PickKind = "college" | "scholarship" | "career" | "trade";
export type PickValue = "like" | "maybe" | "no";
export interface ParentSave {
  id: string; user_id: string; student_id: string; kind: PickKind; item_key: string; name: string;
  pick: PickValue; note: string | null; shared: boolean; created_at: string; updated_at: string;
}

const KEY = "st-space";
const EVENT = "st-space-change";

function readSpace(): Space {
  if (typeof window === "undefined") return "parent";
  const fromLink = new URLSearchParams(window.location.search).get("space");
  if (fromLink === "parent" || fromLink === "student") return fromLink;
  try { return localStorage.getItem(KEY) === "student" ? "student" : "parent"; } catch { return "parent"; }
}

/** Which space a parent is in, shared by every page. New parents start in their own space. */
export function useSpace(): [Space, (s: Space) => void] {
  const [space, setSpaceState] = useState<Space>("parent");
  useEffect(() => {
    setSpaceState(readSpace());
    const fn = (e: Event) => setSpaceState((e as CustomEvent<Space>).detail);
    window.addEventListener(EVENT, fn);
    return () => window.removeEventListener(EVENT, fn);
  }, []);
  const setSpace = useCallback((s: Space) => {
    try { localStorage.setItem(KEY, s); } catch { /* private mode: this page view only */ }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: s }));
  }, []);
  return [space, setSpace];
}

/** The two-way switch parents see at the top of search pages. */
export function SpaceSwitch({ space, onChange, name }: { space: Space; onChange: (s: Space) => void; name: string }) {
  return (
    <div className="space-switch">
      <div className="tabs space-tabs" role="tablist" aria-label="Whose list">
        <button role="tab" aria-selected={space === "parent"} onClick={() => onChange("parent")}><Icon of="👤" /> My parent space</button>
        <button role="tab" aria-selected={space === "student"} onClick={() => onChange("student")}><Icon of="🎓" /> {`${name}'s plan`}</button>
      </div>
      <p className="hint small">
        {space === "parent"
          ? <>Saves go to <a href="/parent">your own list</a>. Nothing is added to {name}&apos;s plan or shows as {name}&apos;s work.</>
          : <>Saves go straight onto {name}&apos;s plan, marked as added by you.</>}
      </p>
    </div>
  );
}

/** This parent's own picks for one student (other parents' picks are left out). */
export async function myPicks(sb: SupabaseClient, studentId: string, kind?: PickKind): Promise<ParentSave[]> {
  const { data: s } = await sb.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) return [];
  let q = sb.from("parent_saves").select("*").eq("user_id", uid).eq("student_id", studentId);
  if (kind) q = q.eq("kind", kind);
  const { data } = await q.order("created_at");
  return (data as ParentSave[]) ?? [];
}

/** Saves (or changes) one pick on the parent's own list. */
export async function savePick(sb: SupabaseClient, row: { student_id: string; kind: PickKind; item_key: string; name: string; pick?: PickValue; note?: string | null; shared?: boolean }) {
  const { data: s } = await sb.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) return { error: { message: "Please sign in again." } };
  const shared = row.pick === "no" ? false : row.shared;
  return sb.from("parent_saves").upsert(
    { user_id: uid, ...row, ...(shared === undefined ? {} : { shared }) },
    { onConflict: "user_id,student_id,kind,item_key" },
  );
}

export const PICKS: [PickValue, string, string][] = [["like", "👍", "Like"], ["maybe", "🤔", "Maybe"], ["no", "👎", "Not for us"]];
