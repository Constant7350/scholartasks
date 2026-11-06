"use client";

/**
 * Sharing and store ratings that work on the website and inside the phone app.
 * The phone app (version 0.2 and later) shows the phone's own share sheet and
 * App Store / Google Play rating box when the website asks it to. Older app
 * versions and plain browsers fall back to the browser's share sheet, if any.
 */

declare global { interface Window { ReactNativeWebView?: { postMessage: (s: string) => void } } }

const appVersion = () => {
  const m = typeof navigator !== "undefined" ? /ScholarTasksApp\/(\d+)\.(\d+)/.exec(navigator.userAgent) : null;
  return m ? Number(m[1]) * 100 + Number(m[2]) : 0;
};
/** The phone app is new enough to open its own share sheet and rating box. */
const appBridge = () => (appVersion() >= 2 && typeof window !== "undefined" ? window.ReactNativeWebView : undefined);

/** "iphone" or "android" inside the phone app, otherwise "web". */
export function platform(): "ios" | "android" | "web" {
  if (typeof navigator === "undefined" || !/ScholarTasksApp\//.test(navigator.userAgent)) return "web";
  return /Android/i.test(navigator.userAgent) ? "android" : "ios";
}

/** True when this phone or browser has a share sheet ("More ways…" button). */
export function canShareSheet(): boolean {
  return !!appBridge() || (typeof navigator !== "undefined" && typeof navigator.share === "function");
}

export function shareSheet(m: { title: string; text: string }) {
  const bridge = appBridge();
  if (bridge) return bridge.postMessage(JSON.stringify({ share: m }));
  if (typeof navigator !== "undefined" && navigator.share) navigator.share(m).catch(() => {});
}

/** True inside a phone app that can open the App Store / Google Play rating box. */
export function canRateInStore(): boolean {
  return !!appBridge();
}

/** Asks the phone to show the App Store / Google Play rating box. */
export function rateInStore() {
  appBridge()?.postMessage(JSON.stringify({ rate: true }));
}
