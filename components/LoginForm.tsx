"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginForm({ suite, notice }: { suite: string; notice?: string }) {
  const router = useRouter();
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
    router.push(suite);
    router.refresh();
  }
  return (
    <form onSubmit={submit}>
      <label className="f"><span>E-mail</span><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="f"><span>Mot de passe</span><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", padding: "11px 13px", border: "2px solid var(--grey)", borderRadius: 12 }} /></label>
      {err ? <p className="err" role="alert">{err}</p> : null}
      <button className="btn pri full" disabled={busy}>{busy ? "Connexion…" : "Se connecter"}</button>
    </form>
  );
}
