/** Addresses that should forward to the main address once it is set. */
export const OLD_HOSTS = ["scholartasks.vercel.app", "www.scholartasks.com"];

/**
 * Where to send a visitor, or null to let the page load.
 * Only the listed old addresses forward; preview builds and localhost never do.
 */
export function canonicalRedirect(hostHeader: string | null, pathAndQuery: string, appUrl: string | undefined): string | null {
  if (!appUrl || !hostHeader) return null;
  let target: URL;
  try {
    target = new URL(appUrl);
  } catch {
    return null;
  }
  if (target.protocol !== "https:") return null;
  const host = (hostHeader.split(":")[0] ?? "").toLowerCase();
  if (host === target.hostname || !OLD_HOSTS.includes(host)) return null;
  const path = pathAndQuery.startsWith("/") ? pathAndQuery : "/" + pathAndQuery;
  return target.origin + path;
}
