"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

const LINKS: [string, string, string][] = [
  ["/admin", "Tableau de bord", "📊"], ["/admin/matchs", "Matchs", "🏀"], ["/admin/produits", "Produits et TVA", "🌮"],
  ["/admin/promos", "Codes promo", "🏷️"], ["/admin/commandes", "Commandes", "🧾"], ["/admin/rapports", "Rapport de TVA", "📑"],
  ["/admin/clients", "Clients", "👥"], ["/admin/equipe", "Équipe", "🦺"], ["/admin/reglages", "Réglages", "⚙️"], ["/admin/scanner", "Scanner", "📷"],
];

export default function AdminNav({ email, role }: { email: string; role: "admin" | "scan" }) {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  return (
    <nav className="adm-side" aria-label="Espace administrateur">
      <div className="adm-role">{role === "admin" ? "Administrateur" : "Bénévole · scanner"}</div>
      {LINKS.filter(([href]) => role === "admin" || href === "/admin/scanner").map(([href, label, ic]) => (
        <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}><span aria-hidden="true">{ic}</span>{label}</Link>
      ))}
      <div className="adm-foot">
        <span>{email}</span>
        <button type="button" className="linkbtn" onClick={async () => { await supabaseBrowser().auth.signOut(); window.location.assign("/admin/connexion"); }}>Se déconnecter</button>
      </div>
    </nav>
  );
}
