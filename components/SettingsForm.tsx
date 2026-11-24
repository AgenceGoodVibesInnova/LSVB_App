"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type Settings = { account_required: boolean; contact_email: string; report_email: string; legal_name: string; legal_address: string; siret: string; vat_number: string };

export default function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [msg, setMsg] = useState("");
  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
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
      <label className="f" style={{ marginTop: 14 }}><span>E-mail de contact affiché aux clients</span><input type="email" value={f.contact_email} onChange={set("contact_email")} placeholder="billetterie@lsvb.fr" /></label>
      <label className="f"><span>E-mail qui reçoit les rapports de TVA</span><input type="email" value={f.report_email} onChange={set("report_email")} placeholder="Vide : l'administrateur qui l'envoie" /></label>
      <div className="sec-title" style={{ marginTop: 10 }}>Mentions du ticket de caisse</div>
      <label className="f"><span>Nom de l&apos;association</span><input type="text" value={f.legal_name} onChange={set("legal_name")} /></label>
      <label className="f"><span>Adresse</span><input type="text" value={f.legal_address} onChange={set("legal_address")} placeholder="Arena Stadium, 11 rue du Bonheur, 85340 Les Sables-d'Olonne" /></label>
      <div className="row">
        <label className="f"><span>SIRET</span><input type="text" value={f.siret} onChange={set("siret")} /></label>
        <label className="f"><span>N° de TVA intracommunautaire</span><input type="text" value={f.vat_number} onChange={set("vat_number")} placeholder="FR…" /></label>
      </div>
      <button className="btn pri">Enregistrer</button>
      {msg ? <p className="small" style={{ fontWeight: 700 }} role="status">{msg}</p> : null}
    </form>
  );
}
