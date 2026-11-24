"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type L = { href: string; label: string; dot?: boolean };

export default function Header({ logged, role }: { logged: boolean; role: "admin" | "scan" | null }) {
  const path = usePathname();
  const links: L[] = [
    { href: "/", label: "Acheter", dot: true },
    logged ? { href: "/compte", label: "Mon compte" } : { href: "/mes-billets", label: "Mes billets" },
    ...(logged ? [] : [{ href: "/connexion", label: "Connexion" }]),
    ...(role ? [{ href: "/scanner", label: "Scanner" }] : []),
    ...(role === "admin" ? [{ href: "/admin", label: "Gestion" }] : []),
  ];
  const on = (h: string) => (h === "/" ? path === "/" || path.startsWith("/paiement")
    : h === "/admin" ? path.startsWith("/admin") && !path.startsWith("/admin/connexion")
    : path.startsWith(h) || ((h === "/mes-billets" || h === "/compte") && path.startsWith("/billets")));
  return (
    <header>
      <div className="hwrap">
        <Link href="/" className="brand" style={{ color: "#fff", textDecoration: "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Les Sables Vendée Basket" />
          <div>
            <h1>Billetterie</h1>
            <div className="sub">Les Sables <span className="st">★</span> Vendée Basket</div>
          </div>
        </Link>
        <nav>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={on(l.href) ? "on" : ""}>
              {l.dot ? <span className="dot" /> : null}{l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
