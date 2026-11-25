"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import NotifPrompt from "./NotifPrompt";

/** Connexion / création de compte client. */
export default function AuthForm({ next, notice }: { next: string; notice?: string }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [f, setF] = useState({ first_name: "", last_name: "", phone: "", postal_code: "", email: "", password: "" });
  const [optIn, setOptIn] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>(notice ? { err: notice } : {});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function forgot() {
    setMsg({});
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return setMsg({ err: "Indiquez d'abord votre e-mail dans le champ ci-dessus." });
    await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: f.email }) });
    setMsg({ ok: "Si un compte existe avec cet e-mail, vous allez recevoir un lien pour choisir un nouveau mot de passe." });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg({}); setBusy(true);
    if (mode === "login") {
      const { error } = await supabaseBrowser().auth.signInWithPassword({ email: f.email, password: f.password });
      setBusy(false);
      if (error) return setMsg({ err: /confirm/i.test(error.message)
        ? "Votre adresse e-mail n'est pas encore confirmée : cliquez sur le lien reçu par e-mail."
        : "E-mail ou mot de passe incorrect." });
      window.location.assign(next);
      return;
    }
    const res = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, marketing_opt_in: optIn, next }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ err: data.error ?? "L'inscription n'a pas abouti. Réessayez." });
    setMsg({ ok: "Profil créé ! Cliquez sur le lien reçu par e-mail pour l'activer." });
  }

  return (
    <div className="card">
      <div className="mode" role="tablist" aria-label="Connexion ou inscription" style={{ marginBottom: 18 }}>
        <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "on" : ""} onClick={() => { setMode("login"); setMsg({}); }}>Se connecter</button>
        <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "on" : ""} onClick={() => { setMode("signup"); setMsg({}); }}>Créer mon profil</button>
      </div>
      <p className="small muted" style={{ marginTop: 0 }}>{mode === "signup" ? "Un compte pour retrouver tous vos billets et bons buvette, match après match." : "Connectez-vous pour réserver plus vite et retrouver vos billets."}</p>
      <form onSubmit={submit}>
        {mode === "signup" ? (<>
          <div className="row">
            <label className="f"><span>Nom</span><input type="text" required autoComplete="family-name" value={f.last_name} onChange={set("last_name")} /></label>
            <label className="f"><span>Prénom</span><input type="text" required autoComplete="given-name" value={f.first_name} onChange={set("first_name")} /></label>
          </div>
          <div className="row">
            <label className="f"><span>Téléphone</span><input type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} /></label>
            <label className="f"><span>Code postal</span><input type="text" required inputMode="numeric" autoComplete="postal-code" maxLength={10} value={f.postal_code} onChange={set("postal_code")} /></label>
          </div>
        </>) : null}
        <label className="f"><span>E-mail</span><input type="email" required autoComplete="email" value={f.email} onChange={set("email")} /></label>
        <label className="f"><span>Mot de passe{mode === "signup" ? " (8 caractères minimum)" : ""}</span><input type="password" required minLength={mode === "signup" ? 8 : undefined} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={f.password} onChange={set("password")} /></label>
        {mode === "signup" ? (
          <label className="switch" style={{ alignItems: "flex-start", marginBottom: 14, fontWeight: 500 }}>
            <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
            <span className="small">J&apos;accepte de recevoir par e-mail les actualités et offres des Sables Vendée Basket (désinscription possible à tout moment).</span>
          </label>
        ) : null}
        {mode === "login" ? <div style={{ textAlign: "right", marginTop: -4, marginBottom: 12 }}><button type="button" onClick={forgot} className="linkbtn">Mot de passe oublié ?</button></div> : null}
        {msg.err ? <p className="err" role="alert">{msg.err}</p> : null}
        {msg.ok ? <p className="okbox" role="status">{msg.ok}</p> : null}
        {msg.ok && mode === "signup" ? <NotifPrompt /> : null}
        <button className="btn pri full" disabled={busy}>{busy ? "Un instant…" : mode === "signup" ? "Créer mon profil" : "Se connecter"}</button>
      </form>
    </div>
  );
}
