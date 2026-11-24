"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { euros } from "@/lib/format";

/** Paiement simulé, affiché tant que SumUp n'est pas branché (équipe uniquement). */
export default function DemoPayment({ token, total }: { token: string; total: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function pay() {
    setBusy(true); setErr("");
    const res = await fetch(`/api/orders/${token}/verify`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (data.status === "paid") return router.replace(`/billets/${token}`);
    setBusy(false);
    setErr(data.error ?? "Le paiement simulé n'a pas abouti.");
  }

  return (
    <div>
      <p className="notice"><strong>Paiement simulé</strong> · SumUp n&apos;est pas encore branché. Aucune carte n&apos;est demandée et rien n&apos;est débité. La commande suit ensuite le parcours réel : QR codes, e-mail, scan.</p>
      {err ? <p className="err" role="alert">{err}</p> : null}
      <button type="button" className="btn pri full" style={{ marginTop: 12 }} onClick={pay} disabled={busy}>{busy ? "Paiement en cours…" : `Simuler le paiement de ${euros(total)}`}</button>
    </div>
  );
}
