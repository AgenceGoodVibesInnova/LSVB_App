"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, SHOP_DAYS_BEFORE, type Prices } from "@/lib/catalog";
import { euros, longDate, shortDate, toParisInput } from "@/lib/format";

export type AdminEvent = {
  id: string; name: string; startsAt: string; venue: string; capacity: number; onSale: boolean; journee: number | null; prices: Prices; sold: number;
  salesEndAt: string | null; shopEndAt: string | null;
};
export type CatalogItem = { id: string; category: string; name: string; price_cents: number; active: boolean };

type Form = {
  id: string; name: string; date: string; venue: string; capacity: string; journee: string; onSale: boolean;
  salesEnd: string; shopEnd: string;
  offer: Record<string, { on: boolean; price: string }>;
};

/** Liste des matchs et formulaire : date, jauge, fins de vente, produits proposés et prix spéciaux. */
export default function EventEditor({ events, catalog }: { events: AdminEvent[]; catalog: CatalogItem[] }) {
  const router = useRouter();
  const blank = (): Form => ({
    id: "", name: "", date: "", venue: "Arena Stadium — Les Sables d'Olonne", capacity: "", journee: "", onSale: true, salesEnd: "", shopEnd: "",
    offer: Object.fromEntries(catalog.map((p) => [p.id, { on: true, price: "" }])),
  });
  const fromEvent = (e: AdminEvent): Form => ({
    id: e.id, name: e.name, date: toParisInput(e.startsAt), venue: e.venue, capacity: e.capacity ? String(e.capacity) : "", journee: e.journee ? String(e.journee) : "",
    onSale: e.onSale, salesEnd: e.salesEndAt ? toParisInput(e.salesEndAt) : "", shopEnd: e.shopEndAt ? toParisInput(e.shopEndAt) : "",
    offer: Object.fromEntries(catalog.map((p) => {
      const has = Object.prototype.hasOwnProperty.call(e.prices ?? {}, p.id);
      const v = has ? e.prices[p.id] : undefined;
      return [p.id, { on: v !== null, price: typeof v === "number" ? String(v / 100) : "" }];
    })),
  });
  const [f, setF] = useState<Form>(blank());
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  function payload(x: Form) {
    const prices: Record<string, number | null> = {};
    for (const p of catalog) {
      const o = x.offer[p.id] ?? { on: true, price: "" };
      if (!o.on) prices[p.id] = null;
      else if (o.price.trim() !== "") prices[p.id] = Math.round(Number(o.price.replace(",", ".")) * 100);
    }
    return { id: x.id, name: x.name, date: x.date, venue: x.venue, capacity: x.capacity, journee: x.journee, onSale: x.onSale, salesEnd: x.salesEnd, shopEnd: x.shopEnd, prices };
  }
  async function save(target?: Form) {
    const body = payload(target ?? f);
    setBusy(true); setErr("");
    const r = await fetch("/api/admin/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(d.error ?? "Enregistrement impossible.");
    if (!target) setF(blank());
    router.refresh();
  }
  const set = (k: keyof Form, v: string | boolean) => setF({ ...f, [k]: v });
  const shopDefault = f.date ? (() => { const d = new Date(f.date); d.setDate(d.getDate() - SHOP_DAYS_BEFORE); return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }); })() : `${SHOP_DAYS_BEFORE} jours avant le match`;

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
                <td><b>{e.name}</b><div className="small muted">{e.journee ? `J${e.journee} · ` : ""}buvette jusqu&apos;au {shortDate(e.shopEndAt ?? new Date(new Date(e.startsAt).getTime() - SHOP_DAYS_BEFORE * 86400e3).toISOString())}</div></td>
                <td className="num">{e.sold}{e.capacity ? ` / ${e.capacity}` : ""}</td>
                <td><label className="switch"><input type="checkbox" aria-label={`Vente ouverte : ${e.name}`} checked={e.onSale} disabled={busy} onChange={() => save({ ...fromEvent(e), onSale: !e.onSale })} /></label></td>
                <td><button className="btn ghost sm" onClick={() => { setF(fromEvent(e)); setErr(""); document.getElementById("ev-form")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Modifier</button></td>
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
        <div className="subhead" style={{ marginTop: 4 }}>Fins de vente en ligne</div>
        <div className="row">
          <label className="f"><span>Billets</span><input type="datetime-local" value={f.salesEnd} onChange={(e) => set("salesEnd", e.target.value)} /><small className="muted">Vide : jusqu&apos;au début du match</small></label>
          <label className="f"><span>Buvette et boutique</span><input type="datetime-local" value={f.shopEnd} onChange={(e) => set("shopEnd", e.target.value)} /><small className="muted">Vide : {shopDefault}</small></label>
        </div>
        <div className="subhead">Produits proposés <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 600 }}>— prix vide = prix du catalogue</span></div>
        <div className="offer">
          {CATEGORIES.map((c) => {
            const list = catalog.filter((p) => p.category === c.key);
            if (!list.length) return null;
            return (
              <div key={c.key}>
                <div className="small" style={{ fontWeight: 800, color: "var(--blue)", margin: "8px 0 2px" }}>{c.label}</div>
                {list.map((p) => {
                  const o = f.offer[p.id] ?? { on: true, price: "" };
                  return (
                    <div className="offer-row" key={p.id}>
                      <label className="switch" style={{ flex: 1 }}><input type="checkbox" checked={o.on} onChange={(e) => setF({ ...f, offer: { ...f.offer, [p.id]: { ...o, on: e.target.checked } } })} /> {p.name}{p.active ? "" : " (désactivé au catalogue)"}</label>
                      <input type="number" step="0.5" min="0" aria-label={`Prix spécial ${p.name}`} placeholder={euros(p.price_cents)} value={o.price} disabled={!o.on} onChange={(e) => setF({ ...f, offer: { ...f.offer, [p.id]: { ...o, price: e.target.value } } })} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <label className="switch" style={{ margin: "12px 0 14px" }}><input type="checkbox" checked={f.onSale} onChange={(e) => set("onSale", e.target.checked)} /> Ouvert à la vente</label>
        <div className="row"><button className="btn pri" disabled={busy} onClick={() => save()}>Enregistrer</button><button className="btn ghost" onClick={() => { setF(blank()); setErr(""); }}>{f.id ? "Annuler" : "Vider"}</button></div>
        {err ? <div className="err">{err}</div> : null}
        {f.id && f.date ? <p className="small muted">Match le {longDate(new Date(f.date).toISOString())}.</p> : null}
      </div>
    </div>
  );
}
