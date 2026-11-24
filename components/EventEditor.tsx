"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PRODUCTS, type Prices } from "@/lib/catalog";
import { shortDate, toParisInput } from "@/lib/format";

export type AdminEvent = { id: string; name: string; startsAt: string; venue: string; capacity: number; onSale: boolean; journee: number | null; prices: Prices; sold: number };

const DEFAULT: Record<string, string> = { full: "10", reduced: "7", child: "4", bt: "8", bs: "5", b: "2.5", s: "5", t: "8" };
const blank = () => ({ id: "", name: "", date: "", venue: "Arena Stadium — Les Sables d'Olonne", capacity: "", journee: "", onSale: true, prices: { ...DEFAULT } });
type Form = ReturnType<typeof blank>;

/** Liste des matchs et formulaire de création / modification (prix en euros). */
export default function EventEditor({ events }: { events: AdminEvent[] }) {
  const router = useRouter();
  const [f, setF] = useState<Form>(blank());
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  function edit(e: AdminEvent) {
    const prices: Record<string, string> = {};
    PRODUCTS.forEach((p) => { const v = e.prices[p.key]; prices[p.key] = v == null ? "" : String(v / 100); });
    setF({ id: e.id, name: e.name, date: toParisInput(e.startsAt), venue: e.venue, capacity: e.capacity ? String(e.capacity) : "", journee: e.journee ? String(e.journee) : "", onSale: e.onSale, prices });
    setErr("");
    document.getElementById("ev-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function save(patch?: Partial<Form>, target?: Form) {
    const body = { ...(target ?? f), ...patch };
    setBusy(true); setErr("");
    const r = await fetch("/api/admin/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(d.error ?? "Enregistrement impossible.");
    if (!target) setF(blank());
    router.refresh();
  }
  function toggle(e: AdminEvent) {
    const prices: Record<string, string> = {};
    PRODUCTS.forEach((p) => { const v = e.prices[p.key]; prices[p.key] = v == null ? "" : String(v / 100); });
    save({ onSale: !e.onSale }, { id: e.id, name: e.name, date: toParisInput(e.startsAt), venue: e.venue, capacity: String(e.capacity), journee: e.journee ? String(e.journee) : "", onSale: e.onSale, prices });
  }
  const set = (k: keyof Form, v: string | boolean) => setF({ ...f, [k]: v });
  const price = (k: string, label: string) => (
    <label className="f" key={k}><span>{label}</span><input type="number" step="0.5" min="0" value={f.prices[k] ?? ""} onChange={(e) => setF({ ...f, prices: { ...f.prices, [k]: e.target.value } })} /></label>
  );

  return (
    <div className="grid2">
      <div className="card">
        <div className="sec-title" style={{ justifyContent: "space-between" }}>Matchs <button className="btn pri sm" onClick={() => { setF(blank()); setErr(""); }}>+ Nouveau match</button></div>
        <div className="tablewrap"><table>
          <thead><tr><th>Date</th><th>Match</th><th className="num">Vendus</th><th>En vente</th><th></th></tr></thead>
          <tbody>
            {events.length ? events.map((e) => (
              <tr key={e.id}>
                <td style={{ whiteSpace: "nowrap" }}>{shortDate(e.startsAt)}</td>
                <td><b>{e.name}</b><div className="small muted">{e.journee ? `J${e.journee} · ` : ""}{e.venue}</div></td>
                <td className="num">{e.sold}{e.capacity ? ` / ${e.capacity}` : ""}</td>
                <td><label className="switch"><input type="checkbox" checked={e.onSale} disabled={busy} onChange={() => toggle(e)} /></label></td>
                <td><button className="btn ghost sm" onClick={() => edit(e)}>Modifier</button></td>
              </tr>
            )) : <tr><td colSpan={5} className="muted">Aucun match.</td></tr>}
          </tbody>
        </table></div>
      </div>
      <div className="card" id="ev-form">
        <div className="sec-title">{f.id ? "Modifier le match" : "Nouveau match"}</div>
        <label className="f"><span>Affiche</span><input type="text" placeholder="LSVB vs …" value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
        <div className="row">
          <label className="f"><span>Date et heure</span><input type="datetime-local" value={f.date} onChange={(e) => set("date", e.target.value)} /></label>
          <label className="f"><span>Jauge (0 = illimitée)</span><input type="number" min="0" value={f.capacity} onChange={(e) => set("capacity", e.target.value)} /></label>
        </div>
        <div className="row">
          <label className="f" style={{ flex: 3 }}><span>Lieu</span><input type="text" value={f.venue} onChange={(e) => set("venue", e.target.value)} /></label>
          <label className="f"><span>Journée</span><input type="number" min="1" value={f.journee} onChange={(e) => set("journee", e.target.value)} /></label>
        </div>
        <div className="subhead" style={{ marginTop: 4 }}>Prix des billets (€)</div>
        <div className="row">{price("full", "Plein")}{price("reduced", "Réduit")}{price("child", "Enfant")}</div>
        <div className="subhead">Prix buvette (€) <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 600 }}>— vide = produit masqué</span></div>
        <div className="row">{price("bt", "Tacos + boisson")}{price("bs", "Sandwich + boisson")}</div>
        <div className="row">{price("b", "Boisson")}{price("s", "Sandwich")}{price("t", "Tacos")}</div>
        <label className="switch" style={{ margin: "4px 0 14px" }}><input type="checkbox" checked={f.onSale} onChange={(e) => set("onSale", e.target.checked)} /> Ouvert à la vente</label>
        <div className="row"><button className="btn pri" disabled={busy} onClick={() => save()}>Enregistrer</button><button className="btn ghost" onClick={() => { setF(blank()); setErr(""); }}>{f.id ? "Annuler" : "Vider"}</button></div>
        {err ? <div className="err">{err}</div> : null}
      </div>
    </div>
  );
}
