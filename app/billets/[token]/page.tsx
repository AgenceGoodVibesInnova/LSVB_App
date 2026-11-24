import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { supabaseService } from "@/lib/supabase/server";
import { euros, longDate, passCode } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mes billets", robots: { index: false } };

type P = { idx: number; kind: "ticket" | "food"; label: string; token: string; used_at: string | null };

export default async function Billets({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data: o } = await supabaseService()
    .from("orders").select("id, status, total_cents, buyer_name, grp, email_sent_at, events(name, starts_at, venue), passes(idx, kind, label, token, used_at)")
    .eq("access_token", token).maybeSingle();
  if (!o) notFound();
  if (o.status !== "paid") redirect(`/paiement/${token}`);
  const ev = (Array.isArray(o.events) ? o.events[0] : o.events) as { name: string; starts_at: string; venue: string };
  const passes = ((o.passes ?? []) as P[]).sort((a, b) => a.idx - b.idx);
  const nT = passes.filter((p) => p.kind === "ticket").length;
  const nF = passes.length - nT;
  const qrs = await Promise.all(passes.map((p) => QRCode.toString(`LSVB:${passCode(o.id, p.idx, p.token)}`, { type: "svg", margin: 1, errorCorrectionLevel: "M" })));
  const num = { ticket: 0, food: 0 };

  return (
    <main className="wrap">
      <div className="card">
        <div className="ordhead">
          <div>
            <div className="small muted" style={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em" }}>Commande <span className="num">{o.id}</span></div>
            <h3 style={{ color: "var(--blue-d)", marginTop: 6, fontSize: 22 }}>{ev.name}</h3>
            <div className="small muted">{longDate(ev.starts_at)} · {ev.venue}</div>
            <div className="small muted">{o.buyer_name}{o.grp ? ` · ${o.grp}` : ""}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "var(--blue)" }}>{euros(o.total_cents)}</div>
            <span className="pill ok">Payée</span>
            <div style={{ marginTop: 8 }} className="noprint"><PrintButton /></div>
          </div>
        </div>
        <p className="okbox noprint" style={{ margin: "0 0 16px" }}>
          ✔ Paiement confirmé. Présentez un QR code par personne à l&apos;entrée{nF ? ", et vos bons à la buvette" : ""}. Capture d&apos;écran, impression ou cette page sur téléphone : tout fonctionne.
          {o.email_sent_at ? " Les billets vous ont aussi été envoyés par e-mail." : ""}
        </p>
        <div className="tickets">
          {passes.map((p, i) => {
            num[p.kind]++;
            const code = passCode(o.id, p.idx, p.token);
            return (
              <div key={p.idx} className={`tk${p.kind === "food" ? " food" : ""}`}>
                <div className="top">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="" />
                  <div className="kind">{p.kind === "food" ? "Bon buvette" : "Billet d'entrée"} · {num[p.kind]}/{p.kind === "food" ? nF : nT}</div>
                  <div className="ttl">{ev.name}</div>
                  <div className="when">{longDate(ev.starts_at)}</div>
                </div>
                <div className="cut" />
                <div className="body">
                  <span className="lbl">{p.label}</span>
                  <div className="qrsvg" dangerouslySetInnerHTML={{ __html: qrs[i] }} />
                  <div className="code">{code}</div>
                  <div className="who">{o.buyer_name}</div>
                </div>
                {p.used_at ? <div className="used"><span>{p.kind === "food" ? "Servi" : "Utilisé"}</span></div> : null}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
