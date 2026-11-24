import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { euros, shortDate } from "@/lib/format";
import { HOLD_MINUTES, type Line, type Prices } from "@/lib/catalog";
import EventEditor, { type AdminEvent } from "@/components/EventEditor";
import OrderActions from "@/components/OrderActions";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gestion", robots: { index: false } };

type O = { id: string; created_at: string; buyer_name: string; email: string; phone: string | null; grp: string | null; lines: Line[]; total_cents: number; status: string; pay_method: string; access_token: string; passes: { kind: string; used_at: string | null }[] };

export default async function Admin({ searchParams }: { searchParams: Promise<{ match?: string }> }) {
  const me = await requireStaff("admin", "/admin");
  const admin = supabaseService();
  const [{ data: evs }, { data: sales }] = await Promise.all([
    admin.from("events").select("*").order("starts_at"),
    admin.rpc("event_sales", { p_hold_minutes: HOLD_MINUTES }),
  ]);
  const sold = new Map(((sales ?? []) as { event_id: string; sold: number }[]).map((s) => [s.event_id, s.sold]));
  const events: AdminEvent[] = (evs ?? []).map((e) => ({ id: e.id, name: e.name, startsAt: e.starts_at, venue: e.venue, capacity: e.capacity, onSale: e.on_sale, journee: e.journee, prices: e.prices as Prices, sold: sold.get(e.id) ?? 0 }));
  const sp = await searchParams;
  const now = Date.now();
  const sel = events.find((e) => e.id === sp.match) ?? events.find((e) => new Date(e.startsAt).getTime() > now - 8 * 3600e3) ?? events[events.length - 1];

  const { data: od } = sel
    ? await admin.from("orders").select("id, created_at, buyer_name, email, phone, grp, lines, total_cents, status, pay_method, access_token, passes(kind, used_at)")
        .eq("event_id", sel.id).in("status", ["paid", "pending"]).order("created_at", { ascending: false })
    : { data: [] };
  const orders = (od ?? []) as O[];
  const paid = orders.filter((o) => o.status === "paid");
  const count = (k: string) => paid.reduce((n, o) => n + o.passes.filter((p) => p.kind === k).length, 0);
  const entered = paid.reduce((n, o) => n + o.passes.filter((p) => p.kind === "ticket" && p.used_at).length, 0);
  const food: Record<string, number> = {};
  paid.forEach((o) => o.lines.filter((l) => !["full", "reduced", "child"].includes(l.k)).forEach((l) => { food[l.label] = (food[l.label] ?? 0) + l.q; }));
  const ca = paid.reduce((s, o) => s + o.total_cents, 0);
  const online = paid.filter((o) => o.pay_method === "sumup").reduce((s, o) => s + o.total_cents, 0);

  return (
    <main className="wrap">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span className="small muted" style={{ flex: "none" }}>Connecté : <b>{me.email}</b> (administrateur)</span>
        <span style={{ flex: "none" }}><LogoutButton /></span>
      </div>
      <EventEditor events={events} />

      <div className="card" style={{ marginTop: 16 }}>
        <div className="sec-title">Commandes</div>
        <div className="row" style={{ gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {events.map((e) => (
            <Link key={e.id} href={`/admin?match=${e.id}`} className={`btn sm ${e.id === sel?.id ? "blue" : "ghost"}`} style={{ flex: "none" }}>{shortDate(e.startsAt).slice(0, 5)} · {e.name.replace(/^LSVB vs /, "")}</Link>
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
            <div className="stat o"><span>Articles buvette</span><b>{count("food")}</b><div className="small muted" style={{ marginTop: 2 }}>{Object.entries(food).map(([k, v]) => `${v} ${k}`).join(" · ") || "—"}</div></div>
            <div className="stat"><span>Chiffre d&apos;affaires</span><b>{euros(ca)}</b><div className="small muted">dont SumUp en ligne {euros(online)}</div></div>
          </div>
          <div className="tablewrap"><table>
            <thead><tr><th>N°</th><th>Acheteur</th><th>Contenu</th><th className="num">Total</th><th className="num">Scannés</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {orders.length ? orders.map((o) => (
                <tr key={o.id}>
                  <td><span style={{ fontFamily: "ui-monospace,monospace", fontWeight: 700 }}>{o.id}</span><div className="small muted">{shortDate(o.created_at)}</div></td>
                  <td><b>{o.buyer_name}</b><div className="small muted">{o.email}{o.phone ? ` · ${o.phone}` : ""}{o.grp ? ` · ${o.grp}` : ""}</div></td>
                  <td className="small">{o.lines.map((l, i) => <div key={i}>{l.q}× {l.label}</div>)}</td>
                  <td className="num"><b>{euros(o.total_cents)}</b></td>
                  <td className="num">{o.passes.filter((p) => p.used_at).length} / {o.passes.length}</td>
                  <td>{o.status === "paid" ? <span className="pill ok">{o.pay_method === "sumup" ? "Payé SumUp" : o.pay_method === "demo" ? "Simulé" : "Encaissé"}</span> : <span className="pill warn">En attente</span>}</td>
                  <td><OrderActions id={o.id} token={o.access_token} paid={o.status === "paid"} /></td>
                </tr>
              )) : <tr><td colSpan={7} className="muted">Aucune commande pour ce match.</td></tr>}
            </tbody>
          </table></div>
        </>) : <p className="muted">Créez un premier match.</p>}
      </div>
    </main>
  );
}
