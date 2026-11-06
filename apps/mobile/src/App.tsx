import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { ActivityIndicator, Alert, AppState, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Print from "expo-print";
import { WebView as RNWebView, type WebViewMessageEvent, type WebViewProps } from "react-native-webview";
import type { Session } from "@supabase/supabase-js";
import { RELOCK_AFTER_MS, SITE_HOSTS, SITE_URL, WEB_SESSION_KEY } from "./config";
import { endSession, faceIdOn, friendly, markAskedFaceId, resume, savedEmail, saveToken, setFaceId, signIn } from "./session";
import { unlock, unlockKind } from "./unlock";
import { clearReminders, scheduleReminders, type Reminder } from "./reminders";
import { rateApp, shareText } from "./share";

// The library's class typing (Component<Props & undefined>) collapses to never under strict TypeScript.
const WebView = RNWebView as unknown as ComponentType<WebViewProps>;

type Screen = "loading" | "signin" | "offer" | "locked" | "app";

const C = { navy: "#14305a", gold: "#f2b33d", bg: "#faf6f0", ink: "#1b2333", muted: "#5b6577", line: "#dde2ea", err: "#b42318" };

export default function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const background = useRef<number | null>(null);

  /** Gets a fresh session from the saved token and opens the app (or the sign-in screen). */
  const open = useCallback(async () => {
    setError(null);
    const s = await resume().catch(() => null);
    if (!s) {
      setScreen("signin");
      return;
    }
    setSession(s);
    setScreen("app");
  }, []);

  const tryUnlock = useCallback(async (k: string) => {
    if (await unlock(k)) await open();
  }, [open]);

  // First launch: Face ID if it's on, otherwise straight in (or to sign-in).
  useEffect(() => {
    (async () => {
      const k = await unlockKind();
      setKind(k);
      if (k && (await faceIdOn())) {
        setScreen("locked");
        await tryUnlock(k);
      } else await open();
    })();
  }, [open, tryUnlock]);

  // Lock again after the app has been away for a while.
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state) => {
      if (state !== "active") {
        background.current ??= Date.now();
        return;
      }
      const away = background.current ? Date.now() - background.current : 0;
      background.current = null;
      if (away > RELOCK_AFTER_MS && kind && (await faceIdOn())) {
        setScreen("locked");
        await tryUnlock(kind);
      }
    });
    return () => sub.remove();
  }, [kind, tryUnlock]);

  // After typing a password, offer Face ID whenever it is still off, so next time is one glance.
  const signedIn = async (s: Session) => {
    setSession(s);
    if (kind && !(await faceIdOn())) setScreen("offer");
    else setScreen("app");
  };

  /** "Use a different account": ends the sign-in completely. The email stays filled in. */
  const signedOut = async () => {
    await endSession();
    await clearReminders();
    setSession(null);
    setScreen("signin");
  };

  /**
   * Sign out from the website menu (app 0.3 and later). With Face ID on, the app just locks:
   * opening it again is one glance, like a banking app. Without Face ID it signs out fully.
   */
  const lockOrSignOut = async () => {
    if (kind && (await faceIdOn())) {
      setSession(null);
      setScreen("locked");
      await tryUnlock(kind);
    } else await signedOut();
  };

  return (
    <SafeAreaProvider>
      <StatusBar style={screen === "app" ? "dark" : "light"} />
      {screen === "loading" && <Splash />}
      {screen === "signin" && <SignIn onDone={signedIn} />}
      {screen === "offer" && kind && (
        <Offer
          kind={kind}
          onChoice={async (yes) => {
            await markAskedFaceId();
            if (yes && (await unlock(kind))) await setFaceId(true);
            setScreen("app");
          }}
        />
      )}
      {screen === "locked" && kind && <Locked kind={kind} error={error} onUnlock={() => tryUnlock(kind)} onOther={signedOut} />}
      {screen === "app" && session && <Site session={session} onSignedOut={signedOut} onSignOut={lockOrSignOut} />}
    </SafeAreaProvider>
  );
}

function Splash() {
  return (
    <View style={[s.center, { backgroundColor: C.navy }]}>
      <Text style={s.logo}>ScholarTasks</Text>
      <ActivityIndicator color={C.gold} style={{ marginTop: 20 }} />
    </View>
  );
}

function SignIn({ onDone }: { onDone: (s: Session) => void }) {
  const [email, setEmail] = useState("");
  // Fill in the email used last time on this phone.
  useEffect(() => { savedEmail().then((e) => e && setEmail((cur) => cur || e)).catch(() => {}); }, []);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && password.length >= 8;

  const go = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await signIn(email.trim(), password));
    } catch (e) {
      setError(friendly(e));
    }
    setBusy(false);
  };

  return (
    <SafeAreaView style={[s.fill, { backgroundColor: C.navy }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.fill}>
        <ScrollView contentContainerStyle={s.signin} keyboardShouldPersistTaps="handled">
          <Text style={s.logo}>ScholarTasks</Text>
          <Text style={s.tag}>College, scholarships and aid, handled.</Text>
          <View style={s.card}>
            <Text style={s.h2}>Sign in</Text>
            <Text style={s.label}>Email address</Text>
            <TextInput style={s.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="username" placeholder="you@example.com" />
            <Text style={s.label}>Password</Text>
            <TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={go} />
            <Pressable style={[s.btn, (!valid || busy) && { opacity: 0.5 }]} onPress={go} disabled={!valid || busy} accessibilityRole="button">
              <Text style={s.btnText}>{busy ? "One moment…" : "Sign in"}</Text>
            </Pressable>
            {error && <Text style={s.err}>{error}</Text>}
            <Pressable onPress={() => Linking.openURL(`${SITE_URL}/signin`)}>
              <Text style={s.link}>Forgot password, or new to ScholarTasks?</Text>
            </Pressable>
            <Text style={s.small}>After you sign in, you can open the app with Face ID or your fingerprint.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Offer({ kind, onChoice }: { kind: string; onChoice: (yes: boolean) => void }) {
  return (
    <SafeAreaView style={[s.center, { backgroundColor: C.navy, padding: 24 }]}>
      <Text style={s.big}>Open with {kind}?</Text>
      <Text style={s.tag}>Skip typing your password. Your face or fingerprint stays on this phone; ScholarTasks never sees it.</Text>
      <Pressable style={[s.btn, s.btnGold]} onPress={() => onChoice(true)} accessibilityRole="button">
        <Text style={[s.btnText, { color: C.navy }]}>Turn on {kind}</Text>
      </Pressable>
      <Pressable onPress={() => onChoice(false)}>
        <Text style={[s.link, { color: "#fff" }]}>Not now</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function Locked({ kind, error, onUnlock, onOther }: { kind: string; error: string | null; onUnlock: () => void; onOther: () => void }) {
  return (
    <SafeAreaView style={[s.center, { backgroundColor: C.navy, padding: 24 }]}>
      <Text style={s.logo}>ScholarTasks</Text>
      <Pressable style={[s.btn, s.btnGold, { marginTop: 32 }]} onPress={onUnlock} accessibilityRole="button">
        <Text style={[s.btnText, { color: C.navy }]}>Unlock with {kind}</Text>
      </Pressable>
      {error && <Text style={[s.err, { color: "#fff" }]}>{error}</Text>}
      <Pressable onPress={onOther}>
        <Text style={[s.link, { color: "#fff" }]}>Use a different account</Text>
      </Pressable>
    </SafeAreaView>
  );
}

/** Opens a mailto:, sms: or tel: link in the phone's app for it, or says what to do when there isn't one. */
function openOutside(url: string) {
  Linking.openURL(url).catch(() => {
    const to = decodeURIComponent(url.replace(/^[a-z]+:(\/\/)?/i, "").split("?")[0] ?? "");
    const what = /^mailto:/i.test(url) ? "email" : /^sms:/i.test(url) ? "texting" : /^webcal:/i.test(url) ? "calendar" : "phone";
    Alert.alert(`No ${what} app found`, to ? `You can reach us at ${to}.` : "Please set one up on this phone and try again.");
  });
}

/** Puts the phone's session into the website before it loads, and reports back whenever the website refreshes it. */
function bridge(session: Session) {
  const value = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  });
  return `(function(){
    try { localStorage.setItem(${JSON.stringify(WEB_SESSION_KEY)}, ${JSON.stringify(value)}); } catch (e) {}
    var last = null;
    function report(){
      try {
        var raw = localStorage.getItem(${JSON.stringify(WEB_SESSION_KEY)});
        var t = raw ? JSON.parse(raw).refresh_token : "";
        if (t !== last) { last = t; window.ReactNativeWebView.postMessage(JSON.stringify({ refresh_token: t || null })); }
      } catch (e) {}
    }
    setInterval(report, 5000);
    document.addEventListener("visibilitychange", report);
  })(); true;`;
}

function Site({ session, onSignedOut, onSignOut }: { session: Session; onSignedOut: () => void; onSignOut: () => void }) {
  const [inject] = useState(() => bridge(session));
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const onMessage = async (e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data) as { refresh_token?: string | null; reminders?: Reminder[]; print?: string; share?: { title?: unknown; text?: unknown }; rate?: boolean; signOut?: boolean };
      // Sign out in the website menu: lock with Face ID, or sign out fully (see lockOrSignOut).
      if (m.signOut === true) return onSignOut();
      if (m.refresh_token) await saveToken(m.refresh_token);
      if (Array.isArray(m.reminders)) await scheduleReminders(m.reminders);
      // "Print or save as PDF" on the website: the web view can't print, so the phone does.
      if (typeof m.print === "string") await Print.printAsync({ html: m.print }).catch(() => {});
      // "Invite a friend" and "Rate in the App Store / Google Play" on the website.
      if (m.share && typeof m.share === "object") await shareText(m.share);
      if (m.rate === true) await rateApp();
    } catch {}
  };

  if (offline)
    return (
      <SafeAreaView style={[s.center, { padding: 24 }]}>
        <Text style={s.h2}>No internet connection</Text>
        <Text style={[s.small, { textAlign: "center" }]}>ScholarTasks needs the internet to load your family's plan.</Text>
        <Pressable style={[s.btn, { alignSelf: "stretch" }]} onPress={() => setOffline(false)}>
          <Text style={s.btnText}>Try again</Text>
        </Pressable>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={[s.fill, { backgroundColor: "#fff" }]} edges={["top"]}>
      <WebView
        source={{ uri: `${SITE_URL}/home` }}
        injectedJavaScriptBeforeContentLoaded={inject}
        onMessage={onMessage}
        onLoadEnd={() => setLoading(false)}
        onError={() => setOffline(true)}
        sharedCookiesEnabled
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        // 0.2 and later: the website may ask for the share sheet and store rating box (see apps/web/lib/share.ts).
        // 0.3 and later: Sign out in the menu asks the app to lock (Face ID) instead of ending the sign-in.
        applicationNameForUserAgent="ScholarTasksApp/0.3"
        // Every link goes through onShouldStartLoadWithRequest below. The default list only lets
        // http(s) through and quietly drops mailto:/sms:/tel: links on iPhone.
        originWhitelist={["*"]}
        onShouldStartLoadWithRequest={(req) => {
          let host = "";
          try { host = new URL(req.url).hostname; } catch {}
          // Email, text, phone and calendar links (mailto:, sms:, tel:, webcal:) open the phone's own
          // Mail, Messages, Phone or Calendar app. A web view can't open them itself, so tapping did nothing.
          if (/^(mailto|sms|tel|webcal):/i.test(req.url)) {
            openOutside(req.url);
            return false;
          }
          // Other websites (GAfutures, FAFSA, scholarship sponsors) open in the phone's browser.
          if (req.url.startsWith("http") && !SITE_HOSTS.includes(host)) {
            Linking.openURL(req.url);
            return false;
          }
          // Signing out on the website signs out the app too.
          if (SITE_HOSTS.includes(host) && new URL(req.url).pathname === "/signin") {
            onSignedOut();
            return false;
          }
          return true;
        }}
      />
      {loading && (
        <View style={[StyleSheet.absoluteFill, s.center, { backgroundColor: C.bg }]}>
          <ActivityIndicator color={C.navy} />
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  signin: { flexGrow: 1, justifyContent: "center", padding: 20 },
  logo: { color: "#fff", fontSize: 32, fontWeight: "800", textAlign: "center" },
  tag: { color: "#dfe6f3", fontSize: 16, textAlign: "center", marginTop: 8, marginBottom: 24, lineHeight: 22 },
  big: { color: "#fff", fontSize: 28, fontWeight: "800", textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 20 },
  h2: { fontSize: 22, fontWeight: "800", color: C.ink, marginBottom: 12 },
  label: { fontSize: 14, fontWeight: "600", color: C.ink, marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 14, fontSize: 17, color: C.ink },
  btn: { backgroundColor: C.navy, borderRadius: 12, paddingVertical: 15, paddingHorizontal: 24, alignItems: "center", marginTop: 18, minWidth: 240 },
  btnGold: { backgroundColor: C.gold },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  err: { color: C.err, marginTop: 12, fontSize: 15 },
  link: { color: C.navy, textAlign: "center", marginTop: 16, fontSize: 15, textDecorationLine: "underline" },
  small: { color: C.muted, fontSize: 13, marginTop: 14, lineHeight: 18 },
});
