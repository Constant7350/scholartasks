"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { Page } from "../../ui";
import { JoinStaff, SignUp, usePortal } from "../portal";
import { ShareCode, StaffList, type Staff } from "../parts";
import { Roster } from "../roster";

/** Invite families (code, roster), the school's counselors, and adding another school. */
export default function Settings() {
  const sb = supabase();
  const { school, role, reload } = usePortal();
  const [staff, setStaff] = useState<Staff[]>([]);
  const load = useCallback(async () => {
    if (!sb) return;
    const { data } = await sb.from("school_staff").select("user_id, role, full_name, job_title").eq("school_id", school.id).order("added_at");
    setStaff((data as Staff[]) ?? []);
  }, [sb, school.id]);
  useEffect(() => { void load(); }, [load]);
  return (
    <Page title="Families and staff">
      <ShareCode school={school} role={role} onChanged={reload} />
      <Roster school={school} role={role} />
      <StaffList school={school} role={role} staff={staff} onChanged={() => { void load(); reload(); }} />
      <details className="perm" style={{ marginTop: 24 }}>
        <summary>Add another school</summary>
        <SignUp onDone={reload} />
        <JoinStaff onDone={reload} />
      </details>
    </Page>
  );
}
