"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { euros, shortDate, toParisInput } from "@/lib/format";

export type PromoRow = {
  code: string; label: string | null; kind: "percent" | "amount"; value: number; scope: "billets" | "tout"; event_id: string | null;
  valid_from: string | null; valid_until: string | null; max_uses: number | null; active: boolean; uses: number; given: number;
};
type Ev = { id: string; name: string; startsAt: string };
type F = { isNew: boolean; code: string; label: string; kind: "percent" | "amount"; value: string; scope: "billets" | "tout"; eventId: string; validFrom: string; validUntil: string; maxUses: string; active: boolean };
const blank = (): F => ({ isNew: true, code: "", label: "", kind: "percent", value: "", scope: "billets", eventId: "", validFrom: "", validUntil: "", maxUses: "", active: true });
const day = (iso: string | null) => (iso ? toParisInput(iso).slice(0, 10) : "");
const text = (p: { kind: string; value: number; scope: string }) => `${p.kind === "percent" ? `−${p.value} %` : `−${euros(p.value)}`} ${p.scope === "billets" ? "sur les billets" : "sur toute la commande"}`;

/** Codes promo : remise en % ou en €, sur les billets ou toute la commande, un match ou tous, dates de validité, utilisations. */
export default function PromoManager({ promos, events }: { promos: PromoRow[]; events: Ev[] }) {
  const router = useRouter();
  const [f, setF] = useState<F>(blank());
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const toF = (p: PromoRow): F => ({ isNew: false, code: p.code, label: p.label ?? "", kind: p.kind, value: p.kind === "percent" ? String(p.value) : String(p.value / 100), scope: p.scope, eventId: p.event_id ?? "", validFrom: day(p.valid_from), validUntil: day(p.valid_until), maxUses: p.max_uses ? String(p.max_uses) : "", active: p.active });
  async function save(body: F) {
    setBusy(true); setErr("");
    const r = await fetch("/api/admin/promos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(d.error ?? "Enregistrement impossible."); return false; }
    router.refresh();
    return true;
  }
  const set = <K extends keyof F>(k: K, v: F[K]) => setF({ ...f, [k]: v });
  const evName = (id: string | null) => (id ? events.find((e) => e.id === id)?.name ?? id : "Tous les matchs");
  const state = (p: PromoRow) => {
    const now = Date.now();
    if (!p.active) return <span className="pill warn">Désactivé</span>;
    if (p.valid_until && now > new Date(p.valid_until).getTime()) return <span className="pill warn">Expiré</span>;
    if (p.valid_from && now < new Date(p.valid_from).getTime()) return <span className="pill blue">À venir</span>;
    if (p.max_uses && p.uses >= p.max_uses) return <span className="pill warn">Épuisé</span>;
    return <span className="pill ok">Actif</span>;
  };

  return (
    <div className="grid2">
      <div className="card">
        <div className="sec-title" style={{ justifyContent: "space-between" }}>Codes <button className="btn pri sm" onClick={() => { setF(blank()); setErr(""); }}>+ Nouveau code</button></div>
        <div className="tablewrap"><table>
          <thead><tr><th>Code</th><th>Remise</th><th>Validité</th><th className="num">Utilisé</th><th>État</th><th></th></tr></thead>
          <tbody>
            {promos.length ? promos.map((p) => (
              <tr key={p.code}>
                <td><b style={{ fontFamily: "ui-monospace,monospace" }}>{p.code}</b><div className="small muted">{p.label}</div></td>
                <td className="small">{text(p)}<div className="muted">{evName(p.event_id)}</div></td>
                <td className="small">{p.valid_from ? `du ${shortDate(p.valid_from).slice(0, 5)}` : "dès maintenant"}<br />{p.valid_until ? `au ${shortDate(p.valid_until).slice(0, 5)}` : "sans fin"}</td>
                <td className="num">{p.uses}{p.max_uses ? ` / ${p.max_uses}` : ""}<div className="small muted">−{euros(p.given)}</div></td>
                <td>{state(p)}</td>
                <td><button className="btn ghost sm" onClick={() => { setF(toF(p)); setErr(""); }}>Modifier</button></td>
              </tr>
            )) : <tr><td colSpan={6} className="muted">Aucun code promo. Créez-en un, par exemple TALMONT2026.</td></tr>}
          </tbody>
        </table></div>
      </div>
      <form className="card recap" onSubmit={async (e) => { e.preventDefault(); if (await save(f)) setF(blank()); }}>
        <div className="sec-title">{f.isNew ? "Nouveau code promo" : `Modifier ${f.code}`}</div>
        <div className="row">
          <label className="f"><span>Code</span><input type="text" required disabled={!f.isNew} value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="TALMONT2026" /></label>
          <label className="f"><span>Pour qui (interne)</span><input type="text" value={f.label} onChange={(e) => set("label", e.target.value)} placeholder="Club de Talmont" /></label>
        </div>
        <div className="row">
          <label className="f"><span>Type de remise</span><select value={f.kind} onChange={(e) => set("kind", e.target.value as F["kind"])}><option value="percent">Pourcentage</option><option value="amount">Montant en €</option></select></label>
          <label className="f"><span>{f.kind === "percent" ? "Remise (%)" : "Remise (€)"}</span><input type="number" required min="0" step={f.kind === "percent" ? "1" : "0.5"} value={f.value} onChange={(e) => set("value", e.target.value)} /></label>
        </div>
        <label className="f"><span>S&apos;applique à</span><select value={f.scope} onChange={(e) => set("scope", e.target.value as F["scope"])}><option value="billets">Billets seulement</option><option value="tout">Toute la commande (buvette et boutique comprises)</option></select></label>
        <label className="f"><span>Match</span><select value={f.eventId} onChange={(e) => set("eventId", e.target.value)}><option value="">Tous les matchs</option>{events.map((e) => <option key={e.id} value={e.id}>{shortDate(e.startsAt).slice(0, 5)} — {e.name}</option>)}</select></label>
        <div className="row">
          <label className="f"><span>Valable du</span><input type="date" value={f.validFrom} onChange={(e) => set("validFrom", e.target.value)} /></label>
          <label className="f"><span>au (inclus)</span><input type="date" value={f.validUntil} onChange={(e) => set("validUntil", e.target.value)} /></label>
        </div>
        <div className="row" style={{ alignItems: "center" }}>
          <label className="f"><span>Utilisations max</span><input type="number" min="1" value={f.maxUses} onChange={(e) => set("maxUses", e.target.value)} placeholder="Illimité" /></label>
          <label className="switch"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Actif</label>
        </div>
        <p className="small muted" style={{ marginTop: -4 }}>Une remise de 100 % permet de distribuer des invitations : la commande est validée sans paiement.</p>
        {err ? <p className="err" role="alert">{err}</p> : null}
        <div className="row"><button className="btn pri" disabled={busy}>Enregistrer</button><button type="button" className="btn ghost" onClick={() => { setF(blank()); setErr(""); }}>{f.isNew ? "Vider" : "Annuler"}</button></div>
      </form>
    </div>
  );
}
