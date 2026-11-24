import Link from "next/link";
import { supabaseService } from "@/lib/supabase/server";
import { euros, shortDate } from "@/lib/format";
import { HOLD_MINUTES, type Line, type Prices } from "@/lib/catalog";
import type { AdminEvent } from "@/components/EventEditor";
import OrderActions from "@/components/OrderActions";

export const dynamic = "force-dynamic";

type O = { id: string; receipt_no: string | null; promo_code: string | null; discount_cents: number; created_at: string; buyer_name: string; email: string; phone: string | null; grp: string | null; lines: Line[]; total_cents: number; status: string; pay_method: string; access_token: string; passes: { kind: string; used_at: string | null }[] };

export default async function Commandes({ searchParams }: { searchParams: Promise<{ match?: string; q?: string }> }) {
  const admin = supabaseService();
  const [{ data: evs }, { data: sales }] = await Promise.all([
    admin.from("events").select("*").order("starts_at"),
    admin.rpc("event_sales", { p_hold_minutes: HOLD_MINUTES }),
  ]);
  const sold = new Map(((sales ?? []) as { event_id: string; sold: number }[]).map((s) => [s.event_id, s.sold]));
  const events: AdminEvent[] = (evs ?? []).map((e) => ({ id: e.id, name: e.name, startsAt: e.starts_at, venue: e.venue, capacity: e.capacity, onSale: e.on_sale, journee: e.journee, prices: e.prices as Prices, sold: sold.get(e.id) ?? 0, salesEndAt: e.sales_end_at, shopEndAt: e.shop_end_at }));
  const sp = await searchParams;
  const now = Date.now();
  const sel = events.find((e) => e.id === sp.match) ?? events.find((e) => new Date(e.startsAt).getTime() > now - 8 * 3600e3) ?? events[events.length - 1];

  const { data: od } = sel
    ? await admin.from("orders").select("id, receipt_no, promo_code, discount_cents, created_at, buyer_name, email, phone, grp, lines, total_cents, status, pay_method, access_token, passes(kind, used_at)")
        .eq("event_id", sel.id).in("status", ["paid", "pending"]).order("created_at", { ascending: false })
    : { data: [] };
  const all = (od ?? []) as O[];
  const q = (sp.q ?? "").trim().toLowerCase();
  const orders = q ? all.filter((o) => [o.id, o.buyer_name, o.email, o.grp ?? "", o.phone ?? ""].some((v) => v.toLowerCase().includes(q))) : all;
  const paid = all.filter((o) => o.status === "paid");
  const count = (k: string) => paid.reduce((n, o) => n + o.passes.filter((p) => p.kind === k).length, 0);
  const entered = paid.reduce((n, o) => n + o.passes.filter((p) => p.kind === "ticket" && p.used_at).length, 0);
  // Bon de préparation : ce qu'il faut commander et préparer pour ce match
  const prep = new Map<string, Map<string, number>>();
  const addPrep = (group: string, label: string, q: number) => { const g = prep.get(group) ?? new Map(); g.set(label, (g.get(label) ?? 0) + q); prep.set(group, g); };
  paid.forEach((o) => o.lines.forEach((l) => {
    const cat = l.cat ?? (["full", "reduced", "child"].includes(l.k) ? "billet" : "snack");
    if (cat === "billet") return;
    const name = l.label.replace(/ \(.*\)$/, "");
    if (cat === "menu") { addPrep("Menus", name, l.q); if (l.drink) addPrep("Boissons (menus compris)", l.drink, l.q); }
    else if (cat === "boisson") addPrep("Boissons (menus compris)", name, l.q);
    else if (cat === "boutique") addPrep("Boutique", l.label, l.q);
    else addPrep(cat === "confiserie" ? "Confiserie" : "Snacks", name, l.q);
  }));
  const ca = paid.reduce((s, o) => s + o.total_cents, 0);
  const online = paid.filter((o) => o.pay_method === "sumup").reduce((s, o) => s + o.total_cents, 0);

  return (
    <>
      <div className="page-head"><div><div className="kick">Ventes</div><h2>Commandes</h2></div>
        <form className="search" action="/admin/commandes"><input type="hidden" name="match" value={sel?.id ?? ""} /><input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Nom, e-mail, n° de commande…" /><button className="btn blue sm">Rechercher</button></form>
      </div>
      <div className="card">
        <div className="row" style={{ gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {events.map((e) => (
            <Link key={e.id} href={`/admin/commandes?match=${e.id}`} className={`btn sm ${e.id === sel?.id ? "blue" : "ghost"}`} style={{ flex: "none" }}>{shortDate(e.startsAt).slice(0, 5)} · {e.name.replace(/^LSVB vs /, "")}</Link>
          ))}
        </div>
        {sel ? (<>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <b style={{ flex: "none", color: "var(--blue-d)" }}>{sel.name} · {shortDate(sel.startsAt)}</b>
            <a className="btn ghost sm" style={{ flex: "none" }} href={`/api/admin/export?event=${sel.id}`}>Télécharger (Excel CSV)</a>
          </div>
          <div className="kpis">
            <div className="stat"><span>Billets vendus</span><b>{count("ticket")}{sel.capacity ? <small style={{ fontSize: 14, color: "var(--muted)" }}> / {sel.capacity}</small> : null}</b></div>
            <div className="stat"><span>Entrées scannées</span><b>{entered}</b></div>
            <div className="stat o"><span>Buvette / boutique</span><b>{count("food") + count("shop")}</b><div className="small muted" style={{ marginTop: 2 }}>articles commandés</div></div>
            <div className="stat"><span>Chiffre d&apos;affaires</span><b>{euros(ca)}</b><div className="small muted">dont SumUp en ligne {euros(online)}</div></div>
          </div>
          {prep.size ? (
            <div className="prep">
              <div className="subhead" style={{ marginTop: 0 }}>À préparer pour ce match (commandes payées)</div>
              <div className="prep-grid">
                {["Menus", "Snacks", "Boissons (menus compris)", "Confiserie", "Boutique"].filter((g) => prep.has(g)).map((g) => (
                  <div key={g}><b>{g}</b>{[...prep.get(g)!.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => <div key={k} className="small"><b>{v}</b> × {k}</div>)}</div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="tablewrap"><table>
            <thead><tr><th>N°</th><th>Acheteur</th><th>Contenu</th><th className="num">Total</th><th className="num">Scannés</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {orders.length ? orders.map((o) => (
                <tr key={o.id}>
                  <td><span style={{ fontFamily: "ui-monospace,monospace", fontWeight: 700 }}>{o.id}</span><div className="small muted">{shortDate(o.created_at)}</div>{o.receipt_no ? <div className="small muted">{o.receipt_no}</div> : null}</td>
                  <td><b>{o.buyer_name}</b><div className="small muted">{o.email}{o.phone ? ` · ${o.phone}` : ""}{o.grp ? ` · ${o.grp}` : ""}</div></td>
                  <td className="small">{o.lines.map((l, i) => <div key={i}>{l.q}× {l.label}</div>)}</td>
                  <td className="num"><b>{euros(o.total_cents)}</b>{o.promo_code ? <div className="small" style={{ color: "var(--ok)" }}>{o.promo_code} −{euros(o.discount_cents)}</div> : null}</td>
                  <td className="num">{o.passes.filter((p) => p.used_at).length} / {o.passes.length}</td>
                  <td>{o.status === "paid" ? <span className="pill ok">{o.pay_method === "sumup" ? "Payé SumUp" : o.pay_method === "demo" ? "Simulé" : o.pay_method === "gratuit" ? "Offert" : "Encaissé"}</span> : <span className="pill warn">En attente</span>}</td>
                  <td><OrderActions id={o.id} token={o.access_token} paid={o.status === "paid"} /></td>
                </tr>
              )) : <tr><td colSpan={7} className="muted">{q ? "Aucune commande ne correspond à la recherche." : "Aucune commande pour ce match."}</td></tr>}
            </tbody>
          </table></div>
        </>) : <p className="muted">Créez un premier match.</p>}
      </div>
    </>
  );
}
