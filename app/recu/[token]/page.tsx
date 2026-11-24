import { notFound } from "next/navigation";
import { supabaseService } from "@/lib/supabase/server";
import { loadReceipt, PAY_LABEL, pct } from "@/lib/receipt";
import { euros, longDate } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ticket de caisse", robots: { index: false } };

export default async function Recu({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await loadReceipt(supabaseService(), { token });
  if (!r || r.status !== "paid") notFound();
  const l = r.legal;
  return (
    <main className="wrap" style={{ maxWidth: 620 }}>
      <div className="card receipt">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: "none" }}>
            <div className="kick" style={{ fontSize: 11, fontWeight: 900, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--orange-d)" }}>Ticket de caisse</div>
            <h2 style={{ color: "var(--blue-d)", fontSize: 24 }}>{r.receipt_no}</h2>
          </div>
          <span className="noprint" style={{ flex: "none" }}><PrintButton /></span>
        </div>
        <p className="small" style={{ margin: "10px 0" }}>
          <b>{l.legal_name}</b>{l.legal_address ? <><br />{l.legal_address}</> : null}
          {l.siret ? <><br />SIRET {l.siret}</> : null}{l.vat_number ? <> · TVA intracommunautaire {l.vat_number}</> : null}
        </p>
        <p className="small muted" style={{ margin: "0 0 14px" }}>
          {r.paid_at ? new Date(r.paid_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) : ""} · commande {r.id} · {r.buyer_name}<br />
          {r.event ? `${r.event.name} — ${longDate(r.event.starts_at)}` : ""}
        </p>
        <table>
          <thead><tr><th>Article</th><th className="num">Qté</th><th className="num">P.U. TTC</th><th className="num">TVA</th><th className="num">Total TTC</th></tr></thead>
          <tbody>
            {r.lines.map((x, i) => (
              <tr key={i}><td>{x.label}</td><td className="num">{x.q}</td><td className="num">{euros(x.unit_cents)}</td><td className="num">{pct(x.vat_rate ?? 0)}</td><td className="num">{euros(x.q * x.unit_cents)}</td></tr>
            ))}
            {r.discount_cents ? <tr><td colSpan={4} style={{ color: "var(--ok)" }}>Code promo {r.promo_code}</td><td className="num" style={{ color: "var(--ok)" }}>−{euros(r.discount_cents)}</td></tr> : null}
            <tr><td colSpan={4}><b>Total TTC</b></td><td className="num"><b>{euros(r.total_cents)}</b></td></tr>
          </tbody>
        </table>
        <table style={{ marginTop: 14 }}>
          <thead><tr><th>Taux de TVA</th><th className="num">Base HT</th><th className="num">TVA</th><th className="num">TTC</th></tr></thead>
          <tbody>
            {r.vat.map((v) => <tr key={v.rate}><td>{pct(v.rate)}</td><td className="num">{euros(v.ht_cents)}</td><td className="num">{euros(v.vat_cents)}</td><td className="num">{euros(v.ttc_cents)}</td></tr>)}
            <tr><td><b>Total</b></td><td className="num"><b>{euros(r.vat.reduce((s, v) => s + v.ht_cents, 0))}</b></td><td className="num"><b>{euros(r.vat.reduce((s, v) => s + v.vat_cents, 0))}</b></td><td className="num"><b>{euros(r.total_cents)}</b></td></tr>
          </tbody>
        </table>
        <p className="small muted" style={{ marginTop: 14 }}>Règlement : {PAY_LABEL[r.pay_method] ?? r.pay_method}.{r.is_demo ? " Commande d'essai, aucun débit." : ""}</p>
        <p className="noprint small"><a href={`/billets/${r.access_token}`}>← Mes QR codes</a></p>
      </div>
    </main>
  );
}
