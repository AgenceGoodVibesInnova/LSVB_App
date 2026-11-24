"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Member = { user_id: string; email: string; role: string; created_at: string };
const HELP: Record<string, string> = {
  scan: "Scanner uniquement : contrôle à l'entrée et buvette, compteurs du match.",
  admin: "Tout : matchs et prix, commandes, clients, équipe, réglages, scanner.",
};
const LABEL: Record<string, string> = { admin: "Administrateur", scan: "Scanner" };

export default function TeamManager({ members, me }: { members: Member[]; me: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("scan");
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [busy, setBusy] = useState(false);
  const [confirmRm, setConfirmRm] = useState<string | null>(null);

  async function call(method: string, body: object) {
    setBusy(true); setMsg({});
    const r = await fetch("/api/admin/team", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) setMsg({ err: d.error ?? "Action impossible." });
    else if (d.message) setMsg({ ok: d.message });
    router.refresh();
    return r.ok;
  }

  return (
    <div className="grid2">
      <div className="card">
        <div className="sec-title">Membres</div>
        <div className="tablewrap"><table>
          <thead><tr><th>Personne</th><th>Niveau</th><th></th></tr></thead>
          <tbody>
            {members.map((m) => {
              const editable = m.user_id !== me;
              return (
                <tr key={m.user_id}>
                  <td><b>{m.email}</b>{m.user_id === me ? <span className="muted small"> · vous</span> : null}<div className="small muted">depuis le {new Date(m.created_at).toLocaleDateString("fr-FR")}</div></td>
                  <td>
                    {editable ? (
                      <select aria-label={`Niveau de ${m.email}`} value={m.role} disabled={busy} onChange={(e) => call("PATCH", { userId: m.user_id, role: e.target.value })} style={{ width: 170, padding: "6px 10px" }}>
                        <option value="scan">Scanner</option><option value="admin">Administrateur</option>
                      </select>
                    ) : <span className="pill blue">{LABEL[m.role]}</span>}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {editable ? (confirmRm === m.user_id
                      ? <span className="row" style={{ gap: 4, flexWrap: "nowrap", justifyContent: "flex-end" }}><button className="btn pri sm" onClick={async () => { await call("DELETE", { userId: m.user_id }); setConfirmRm(null); }}>Retirer</button><button className="btn ghost sm" onClick={() => setConfirmRm(null)}>Non</button></span>
                      : <button className="btn ghost sm" aria-label={`Retirer ${m.email}`} onClick={() => setConfirmRm(m.user_id)}>✕</button>) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </div>
      <form className="card" onSubmit={async (e) => { e.preventDefault(); if (await call("POST", { email, role })) setEmail(""); }}>
        <div className="sec-title">Inviter une personne</div>
        <label className="f"><span>E-mail</span><input type="email" required placeholder="prenom@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="f"><span>Niveau d&apos;accès</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}><option value="scan">Scanner (bénévole)</option><option value="admin">Administrateur</option></select>
        </label>
        <p className="small muted" style={{ marginTop: -4 }}>{HELP[role]} La personne reçoit un e-mail pour choisir son mot de passe.</p>
        {msg.err ? <p className="err" role="alert">{msg.err}</p> : null}
        {msg.ok ? <p className="okbox" role="status">{msg.ok}</p> : null}
        <button className="btn pri full" disabled={busy}>{busy ? "Envoi…" : "Envoyer l'invitation"}</button>
      </form>
    </div>
  );
}
