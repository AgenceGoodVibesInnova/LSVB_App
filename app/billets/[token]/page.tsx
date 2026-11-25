import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { supabaseService } from "@/lib/supabase/server";
import { loadReceipt } from "@/lib/receipt";
import { euros, longDate, passCode } from "@/lib/format";
import { KIND_LABEL } from "@/lib/catalog";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mes billets", robots: { index: false } };

export default async function Billets({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = supabaseService();
  const r = await loadReceipt(admin, { token });
  if (!r) notFound();
  if (r.status !== "paid") redirect(`/paiement/${token}`);
  const { data: extra } = await admin.from("orders").select("grp, email_sent_at").eq("id", r.id).single();
  const ev = r.event!;
  const total: Record<string, number> = {};
  r.passes.forEach((p) => { total[p.kind] = (total[p.kind] ?? 0) + 1; });
  const qrs = await Promise.all(r.passes.map((p) => QRCode.toString(`LSVB:${passCode(r.id, p.idx, p.token)}`, { type: "svg", margin: 1, errorCorrectionLevel: "M" })));
  const num: Record<string, number> = {};
  const nT = total.ticket ?? 0;

  return (
    <main className="wrap">
      <div className="card">
        <div className="ordhead">
          <div>
            <div className="small muted" style={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em" }}>Commande <span className="num">{r.id}</span></div>
            <h3 style={{ color: "var(--blue-d)", marginTop: 6, fontSize: 22 }}>{ev.name}</h3>
            <div className="small muted">{longDate(ev.starts_at)} · {ev.venue}</div>
            <div className="small muted">{r.buyer_name}{extra?.grp ? ` · ${extra.grp}` : ""}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "var(--blue)" }}>{euros(r.total_cents)}</div>
            <span className="pill ok">Payée</span>
            <div style={{ marginTop: 8 }} className="noprint row"><a className="btn ghost sm" href={`/recu/${token}`}>Ticket de caisse</a><PrintButton /></div>
          </div>
        </div>
        <p className="okbox noprint" style={{ margin: "0 0 16px" }}>
          ✔ Paiement confirmé. Présentez un QR code par personne à l&apos;entrée{r.passes.length > nT ? " ; à la buvette et à la boutique, un seul QR suffit pour toute la commande" : ""}. Cette page, l&apos;e-mail reçu ou une impression : tout fonctionne.
          {extra?.email_sent_at ? " Tous les QR codes vous ont aussi été envoyés par e-mail." : ""}
        </p>
        <div className="tickets">
          {r.passes.map((p, i) => {
            num[p.kind] = (num[p.kind] ?? 0) + 1;
            const c = passCode(r.id, p.idx, p.token);
            return (
              <div key={p.idx} className={`tk${p.kind === "ticket" ? "" : " food"}`}>
                <div className="top">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="" />
                  <div className="kind">{KIND_LABEL[p.kind]} · {num[p.kind]}/{total[p.kind]}</div>
                  <div className="ttl">{ev.name}</div>
                  <div className="when">{longDate(ev.starts_at)}</div>
                </div>
                <div className="cut" />
                <div className="body">
                  <span className="lbl">{p.label}</span>
                  {p.items?.length ? <ul className="bon-items">{p.items.map((i, k) => <li key={k}><b>{i.q}×</b> {i.label}</li>)}</ul> : null}
                  <div className="qrsvg" dangerouslySetInnerHTML={{ __html: qrs[i] }} />
                  <div className="code">{c}</div>
                  <div className="who">{r.buyer_name}</div>
                </div>
                {p.used_at ? <div className="used"><span>{p.kind === "ticket" ? "Utilisé" : p.kind === "food" ? "Servi" : "Remis"}</span></div> : null}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
