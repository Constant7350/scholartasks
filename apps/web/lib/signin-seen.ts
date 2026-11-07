"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

const DEVICE_KEY = "st-device";
const DAY_KEY = "st-seen-day";

/**
 * Sharing guard: once a day per device, tell the server this device signed in (see
 * /api/account/seen). The device id is random and made here; it says nothing about the person.
 */
export async function noteSignIn(sb: SupabaseClient): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(DAY_KEY) === today) return;
    let device = localStorage.getItem(DEVICE_KEY);
    if (!device) {
      device = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, device);
    }
    const { data } = await sb.auth.getSession();
    if (!data.session) return;
    const res = await fetch("/api/account/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify({ device }),
    });
    if (res.ok) localStorage.setItem(DAY_KEY, today);
  } catch { /* private mode or offline: try again next time */ }
}
