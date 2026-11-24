"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfileForm({ email, initial }: { email: string; initial: { first_name: string; last_name: string; phone: string; postal_code: string; marketing_opt_in: boolean } }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    const r = await fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    setBusy(false); setMsg(r.ok ? "Enregistré ✔" : "Enregistrement impossible.");
    router.refresh();
  }
  async function reset() {
    await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    setMsg("Un lien pour changer de mot de passe vient de vous être envoyé.");
  }
  return (
    <form className="card" onSubmit={save}>
      <div className="sec-title">Mes informations</div>
      <div className="row">
        <label className="f"><span>Prénom</span><input type="text" autoComplete="given-name" value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} /></label>
        <label className="f"><span>Nom</span><input type="text" autoComplete="family-name" value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} /></label>
      </div>
      <div className="row">
        <label className="f"><span>Téléphone</span><input type="tel" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
        <label className="f"><span>Code postal</span><input type="text" autoComplete="postal-code" value={f.postal_code} onChange={(e) => setF({ ...f, postal_code: e.target.value })} /></label>
      </div>
      <label className="f"><span>E-mail</span><input type="email" value={email} disabled /></label>
      <label className="switch" style={{ alignItems: "flex-start", marginBottom: 14, fontWeight: 500 }}>
        <input type="checkbox" checked={f.marketing_opt_in} onChange={(e) => setF({ ...f, marketing_opt_in: e.target.checked })} />
        <span className="small">Je souhaite recevoir les actualités et offres du club par e-mail.</span>
      </label>
      <div className="row"><button className="btn blue" disabled={busy}>Enregistrer</button><button type="button" className="btn ghost" onClick={reset}>Changer mon mot de passe</button></div>
      {msg ? <p className="small" style={{ fontWeight: 700 }} role="status">{msg}</p> : null}
    </form>
  );
}
