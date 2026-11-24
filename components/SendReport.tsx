"use client";
import { useState } from "react";
export default function SendReport({ event }: { event: string }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button className="btn ghost sm" disabled={busy} onClick={async () => {
        setBusy(true); setMsg("");
        const r = await fetch("/api/admin/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event }) });
        const d = await r.json().catch(() => ({}));
        setBusy(false); setMsg(d.message ?? d.error ?? "");
      }}>{busy ? "Envoi…" : "Envoyer par e-mail"}</button>
      {msg ? <span className="small" role="status">{msg}</span> : null}
    </span>
  );
}
