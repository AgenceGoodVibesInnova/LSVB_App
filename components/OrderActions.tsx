"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** Actions sur une commande : voir les QR, encaisser sur place, renvoyer l'e-mail, annuler. */
export default function OrderActions({ id, token, paid }: { id: string; token: string; paid: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<null | "paid" | "cancel">(null);
  const [msg, setMsg] = useState("");
  async function act(action: string) {
    setBusy(true); setMsg("");
    const r = await fetch(`/api/admin/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false); setAsk(null);
    if (action === "resend") setMsg(d.sent ? "E-mail envoyé" : "Envoi impossible");
    router.refresh();
  }
  if (ask) return (
    <span className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
      <button className="btn pri sm" disabled={busy} onClick={() => act(ask)}>{ask === "paid" ? "Confirmer l'encaissement" : "Confirmer l'annulation"}</button>
      <button className="btn ghost sm" onClick={() => setAsk(null)}>Non</button>
    </span>
  );
  return (
    <span className="row" style={{ gap: 4, flexWrap: "nowrap", justifyContent: "flex-end" }}>
      {paid ? <a className="btn ghost sm" href={`/billets/${token}`} target="_blank" rel="noreferrer">QR</a> : <button className="btn ghost sm" onClick={() => setAsk("paid")}>Encaissé</button>}
      {paid ? <button className="btn ghost sm" disabled={busy} onClick={() => act("resend")} title="Renvoyer les billets par e-mail">✉</button> : <button className="btn ghost sm" onClick={() => setAsk("cancel")} title="Annuler la commande">✕</button>}
      {msg ? <span className="small muted">{msg}</span> : null}
    </span>
  );
}
