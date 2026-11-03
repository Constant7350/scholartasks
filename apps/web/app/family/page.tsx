"use client";

import { useCallback, useEffect, useState } from "react";
import { PERMISSIONS, type PermissionKey } from "@scholartasks/core";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page, card } from "../ui";

interface Student {
  id: string;
  family_id: string;
  first_name: string;
  grade_level: number;
  state: string;
  permissions: Record<PermissionKey, boolean>;
}
interface Family { id: string; name: string }

export default function FamilyPage() {
  const sb = supabase();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState("");
  const [child, setChild] = useState({ first_name: "", birth_date: "", grade_level: "9", state: "GA" });

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    setSignedIn(!!s.session);
    if (!s.session) return;
    const [f, st] = await Promise.all([
      sb.from("families").select("id, name"),
      sb.from("students").select("id, family_id, first_name, grade_level, state, permissions").order("first_name"),
    ]);
    setFamilies((f.data as Family[]) ?? []);
    setStudents((st.data as Student[]) ?? []);
  }, [sb]);

  useEffect(() => { void load(); }, [load]);

  if (!sb) return <Page title="Your family"><NotConfigured /></Page>;
  if (signedIn === false) return <Page title="Your family"><p style={card}><a href="/signin">Sign in</a> to manage your family.</p></Page>;

  const run = async (fn: () => PromiseLike<{ error: unknown; data?: unknown }>) => {
    setError(null);
    const { error: e, data } = await fn();
    if (e) setError(friendly(e));
    else await load();
    return e ? null : data;
  };

  const family = families[0];

  return (
    <Page title="Your family">
      {error && <p style={{ ...card, borderColor: "#d33" }}>{error}</p>}
      {!family ? (
        <div style={card}>
          <h2>Create your family account</h2>
          <input aria-label="Family name" placeholder="e.g. The Smith family" value={familyName} onChange={(e) => setFamilyName(e.target.value)} />{" "}
          <button disabled={!familyName.trim()} onClick={() => run(() => sb.rpc("create_family", { p_name: familyName }))}>Create</button>
        </div>
      ) : (
        <>
          <p>{family.name}</p>
          {students.map((s) => (
            <div key={s.id} style={card}>
              <h2 style={{ marginTop: 0 }}>{s.first_name} <small>grade {s.grade_level}, {s.state}</small></h2>
              <h3>What {s.first_name} can do in the student app</h3>
              {PERMISSIONS.map((p) => (
                <label key={p.key} style={{ display: "block", margin: "6px 0" }}>
                  <input
                    type="checkbox"
                    checked={!!s.permissions[p.key]}
                    onChange={(e) => run(() => sb.rpc("set_student_permission", { p_student: s.id, p_key: p.key, p_value: e.target.checked }))}
                  />{" "}
                  {p.label}
                </label>
              ))}
              <button
                onClick={async () => {
                  const code = await run(() => sb.rpc("create_student_invite", { p_student: s.id }));
                  if (typeof code === "string") setCodes({ ...codes, [s.id]: code });
                }}
              >
                Invite {s.first_name} to the student app
              </button>
              {codes[s.id] && (
                <p>Code for {s.first_name}: <strong style={{ letterSpacing: 2 }}>{codes[s.id]}</strong> (enter at /join, valid 7 days)</p>
              )}
            </div>
          ))}
          <div style={card}>
            <h2>Add a child</h2>
            <input aria-label="First name" placeholder="First name" value={child.first_name} onChange={(e) => setChild({ ...child, first_name: e.target.value })} />{" "}
            <input aria-label="Birth date" type="date" value={child.birth_date} onChange={(e) => setChild({ ...child, birth_date: e.target.value })} />{" "}
            <select aria-label="Grade" value={child.grade_level} onChange={(e) => setChild({ ...child, grade_level: e.target.value })}>
              {[8, 9, 10, 11, 12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </select>{" "}
            <button
              disabled={!child.first_name.trim() || !child.birth_date}
              onClick={() =>
                run(() =>
                  sb.rpc("add_student", {
                    p_family: family.id,
                    p_first_name: child.first_name,
                    p_birth_date: child.birth_date,
                    p_grade_level: Number(child.grade_level),
                    p_state: child.state,
                  }),
                )
              }
            >
              Add
            </button>
            <p style={{ fontSize: 12, color: "#777" }}>Georgia only for now.</p>
          </div>
        </>
      )}
    </Page>
  );
}
