import { notFound, redirect } from "next/navigation";
import SumUpWidget from "@/components/SumUpWidget";
import DemoPayment from "@/components/DemoPayment";
import { supabaseService } from "@/lib/supabase/server";
import { euros, longDate } from "@/lib/format";
import type { Line } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paiement", robots: { index: false } };

export default async function Paiement({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data: o } = await supabaseService()
    .from("orders").select("id, status, total_cents, lines, buyer_name, sumup_checkout_id, events(name, starts_at)")
    .eq("access_token", token).maybeSingle();
  if (!o) notFound();
  if (o.status === "paid") redirect(`/billets/${token}`);
  const ev = (Array.isArray(o.events) ? o.events[0] : o.events) as { name: string; starts_at: string } | null;
  const demo = o.sumup_checkout_id?.startsWith("demo-");

  return (
    <main className="wrap center">
      <div className="card">
        <div className="small muted" style={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em" }}>Commande <span className="pill blue">{o.id}</span></div>
        <h2 style={{ color: "var(--blue-d)", margin: "8px 0 2px", fontSize: 26 }}>Paiement</h2>
        <div className="small muted">{ev?.name}{ev ? ` · ${longDate(ev.starts_at)}` : ""}</div>
        <div style={{ margin: "14px 0" }}>
          {(o.lines as Line[]).map((l, i) => <div className="line small" key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span>{l.q} × {l.label}</span><b>{euros(l.q * l.unit_cents)}</b></div>)}
          <div className="tot" style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid var(--grey)", marginTop: 8, paddingTop: 10 }}>
            <b style={{ textTransform: "uppercase", fontSize: 13 }}>Montant à régler</b><b style={{ fontSize: 24, color: "var(--blue)" }}>{euros(o.total_cents)}</b>
          </div>
        </div>
        {o.status === "cancelled" ? <p className="err">Cette commande a été annulée.</p>
          : !o.sumup_checkout_id ? <p className="err">Le paiement n&apos;a pas été préparé. Recommencez la commande.</p>
          : demo ? <DemoPayment token={token} total={o.total_cents} />
          : <SumUpWidget token={token} checkoutId={o.sumup_checkout_id} />}
        {!demo ? <p className="small muted" style={{ marginTop: 12 }}>🔒 Paiement sécurisé par SumUp. Vos places sont réservées 30 minutes.</p> : null}
      </div>
    </main>
  );
}
