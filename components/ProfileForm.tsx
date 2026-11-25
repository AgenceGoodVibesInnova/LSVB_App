"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProfileData = { first_name: string; last_name: string; address: string; postal_code: string; city: string; phone: string; marketing_opt_in: boolean };

/** Mon profil : nom, prénom, adresse, code postal, ville, téléphone, actualités du club. */
export default function ProfileForm({ email, initial }: { email: string; initial: ProfileData }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof ProfileData) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
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
        <label className="f"><span>Nom</span><input type="text" autoComplete="family-name" value={f.last_name} onChange={set("last_name")} /></label>
        <label className="f"><span>Prénom</span><input type="text" autoComplete="given-name" value={f.first_name} onChange={set("first_name")} /></label>
      </div>
      <label className="f"><span>Adresse</span><input type="text" autoComplete="street-address" placeholder="N° et rue" value={f.address} onChange={set("address")} /></label>
      <div className="row">
        <label className="f"><span>Code postal</span><input type="text" inputMode="numeric" autoComplete="postal-code" maxLength={10} value={f.postal_code} onChange={set("postal_code")} /></label>
        <label className="f" style={{ flex: 2 }}><span>Ville</span><input type="text" autoComplete="address-level2" value={f.city} onChange={set("city")} /></label>
      </div>
      <label className="f"><span>Téléphone</span><input type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} /></label>
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
