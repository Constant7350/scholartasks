import * as SecureStore from "expo-secure-store";
import { createClient, type Session } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

/**
 * The phone keeps only the sign-in refresh token, in the iPhone Keychain /
 * Android Keystore (encrypted, this device only). Opening the app trades it
 * for a fresh session.
 */
const TOKEN = "st.refresh_token";
const FACE_ID = "st.face_id";
const ASKED = "st.face_id_asked";
const opts = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

export const savedToken = () => SecureStore.getItemAsync(TOKEN, opts);
export const saveToken = (t: string) => SecureStore.setItemAsync(TOKEN, t, opts);

export async function forget() {
  await SecureStore.deleteItemAsync(TOKEN, opts);
}

export const faceIdOn = async () => (await SecureStore.getItemAsync(FACE_ID, opts)) === "1";
export const setFaceId = (on: boolean) => SecureStore.setItemAsync(FACE_ID, on ? "1" : "0", opts);
export const askedFaceId = async () => (await SecureStore.getItemAsync(ASKED, opts)) === "1";
export const markAskedFaceId = () => SecureStore.setItemAsync(ASKED, "1", opts);

/** Trades the saved refresh token for a new session, or null if it no longer works. */
export async function resume(): Promise<Session | null> {
  const t = await savedToken();
  if (!t) return null;
  const { data, error } = await sb.auth.refreshSession({ refresh_token: t });
  if (error || !data.session) return null;
  await saveToken(data.session.refresh_token);
  return data.session;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error ?? new Error("Couldn't sign in.");
  await saveToken(data.session.refresh_token);
  return data.session;
}

export function friendly(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/invalid login credentials/i.test(m)) return "That email and password don't match. Try again, or tap Forgot password.";
  if (/email not confirmed/i.test(m)) return "Please confirm your email first. Check your inbox for the link we sent.";
  if (/network|fetch/i.test(m)) return "No internet connection. Check your Wi-Fi or data and try again.";
  return m;
}
