import { requireStaff } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { clientList } from "@/lib/clients";
import { euros, fold, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Clients({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaff("admin", "/admin/clients");
  const sp = await searchParams;
  const all = await clientList(supabaseService());
  const q = fold((sp.q ?? "").trim());
  const list = q ? all.filter((c) => [c.name, c.email, c.phone].some((v) => fold(v ?? "").includes(q))) : all;
  return (
    <>
      <div className="page-head"><div><div className="kick">Fichier</div><h2>Clients</h2></div>
        <form className="search" action="/admin/clients"><input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Nom, e-mail, téléphone…" /><button className="btn blue sm">Rechercher</button></form>
      </div>
      <div className="kpis">
        <div className="stat"><span>Clients</span><b>{all.length}</b></div>
        <div className="stat"><span>Avec un compte</span><b>{all.filter((c) => c.account).length}</b></div>
        <div className="stat o"><span>Fidèles (2 matchs et +)</span><b>{all.filter((c) => c.orders >= 2).length}</b></div>
        <div className="stat"><span>Acceptent les actualités</span><b>{all.filter((c) => c.optIn).length}</b></div>
      </div>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span className="small muted" style={{ flex: "none" }}>{list.length} client{list.length > 1 ? "s" : ""}</span>
          <a className="btn ghost sm" style={{ flex: "none" }} href="/api/admin/clients">Télécharger (Excel CSV)</a>
        </div>
        <div className="tablewrap"><table>
          <thead><tr><th>Client</th><th>Compte</th><th className="num">Commandes</th><th className="num">Billets</th><th className="num">Total</th><th>Dernière activité</th></tr></thead>
          <tbody>
            {list.length ? list.map((c) => (
              <tr key={c.email}>
                <td><b>{c.name || "—"}</b><div className="small muted">{c.email}{c.phone ? ` · ${c.phone}` : ""}{c.postal ? ` · ${c.postal}` : ""}</div></td>
                <td>{c.account ? <span className="pill ok">Compte</span> : <span className="pill blue">Sans compte</span>}{c.optIn ? <div className="small" style={{ color: "var(--ok)" }}>✉ actualités</div> : null}</td>
                <td className="num">{c.orders}</td>
                <td className="num">{c.tickets}</td>
                <td className="num"><b>{euros(c.spent)}</b></td>
                <td className="small">{shortDate(c.last)}<div className="muted">{c.lastEvent}</div></td>
              </tr>
            )) : <tr><td colSpan={6} className="muted">Aucun client.</td></tr>}
          </tbody>
        </table></div>
      </div>
    </>
  );
}
