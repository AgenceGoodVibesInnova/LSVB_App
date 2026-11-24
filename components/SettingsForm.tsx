"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SettingsForm({ initial }: { initial: { account_required: boolean; contact_email: string } }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [msg, setMsg] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    setMsg(r.ok ? "Réglages enregistrés ✔" : "Enregistrement impossible.");
    router.refresh();
  }
  return (
    <form className="card" onSubmit={save}>
      <div className="sec-title">Achat en ligne</div>
      <label className="switch" style={{ alignItems: "flex-start", marginBottom: 6 }}>
        <input type="checkbox" checked={f.account_required} onChange={(e) => setF({ ...f, account_required: e.target.checked })} />
        <span>Compte client obligatoire pour acheter<span className="small muted" style={{ display: "block", fontWeight: 500 }}>Décoché : on peut aussi acheter sans compte (billets envoyés par e-mail). Coché : création de compte ou connexion avant le paiement.</span></span>
      </label>
      <label className="f" style={{ marginTop: 14 }}><span>E-mail de contact affiché aux clients</span><input type="email" value={f.contact_email} onChange={(e) => setF({ ...f, contact_email: e.target.value })} placeholder="billetterie@lsvb.fr" /></label>
      <button className="btn pri">Enregistrer</button>
      {msg ? <p className="small" style={{ fontWeight: 700 }} role="status">{msg}</p> : null}
    </form>
  );
}
