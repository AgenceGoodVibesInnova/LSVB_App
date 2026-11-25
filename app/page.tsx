import Link from "next/link";

export const metadata = { title: "Billetterie LSVB" };

/** Première page de l'application : deux portes d'entrée. */
export default function Accueil() {
  return (
    <main className="home">
      <div className="home-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="home-logo" src="/logo.png" alt="Les Sables Vendée Basket" />
        <h1>Billetterie</h1>
        <div className="home-sub">Les Sables <span>★</span> Vendée Basket</div>
        <Link className="home-main" href="/compte">
          <span className="hi" aria-hidden="true">🎟️</span>
          <span><b>Mon compte client</b><small>Billets, buvette, boutique, mes pass et factures</small></span>
        </Link>
        <Link className="home-admin" href="/admin">Espace admin</Link>
      </div>
    </main>
  );
}
