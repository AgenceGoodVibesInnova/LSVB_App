import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { supabaseService } from "@/lib/supabase/server";
import { euros, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type O = { id: string; event_id: string; buyer_name: string; total_cents: number; created_at: string; pay_method: string; passes: { kind: string; used_at: string | null }[] };

export default async function Dashboard() {
  await requireStaff("admin", "/admin");
  const admin = supabaseService();
  const [{ data: evs }, { data: od }, { count: profilesCount }, { count: staffCount }] = await Promise.all([
    admin.from("events").select("id, name, starts_at, capacity, on_sale").order("starts_at"),
    admin.from("orders").select("id, event_id, buyer_name, total_cents, created_at, pay_method, passes(kind, used_at)").eq("status", "paid").order("created_at", { ascending: false }).limit(5000),
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("staff").select("user_id", { count: "exact", head: true }),
  ]);
  const accounts = Math.max(0, (profilesCount ?? 0) - (staffCount ?? 0));
  const orders = (od ?? []) as O[];
  const by = new Map<string, { t: number; f: number; ca: number; n: number }>();
  for (const o of orders) {
    const s = by.get(o.event_id) ?? { t: 0, f: 0, ca: 0, n: 0 };
    s.n++; s.ca += o.total_cents;
    o.passes.forEach((p) => (p.kind === "ticket" ? s.t++ : s.f++));
    by.set(o.event_id, s);
  }
  const tot = [...by.values()].reduce((a, s) => ({ t: a.t + s.t, f: a.f + s.f, ca: a.ca + s.ca }), { t: 0, f: 0, ca: 0 });
  const week = orders.filter((o) => Date.now() - new Date(o.created_at).getTime() < 7 * 86400e3);
  const now = Date.now();
  const upcoming = (evs ?? []).filter((e) => new Date(e.starts_at).getTime() > now - 8 * 3600e3);
  const names = new Map((evs ?? []).map((e) => [e.id, e.name]));

  return (
    <>
      <div className="page-head"><div><div className="kick">Saison 2026-2027</div><h2>Tableau de bord</h2></div><Link className="btn pri sm" href="/admin/matchs">+ Nouveau match</Link></div>
      <div className="kpis">
        <div className="stat"><span>Chiffre d&apos;affaires</span><b>{euros(tot.ca)}</b><div className="small muted">{euros(week.reduce((s, o) => s + o.total_cents, 0))} sur 7 jours</div></div>
        <div className="stat"><span>Billets vendus</span><b>{tot.t}</b><div className="small muted">{orders.length} commandes</div></div>
        <div className="stat o"><span>Buvette / boutique</span><b>{tot.f}</b></div>
        <div className="stat"><span>Comptes clients</span><b>{accounts}</b></div>
      </div>
      <div className="card">
        <div className="sec-title">Prochains matchs</div>
        <div className="tablewrap"><table>
          <thead><tr><th>Date</th><th>Match</th><th>Remplissage</th><th className="num">Billets</th><th className="num">Buvette / boutique</th><th className="num">CA</th><th></th></tr></thead>
          <tbody>
            {upcoming.length ? upcoming.map((e) => {
              const s = by.get(e.id) ?? { t: 0, f: 0, ca: 0, n: 0 };
              const pct = e.capacity ? Math.min(100, Math.round((s.t / e.capacity) * 100)) : null;
              return (
                <tr key={e.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{shortDate(e.starts_at)}</td>
                  <td><b>{e.name}</b>{e.on_sale ? null : <span className="pill warn" style={{ marginLeft: 6 }}>Vente fermée</span>}</td>
                  <td>{pct == null ? <span className="small muted">jauge non définie</span> : <><div className="fill"><i style={{ width: `${pct}%` }} /></div><span className="small muted">{pct} % de {e.capacity}</span></>}</td>
                  <td className="num"><b>{s.t}</b></td>
                  <td className="num">{s.f}</td>
                  <td className="num">{euros(s.ca)}</td>
                  <td><Link className="btn ghost sm" href={`/admin/commandes?match=${e.id}`}>Commandes</Link></td>
                </tr>
              );
            }) : <tr><td colSpan={7} className="muted">Aucun match à venir.</td></tr>}
          </tbody>
        </table></div>
      </div>
      <div className="card">
        <div className="sec-title">Dernières commandes</div>
        <div className="tablewrap"><table>
          <tbody>
            {orders.slice(0, 8).map((o) => (
              <tr key={o.id}>
                <td style={{ whiteSpace: "nowrap" }} className="small muted">{shortDate(o.created_at)}</td>
                <td><b>{o.buyer_name}</b><div className="small muted">{names.get(o.event_id)}</div></td>
                <td className="small">{o.passes.filter((p) => p.kind === "ticket").length} billet(s) · {o.passes.filter((p) => p.kind !== "ticket").length} buvette / boutique</td>
                <td className="num"><b>{euros(o.total_cents)}</b></td>
              </tr>
            ))}
            {!orders.length ? <tr><td className="muted">Pas encore de commande.</td></tr> : null}
          </tbody>
        </table></div>
      </div>
    </>
  );
}
