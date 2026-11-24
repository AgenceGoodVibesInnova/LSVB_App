"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const PUBLIC = [
  { href: "/", label: "Acheter", dot: true },
  { href: "/mes-billets", label: "Mes billets" },
];
const TEAM = [
  { href: "/scanner", label: "Scanner" },
  { href: "/admin", label: "Gestion" },
];

export default function Header() {
  const path = usePathname();
  const team = path.startsWith("/scanner") || path.startsWith("/admin");
  const links = team ? [...PUBLIC.slice(0, 1), ...TEAM] : PUBLIC;
  const on = (h: string) => (h === "/" ? path === "/" || path.startsWith("/paiement") : path.startsWith(h) || (h === "/mes-billets" && path.startsWith("/billets")));
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
              {"dot" in l && l.dot ? <span className="dot" /> : null}{l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
