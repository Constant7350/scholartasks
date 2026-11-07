"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { Page } from "../../ui";
import { usePortal } from "../portal";
import { LocalScholarships, type LocalSch } from "../parts";
import { SchoolApplications } from "../applications";

/** Local awards the school posts, and the applications students sent for them. */
export default function Scholarships() {
  const sb = supabase();
  const { school } = usePortal();
  const [list, setList] = useState<LocalSch[]>([]);
  const load = useCallback(async () => {
    if (!sb) return;
    const { data } = await sb.rpc("school_scholarships", { p_school: school.id });
    setList((data as LocalSch[]) ?? []);
  }, [sb, school.id]);
  useEffect(() => { void load(); }, [load]);
  return (
    <Page title="Local scholarships">
      <SchoolApplications schoolId={school.id} />
      <LocalScholarships schoolId={school.id} list={list} onPosted={load} />
    </Page>
  );
}
