import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ScholarTasks",
    short_name: "ScholarTasks",
    description: "College, scholarships and aid, handled.",
    id: "/home",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#faf6f0",
    theme_color: "#14305a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
