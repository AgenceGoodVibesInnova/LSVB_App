"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, type Category, type Product } from "@/lib/catalog";
import { euros } from "@/lib/format";

const VAT_HELP: Record<Category, string> = {
  billet: "Billetterie d'une manifestation sportive : 5,5 %",
  menu: "Vente à emporter, à consommer tout de suite : 10 %",
  snack: "Vente à emporter, à consommer tout de suite : 10 %",
  boisson: "Boisson sans alcool à emporter : 10 % (5,5 % si conditionnement fermé refermable) ; alcool : 20 %",
  confiserie: "Confiserie : 20 %",
  boutique: "Textile, objets : 20 %",
};
const DEFAULT_VAT: Record<Category, string> = { billet: "5.5", menu: "10", snack: "10", boisson: "10", confiserie: "20", boutique: "20" };

type F = { id: string; name: string; category: Category; description: string; icon: string; price: string; vat: string; choice: "" | "boisson" | "option"; choiceLabel: string; options: string; active: boolean; sort: string };
const blank = (category: Category = "boisson"): F => ({ id: "", name: "", category, description: "", icon: "", price: "", vat: DEFAULT_VAT[category], choice: "", choiceLabel: "", options: "", active: true, sort: "100" });

/** Catalogue : ajouter des boissons, des menus, de la confiserie, des articles boutique (t-shirt et tailles)… */
export default function ProductManager({ products }: { products: Product[] }) {
  const router = useRouter();
  const [f, setF] = useState<F>(blank());
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const edit = (p: Product) => {
    setF({ id: p.id, name: p.name, category: p.category, description: p.description ?? "", icon: p.icon ?? "", price: String(p.price_cents / 100), vat: String(p.vat_rate),
      choice: p.choice ?? "", choiceLabel: p.choice_label ?? "", options: p.options.join(", "), active: p.active, sort: String(p.sort) });
    setErr("");
    document.getElementById("prod-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  async function save(body: F) {
    setBusy(true); setErr("");
    const r = await fetch("/api/admin/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(d.error ?? "Enregistrement impossible."); return false; }
    router.refresh();
    return true;
  }
  const toF = (p: Product): F => ({ id: p.id, name: p.name, category: p.category, description: p.description ?? "", icon: p.icon ?? "", price: String(p.price_cents / 100), vat: String(p.vat_rate), choice: p.choice ?? "", choiceLabel: p.choice_label ?? "", options: p.options.join(", "), active: p.active, sort: String(p.sort) });
  const set = <K extends keyof F>(k: K, v: F[K]) => setF({ ...f, [k]: v });

  return (
    <div className="grid2">
      <div>
        {CATEGORIES.map((c) => {
          const list = products.filter((p) => p.category === c.key);
          return (
            <div className="card" key={c.key}>
              <div className="sec-title" style={{ justifyContent: "space-between" }}>{c.label}<button className="btn ghost sm" onClick={() => { setF(blank(c.key)); setErr(""); document.getElementById("prod-form")?.scrollIntoView({ behavior: "smooth" }); }}>+ Ajouter</button></div>
              {list.length ? (
                <div className="tablewrap"><table>
                  <thead><tr><th>Produit</th><th className="num">Prix TTC</th><th className="num">TVA</th><th>En vente</th><th></th></tr></thead>
                  <tbody>
                    {list.map((p) => (
                      <tr key={p.id} style={p.active ? undefined : { opacity: 0.55 }}>
                        <td><span style={{ marginRight: 6 }}>{p.icon}</span><b>{p.name}</b>
                          <div className="small muted">{p.description}{p.choice === "boisson" ? " · boisson offerte au choix" : p.choice === "option" ? ` · ${p.choice_label} : ${p.options.join(", ")}` : ""}</div></td>
                        <td className="num"><b>{euros(p.price_cents)}</b></td>
                        <td className="num">{p.vat_rate.toLocaleString("fr-FR")} %</td>
                        <td><label className="switch"><input type="checkbox" aria-label={`En vente : ${p.name}`} checked={p.active} disabled={busy} onChange={() => save({ ...toF(p), active: !p.active })} /></label></td>
                        <td><button className="btn ghost sm" onClick={() => edit(p)}>Modifier</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              ) : <p className="small muted">Aucun produit.</p>}
            </div>
          );
        })}
      </div>
      <form className="card recap" id="prod-form" onSubmit={async (e) => { e.preventDefault(); if (await save(f)) setF(blank(f.category)); }}>
        <div className="sec-title">{f.id ? "Modifier le produit" : "Nouveau produit"}</div>
        <label className="f"><span>Catégorie</span>
          <select value={f.category} onChange={(e) => { const c = e.target.value as Category; setF({ ...f, category: c, vat: f.id ? f.vat : DEFAULT_VAT[c], choice: c === "menu" && !f.id ? "boisson" : f.choice }); }}>
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        <div className="row">
          <label className="f" style={{ flex: 3 }}><span>Nom</span><input type="text" required value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex. Coca-Cola, Menu hot-dog, Sweat LSVB" /></label>
          <label className="f"><span>Icône</span><input type="text" value={f.icon} onChange={(e) => set("icon", e.target.value)} placeholder="🥤" /></label>
        </div>
        <label className="f"><span>Précision (facultatif)</span><input type="text" value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Ex. Canette 33 cl" /></label>
        <div className="row">
          <label className="f"><span>Prix TTC (€)</span><input type="number" step="0.1" min="0" required value={f.price} onChange={(e) => set("price", e.target.value)} /></label>
          <label className="f"><span>TVA (%)</span>
            <select value={f.vat} onChange={(e) => set("vat", e.target.value)}>
              {["0", "2.1", "5.5", "10", "20"].map((v) => <option key={v} value={v}>{v.replace(".", ",")} %</option>)}
            </select>
          </label>
        </div>
        <p className="small muted" style={{ marginTop: -4 }}>{VAT_HELP[f.category]}. Taux indicatifs : à valider avec votre expert-comptable.</p>
        <label className="f"><span>Choix demandé au client</span>
          <select value={f.choice} onChange={(e) => set("choice", e.target.value as F["choice"])}>
            <option value="">Aucun</option>
            <option value="boisson">Boisson offerte au choix (parmi les boissons en vente)</option>
            <option value="option">Liste de choix (tailles, parfums…)</option>
          </select>
        </label>
        {f.choice === "option" ? (
          <div className="row">
            <label className="f"><span>Intitulé</span><input type="text" value={f.choiceLabel} onChange={(e) => set("choiceLabel", e.target.value)} placeholder="Taille" /></label>
            <label className="f" style={{ flex: 2 }}><span>Choix, séparés par des virgules</span><input type="text" value={f.options} onChange={(e) => set("options", e.target.value)} placeholder="S, M, L, XL" /></label>
          </div>
        ) : null}
        <div className="row" style={{ alignItems: "center" }}>
          <label className="f"><span>Ordre d&apos;affichage</span><input type="number" value={f.sort} onChange={(e) => set("sort", e.target.value)} /></label>
          <label className="switch"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> En vente</label>
        </div>
        {err ? <p className="err" role="alert">{err}</p> : null}
        <div className="row"><button className="btn pri" disabled={busy}>Enregistrer</button><button type="button" className="btn ghost" onClick={() => { setF(blank(f.category)); setErr(""); }}>{f.id ? "Annuler" : "Vider"}</button></div>
      </form>
    </div>
  );
}
