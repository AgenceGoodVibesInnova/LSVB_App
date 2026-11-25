import type { Metadata, Viewport } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Billetterie LSVB", template: "%s · Billetterie LSVB" },
  description: "Billets et buvette des matchs des Sables Vendée Basket à l'Arena.",
  icons: { icon: "/logo.png", apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "LSVB Billetterie", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { themeColor: "#1F5190", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
