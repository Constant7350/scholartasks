"use client";

import { useState } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { SignConsent } from "../sign-consent";
import { type Entry, money } from "../../lib/challenge";

export interface MyPrize { kind: string; amount: number; status: string; paid_on: string | null; brand: string | null; ready: boolean; picked_up_at: string | null }
interface Gift { brand: string | null; amount: number; code: string | null; link: string | null }

/** A winner's gift card: the parent picks it up here after Face ID or an email code and a signed receipt. */
export function PrizePickup({ entry, student, prize, mayPick, onPicked, kindName = "essay challenge" }: { entry: Entry; student: { id: string; first_name: string }; prize: MyPrize; mayPick: boolean; onPicked: (p: MyPrize) => void; kindName?: string }) {
  const sb = supabase()!;
  const [signing, setSigning] = useState(false);
  const [gift, setGift] = useState<Gift | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const store = prize.brand ? `${prize.brand} ` : "";
  const open = async () => {
    setMsg(null);
    const { data, error } = await sb.rpc("challenge_pickup_prize", { p_entry: entry.id });
    if (error) throw new Error(friendly(error));
    setGift(data as Gift);
    setSigning(false);
    onPicked({ ...prize, status: "paid", picked_up_at: prize.picked_up_at ?? new Date().toISOString() });
  };
  return (
    <div className="note note-info" style={{ display: "grid", gap: 8 }}>
      <b>🎁 Prize: {money(prize.amount)} {store}digital gift card</b>
      {!prize.ready ? <span>Your prize is being prepared. It will be ready here within 30 days of the results.</span>
        : !mayPick ? <span>{prize.picked_up_at ? "Your parent picked up the prize. 🎉" : "Ready! Ask a parent to open this page in their own ScholarTasks login to pick it up."}</span>
        : gift ? (
          <span>
            {gift.code && <>Gift card code: <b className="gift-code">{gift.code}</b><br /></>}
            {gift.link && <><a href={gift.link} target="_blank" rel="noopener noreferrer">Open the gift card</a><br /></>}
            <span className="hint small">Keep this code private. Anyone with it can spend it.</span>
          </span>
        ) : prize.picked_up_at ? (
          <button className="btn btn-inline btn-sm" onClick={() => void open().catch((e) => setMsg((e as Error).message))}>Show the gift card again</button>
        ) : signing ? (
          <SignConsent kind="prize" student={student.id} target={entry.id} title="Prize receipt" button="Sign and show my prize"
            wording={`I am ${student.first_name}'s parent or legal guardian (or the winner, 18 or older). I received the ${money(prize.amount)} ${store}digital gift card prize for ${student.first_name} from the ScholarTasks ${kindName}. I understand prizes may count as taxable income.`}
            onSigned={open} onDecline={() => setSigning(false)} declineLabel="Not now" />
        ) : (
          <>
            <span>Ready to pick up! For safety, prizes are never emailed or mailed. Confirm it&apos;s you and sign a receipt to see the gift card.</span>
            <button className="btn btn-inline btn-sm" style={{ justifySelf: "start" }} onClick={() => setSigning(true)}>Pick up the prize</button>
          </>
        )}
      {msg && <span className="note note-err" style={{ margin: 0 }}>{msg}</span>}
    </div>
  );
}

