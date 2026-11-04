import { inPhoneApp } from "./passkeys-client";

/**
 * Prints the page, or saves it as a PDF. Inside the phone app the web view
 * can't print by itself, so the page is handed to the app, which opens the
 * phone's own Print / Save as PDF screen.
 */
export function printPage() {
  const bridge = typeof window !== "undefined" ? window.ReactNativeWebView : undefined;
  if (!inPhoneApp() || !bridge) return window.print();
  const page = document.documentElement.cloneNode(true) as HTMLElement;
  // Styles and images are linked by path, so tell the printer where the site is.
  const base = document.createElement("base");
  base.href = window.location.origin + "/";
  page.querySelector("head")?.prepend(base);
  page.querySelectorAll("script").forEach((s) => s.remove());
  bridge.postMessage(JSON.stringify({ print: "<!doctype html>" + page.outerHTML }));
}
