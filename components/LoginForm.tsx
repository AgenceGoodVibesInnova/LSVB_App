"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginForm({ suite, notice }: { suite: string; notice?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(notice ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setErr("Identifiant ou mot de passe incorrect.");
    // Un compte client sans accès équipe est renvoyé vers son espace
    const r = await fetch("/api/admin/whoami", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!d.role) { window.location.assign("/admin/connexion?refus=1"); return; }
    // Navigation complète : une page préchargée avant la connexion ne doit pas être réutilisée
    window.location.assign(d.role === "scan" && !suite.startsWith("/admin/scanner") ? "/admin/scanner" : suite);
  }
  return (
    <form onSubmit={submit}>
      <label className="f"><span>E-mail</span><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="f"><span>Mot de passe</span><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", padding: "11px 13px", border: "2px solid var(--grey)", borderRadius: 12 }} /></label>
      {err ? <p className="err" role="alert">{err}</p> : null}
      <button className="btn pri full" disabled={busy}>{busy ? "Connexion…" : "Se connecter"}</button>
      <div style={{ textAlign: "right", marginTop: 10 }}><button type="button" className="linkbtn" onClick={async () => {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErr("Indiquez d'abord votre e-mail.");
        await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, next: "/admin" }) });
        setErr("Si ce compte existe, un e-mail de réinitialisation vient d'être envoyé.");
      }}>Mot de passe oublié ?</button></div>
    </form>
  );
}
