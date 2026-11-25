"use client";
import { usePathname } from "next/navigation";

export default function Footer() {
  if (usePathname() === "/") return null;
  return <footer>Les Sables Vendée Basket · Billetterie des matchs à l&apos;Arena · <a href="/admin">Espace administrateur</a></footer>;
}
