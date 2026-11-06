import type { MetadataRoute } from "next";

const BASE = "https://scholartasks.com";

/** Public pages for search engines. Signed-in app pages are left out. */
export default function sitemap(): MetadataRoute.Sitemap {
<<<<<<< HEAD
  const pages = ["", "/features", "/compare", "/schools", "/about", "/contact", "/es", "/tools/hope", "/trades", "/trades/openings", "/trades/post", "/privacy", "/terms"];
=======
  const pages = ["", "/features", "/compare", "/schools", "/about", "/contact", "/es", "/tools/hope", "/trades", "/privacy", "/terms", "/accessibility"];
>>>>>>> origin/main
  return pages.map((p) => ({ url: BASE + p, changeFrequency: "monthly", priority: p === "" ? 1 : 0.7 }));
}
