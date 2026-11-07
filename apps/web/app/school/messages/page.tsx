"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { Page } from "../../ui";
import { usePortal } from "../portal";
import { SendMessage, type Msg } from "../parts";

/** Email connected families by grade. Links from Today fill in the grade and subject. */
export default function Messages() {
  const sb = supabase();
  const { school } = usePortal();
  const [sent, setSent] = useState<Msg[]>([]);
  const [start, setStart] = useState<{ grades?: number[]; subject?: string } | null>(null);
  const load = useCallback(async () => {
    if (!sb) return;
    const { data } = await sb.from("school_messages").select("id, subject, grades, recipients, sent_at").eq("school_id", school.id).order("sent_at", { ascending: false }).limit(20);
    setSent((data as Msg[]) ?? []);
  }, [sb, school.id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const grades = (p.get("grades") ?? "").split(",").map(Number).filter((g) => g >= 6 && g <= 12);
    setStart({ grades: grades.length ? grades : undefined, subject: p.get("subject") ?? undefined });
  }, []);
  return (
    <Page title="Messages">
      {start && <SendMessage schoolId={school.id} sent={sent} onSent={load} start={start} />}
    </Page>
  );
}
