"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** En-tête : côté public Acheter / Mes pass / Mon profil ; côté administration, retour au site. Rien sur la page d'accueil. */
export default function Header() {
  const path = usePathname();
  if (path === "/") return null;
  const admin = path.startsWith("/admin") || path.startsWith("/scanner");
  const links: { href: string; label: string; dot?: boolean }[] = admin
    ? [{ href: "/acheter", label: "← Retour au site" }]
    : [{ href: "/acheter", label: "Acheter", dot: true }, { href: "/pass", label: "Mes pass" }, { href: "/compte", label: "Mon profil" }];
  const on = (h: string) =>
    !admin && (h === "/acheter" ? path.startsWith("/acheter") || path.startsWith("/paiement")
      : h === "/compte" ? ["/compte", "/connexion", "/mot-de-passe", "/recu", "/billets", "/mes-billets"].some((x) => path.startsWith(x))
      : path.startsWith(h));
  return (
    <header>
      <div className="hwrap">
        <Link href={admin ? "/admin" : "/"} className="brand" style={{ color: "#fff", textDecoration: "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Les Sables Vendée Basket" />
          <div>
            <h1>{admin ? "Administration" : "Billetterie"}</h1>
            <div className="sub">Les Sables <span className="st">★</span> Vendée Basket</div>
          </div>
        </Link>
        <nav>
          {admin ? <span className="adm-badge">Espace administrateur</span> : null}
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={on(l.href) ? "on" : ""}>{l.dot ? <span className="dot" /> : null}{l.label}</Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
