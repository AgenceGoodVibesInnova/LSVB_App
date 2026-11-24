import type { Metadata, Viewport } from "next";
import Header from "@/components/Header";
import { currentUser, staffMember } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Billetterie LSVB", template: "%s · Billetterie LSVB" },
  description: "Billets et buvette des matchs des Sables Vendée Basket à l'Arena.",
  icons: { icon: "/logo.png" },
};
export const viewport: Viewport = { themeColor: "#1F5190" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, staff] = await Promise.all([currentUser(), staffMember()]);
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Header logged={!!user} role={staff?.role ?? null} />
        {children}
        <footer>Les Sables Vendée Basket · Billetterie des matchs à l&apos;Arena · <a href="/admin/connexion">Espace administrateur</a></footer>
      </body>
    </html>
  );
}
