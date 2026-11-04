"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps people inside the app: a tap on any link to another ScholarTasks page
 * switches pages in place instead of reloading the whole site (which on a
 * phone can look like a new browser page). Links to other websites, downloads
 * and links meant for a new tab work as before.
 */
export function InAppLinks() {
  const router = useRouter();
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || a.hasAttribute("download") || (a.target && a.target !== "_self")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return;
      // Same page, only a #section: let the browser scroll.
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;
      e.preventDefault();
      router.push(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [router]);
  return null;
}
