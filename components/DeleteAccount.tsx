"use client";
import { useState } from "react";

/** Suppression du compte depuis l'application (obligatoire sur l'App Store et Google Play). */
export default function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function del() {
    setBusy(true); setMsg("");
    const r = await fetch("/api/me", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "SUPPRIMER" }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) window.location.assign("/?compte=supprime");
    else setMsg(j.error ?? "Suppression impossible.");
  }
  if (!open)
    return <button type="button" className="btn ghost sm danger-link" onClick={() => setOpen(true)}>Supprimer mon compte</button>;
  return (
    <div className="card danger-box" role="region" aria-label="Supprimer mon compte">
      <div className="sec-title">Supprimer mon compte</div>
      <p className="small">Votre profil (nom, adresse, téléphone) est effacé définitivement et vous êtes déconnecté.
        Les billets déjà achetés restent valables avec le lien reçu par e-mail. Les tickets de caisse sont conservés
        par le club pour sa comptabilité, sans lien avec un compte.</p>
      <label className="f"><span>Tapez SUPPRIMER pour confirmer</span>
        <input type="text" autoCapitalize="characters" value={txt} onChange={(e) => setTxt(e.target.value)} /></label>
      <div className="row">
        <button type="button" className="btn danger" disabled={busy || txt.trim().toUpperCase() !== "SUPPRIMER"} onClick={del}>Supprimer définitivement</button>
        <button type="button" className="btn ghost" onClick={() => { setOpen(false); setTxt(""); setMsg(""); }}>Annuler</button>
      </div>
      {msg ? <p className="small" style={{ fontWeight: 700 }} role="alert">{msg}</p> : null}
    </div>
  );
}
