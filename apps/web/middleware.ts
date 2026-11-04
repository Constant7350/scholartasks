import { NextResponse, type NextRequest } from "next/server";
import { canonicalRedirect } from "./lib/site";

/**
 * Sends visitors from the old addresses (scholartasks.vercel.app, www.) to the
 * main address in APP_URL, keeping the page they asked for. Does nothing until
 * APP_URL is set in Vercel, so the site keeps working before the domain is live.
 */
export function middleware(req: NextRequest) {
  const to = canonicalRedirect(req.headers.get("host"), req.nextUrl.pathname + req.nextUrl.search, process.env.APP_URL);
  return to ? NextResponse.redirect(to, 308) : NextResponse.next();
}

// Pages only: API calls and scheduled jobs (/api/cron) answer on any address.
export const config = { matcher: ["/((?!api/|_next/|favicon|icon|apple-icon|manifest).*)"] };
