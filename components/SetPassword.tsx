"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

/** Choix d'un nouveau mot de passe (mot de passe oublié, invitation de l'équipe). */
export default function SetPassword({ next, back }: { next: string; back: string }) {
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser().auth.getUser();
      if (!data.user) setErr("Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.");
      setReady(true);
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 10) return setErr("Choisissez au moins 10 caractères.");
    if (pw !== pw2) return setErr("Les deux mots de passe ne sont pas identiques.");
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    if (error) return setErr("Le lien a expiré. Demandez-en un nouveau.");
    window.location.assign(next);
  }

  return (
    <form onSubmit={submit} className="card">
      <div className="sec-title">Choisir mon mot de passe</div>
      {!ready ? <p className="muted">Vérification du lien…</p> : null}
      <label className="f"><span>Nouveau mot de passe (10 caractères minimum)</span><input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} disabled={!ready} /></label>
      <label className="f"><span>Confirmer</span><input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} disabled={!ready} /></label>
      {err ? <p className="err" role="alert">{err}</p> : null}
      <button className="btn pri full" disabled={!ready}>Enregistrer et continuer</button>
      <p className="small" style={{ marginBottom: 0 }}><a href={back}>Retour à la connexion</a></p>
    </form>
  );
}
