import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "725 Solar System",
    short_name: "725 Solar",
    description: "Deye solar inverter and battery monitoring dashboard",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0c1431",
    theme_color: "#0c1431",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
