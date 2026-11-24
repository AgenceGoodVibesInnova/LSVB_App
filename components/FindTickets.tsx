"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function FindTickets() {
  const router = useRouter();
  const [mine, setMine] = useState<{ id: string; token: string }[]>([]);
  const [id, setId] = useState("");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { try { setMine(JSON.parse(localStorage.getItem("lsvb_orders") ?? "[]")); } catch {} }, []);

  async function go(resend: boolean) {
    setMsg(""); setBusy(true);
    const res = await fetch("/api/orders/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, email, resend }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(data.error ?? "Recherche impossible.");
    if (resend) return setMsg(data.sent ? "C'est envoyé : regardez votre boîte de réception (et les indésirables)." : data.status === "paid" ? "L'envoi par e-mail n'est pas disponible pour le moment : ouvrez vos billets ci-dessous." : "Cette commande n'est pas encore payée.");
    router.push(data.status === "paid" ? `/billets/${data.token}` : `/paiement/${data.token}`);
  }

  return (
    <>
      <div className="card">
        <div className="sec-title">Retrouver mes billets</div>
        <p className="small muted" style={{ marginTop: 0 }}>Le numéro de commande (8 caractères) figure dans l&apos;e-mail de confirmation et sous chaque QR code.</p>
        <form onSubmit={(e) => { e.preventDefault(); go(false); }}>
          <div className="row">
            <label className="f"><span>N° de commande</span><input type="text" value={id} onChange={(e) => setId(e.target.value.toUpperCase())} placeholder="K7P2QX9M" autoCapitalize="characters" required /></label>
            <label className="f"><span>E-mail</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          </div>
          <div className="row">
            <button className="btn blue" disabled={busy}>Afficher mes billets</button>
            <button type="button" className="btn ghost" disabled={busy || !id || !email} onClick={() => go(true)}>Me les renvoyer par e-mail</button>
          </div>
          {msg ? <p className="small" style={{ fontWeight: 700 }} role="status">{msg}</p> : null}
        </form>
      </div>
      {mine.length ? (
        <div className="card">
          <div className="sec-title">Commandes passées sur cet appareil</div>
          {mine.map((m) => <div key={m.id} className="line" style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--grey)" }}><span className="num" style={{ fontFamily: "ui-monospace,monospace", fontWeight: 800 }}>{m.id}</span><a href={`/billets/${m.token}`}>Voir les billets →</a></div>)}
        </div>
      ) : null}
    </>
  );
}
