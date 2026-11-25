import type { MetadataRoute } from "next";

/** Installation sur l'écran d'accueil du téléphone (mode application). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LSVB Billetterie",
    short_name: "LSVB",
    description: "Billets, buvette et boutique des matchs des Sables Vendée Basket à l'Arena.",
    start_url: "/",
    display: "standalone",
    background_color: "#1F5190",
    theme_color: "#1F5190",
    lang: "fr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
