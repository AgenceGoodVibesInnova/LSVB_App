import Link from "next/link";
import { supabaseService } from "@/lib/supabase/server";
import { buildReport } from "@/lib/report";
import { CATEGORIES } from "@/lib/catalog";
import { euros, shortDate } from "@/lib/format";
import PrintButton from "@/components/PrintButton";
import SendReport from "@/components/SendReport";

export const dynamic = "force-dynamic";
const pct = (r: number) => `${r.toLocaleString("fr-FR")} %`;

export default async function Rapports({ searchParams }: { searchParams: Promise<{ match?: string }> }) {
  const admin = supabaseService();
  const { data: evs } = await admin.from("events").select("id, name, starts_at").order("starts_at");
  const events = evs ?? [];
  const sp = await searchParams;
  const now = Date.now();
  const sel = sp.match === "all" ? "all" : events.find((e) => e.id === sp.match)?.id ?? (events.filter((e) => new Date(e.starts_at).getTime() < now + 8 * 3600e3).pop() ?? events[0])?.id ?? "all";
  const r = await buildReport(admin, sel);
  return (
    <>
      <div className="page-head"><div><div className="kick">Comptabilité</div><h2>Rapport de TVA</h2></div>
        <div className="row noprint" style={{ flex: "none", gap: 8 }}>
          <a className="btn blue sm" href={`/api/admin/report?event=${sel}`}>Télécharger (Excel CSV)</a>
          <PrintButton />
          <SendReport event={sel} />
        </div>
      </div>
      <div className="row noprint" style={{ gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        <Link href="/admin/rapports?match=all" className={`btn sm ${sel === "all" ? "blue" : "ghost"}`} style={{ flex: "none" }}>Saison</Link>
        {events.map((e) => <Link key={e.id} href={`/admin/rapports?match=${e.id}`} className={`btn sm ${e.id === sel ? "blue" : "ghost"}`} style={{ flex: "none" }}>{shortDate(e.starts_at).slice(0, 5)} · {e.name.replace(/^LSVB vs /, "")}</Link>)}
      </div>
      <div className="card">
        <div className="sec-title">{r.title}{r.event ? <span className="muted small" style={{ textTransform: "none", letterSpacing: 0 }}> — {shortDate(r.event.starts_at)}</span> : null}</div>
        <div className="kpis">
          <div className="stat"><span>Total TTC</span><b>{euros(r.ttc)}</b><div className="small muted">{r.orders} commandes payées</div></div>
          <div className="stat"><span>Total HT</span><b>{euros(r.ht)}</b></div>
          <div className="stat o"><span>TVA collectée</span><b>{euros(r.vat)}</b></div>
          <div className="stat"><span>Remises (codes promo)</span><b>{euros(r.discount)}</b></div>
        </div>
        <div className="subhead">TVA par taux</div>
        <div className="tablewrap"><table>
          <thead><tr><th>Taux</th><th className="num">Base HT</th><th className="num">TVA</th><th className="num">TTC</th></tr></thead>
          <tbody>
            {r.byRate.map((v) => <tr key={v.rate}><td><b>{pct(v.rate)}</b></td><td className="num">{euros(v.ht_cents)}</td><td className="num">{euros(v.vat_cents)}</td><td className="num">{euros(v.ttc_cents)}</td></tr>)}
            <tr><td><b>Total</b></td><td className="num"><b>{euros(r.ht)}</b></td><td className="num"><b>{euros(r.vat)}</b></td><td className="num"><b>{euros(r.ttc)}</b></td></tr>
          </tbody>
        </table></div>
      </div>
      <div className="card">
        <div className="sec-title">Détail par produit</div>
        <div className="tablewrap"><table>
          <thead><tr><th>Produit</th><th>Catégorie</th><th className="num">Taux</th><th className="num">Qté</th><th className="num">Remises</th><th className="num">TTC</th><th className="num">HT</th><th className="num">TVA</th></tr></thead>
          <tbody>
            {r.byProduct.length ? r.byProduct.map((p, i) => (
              <tr key={i}><td><b>{p.label}</b></td><td className="small">{CATEGORIES.find((c) => c.key === p.cat)?.label}</td><td className="num">{pct(p.rate)}</td><td className="num">{p.q}</td><td className="num">{p.discount ? `−${euros(p.discount)}` : "—"}</td><td className="num">{euros(p.ttc)}</td><td className="num">{euros(p.ht)}</td><td className="num">{euros(p.vat)}</td></tr>
            )) : <tr><td colSpan={8} className="muted">Aucune vente payée.</td></tr>}
          </tbody>
        </table></div>
      </div>
      <div className="grid2">
        <div className="card">
          <div className="sec-title">Par catégorie</div>
          <table><tbody>{r.byCategory.map((c) => <tr key={c.label}><td>{c.label}</td><td className="num">{c.q}</td><td className="num"><b>{euros(c.ttc)}</b></td></tr>)}</tbody></table>
        </div>
        <div className="card">
          <div className="sec-title">Règlements et codes promo</div>
          <table><tbody>
            {r.byPayment.map((p) => <tr key={p.label}><td>{p.label}</td><td className="num">{p.n}</td><td className="num"><b>{euros(p.ttc)}</b></td></tr>)}
            {r.byPromo.map((p) => <tr key={p.code}><td>Code {p.code}</td><td className="num">{p.n}</td><td className="num">−{euros(p.discount)}</td></tr>)}
          </tbody></table>
        </div>
      </div>
      <p className="small muted">Commandes payées uniquement (les commandes d&apos;essai en paiement simulé sont exclues). TVA calculée par taux sur les montants TTC après remise. À transmettre à votre expert-comptable.</p>
    </>
  );
}
