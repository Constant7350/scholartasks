"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { printPage } from "../../../lib/print";
import { NotConfigured, Page } from "../../ui";

interface Cert { first_name: string; challenge: string; subject: string; grade_min: number; grade_max: number; result: "finisher" | "finalist" | "winner"; place: number | null; date: string; code: string }

const ORD = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

/**
 * An essay challenge certificate: print it or save it as a PDF. Anyone with the code can
 * open this page to check it's real (it shows only a first name).
 */
export default function Certificate() {
  const sb = supabase();
  const [cert, setCert] = useState<Cert | null | undefined>(undefined);
  const [code, setCode] = useState("");

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("code") ?? "";
    setCode(c);
    if (!sb || !c) { setCert(null); return; }
    void sb.rpc("challenge_certificate", { p_code: c }).then(({ data }) => setCert((data as Cert | null) ?? null));
  }, [sb]);

  if (!sb) return <Page title="Certificate"><NotConfigured /></Page>;
  if (cert === undefined) return <Page title="Certificate"><p className="hint">Loading…</p></Page>;
  if (!cert) {
    return (
      <Page title="Check a certificate">
        <form className="row panel" onSubmit={(e) => { e.preventDefault(); window.location.href = `/challenge/certificate?code=${encodeURIComponent(code.trim())}`; }}>
          <div className="field"><label htmlFor="cert-code">Certificate code</label>
            <input id="cert-code" className="input" maxLength={20} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /></div>
          <button className="btn btn-inline">Check</button>
        </form>
        {code && <p className="note note-err">We couldn&apos;t find a certificate with that code.</p>}
      </Page>
    );
  }

  const award = cert.result === "winner" ? (cert.place ? `${ORD(cert.place)} place winner` : "Winner") : cert.result === "finalist" ? "Finalist" : "Finisher";
  const grades = cert.grade_min === cert.grade_max ? `Grade ${cert.grade_min}` : `Grades ${cert.grade_min} to ${cert.grade_max}`;
  const date = new Date(`${cert.date}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

  return (
    <Page>
      <div className="certificate" data-result={cert.result}>
        <div className="certificate-seal" aria-hidden>{cert.result === "winner" ? "🥇" : cert.result === "finalist" ? "🎖️" : "🏅"}</div>
        <p className="certificate-kicker">ScholarTasks Essay Challenge</p>
        <h1 className="certificate-title">Certificate of {cert.result === "finisher" ? "Achievement" : "Excellence"}</h1>
        <p>This certifies that</p>
        <p className="certificate-name">{cert.first_name}</p>
        <p>
          {cert.result === "finisher" ? "planned, wrote and finished an original essay for" : `was named ${award} in`}
          <br /><b>{cert.challenge}</b><br />
          {cert.subject} · {grades}
        </p>
        <p className="certificate-award">{award}</p>
        <div className="certificate-foot">
          <span>{date}</span>
          <span>Our review team, ScholarTasks</span>
        </div>
        <p className="hint small certificate-code">Check it&apos;s real at scholartasks.com/challenge/certificate · code {cert.code}</p>
      </div>
      <div className="row no-print" style={{ justifyContent: "center" }}>
        <button className="btn btn-inline" onClick={printPage}>Print or save as PDF</button>
        <a className="btn btn-ghost btn-inline" href="/challenge">Back to the challenge</a>
      </div>
    </Page>
  );
}
