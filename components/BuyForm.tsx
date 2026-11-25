"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, MAX_ITEMS, type Category } from "@/lib/catalog";
import { euros, longDate } from "@/lib/format";
import ChoiceModal from "./ChoiceModal";

export type SaleEvent = {
  id: string; name: string; startsAt: string; venue: string; journee: number | null;
  salesEnd: string; shopEnd: string; shopOpen: boolean; remaining: number | null; prices: Record<string, number | null>;
};
export type SaleProduct = {
  id: string; category: Category; name: string; description: string | null; icon: string | null;
  choice: "boisson" | "option" | null; choiceLabel: string | null; choices: string[];
};
type Me = { first: string; last: string; postal: string; email: string; phone: string } | null;
type PromoState = { code: string; text: string; discount: number } | null;

const SECTIONS: { title: string; cats: Category[]; note?: string }[] = [
  { title: "Billets", cats: ["billet"] },
  { title: "Buvette", cats: ["menu", "snack", "boisson", "confiserie"], note: "à récupérer sur place avec votre QR" },
  { title: "Boutique du club", cats: ["boutique"], note: "à retirer au stand boutique le jour du match" },
];

export default function BuyForm({ events, catalog, demo, canBuy, me, isStaff, accountRequired }: {
  events: SaleEvent[]; catalog: SaleProduct[]; demo: boolean; canBuy: boolean; me: Me; isStaff: boolean; accountRequired: boolean;
}) {
  const router = useRouter();
  const [evId, setEvId] = useState(events[0]?.id ?? "");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [stack, setStack] = useState<Record<string, string[]>>({});
  const [asking, setAsking] = useState<SaleProduct | null>(null);
  const [form, setForm] = useState({ last: me?.last ?? "", first: me?.first ?? "", postal: me?.postal ?? "", email: me?.email ?? "", phone: me?.phone ?? "", group: "" });
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<PromoState>(null);
  const [promoErr, setPromoErr] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const mustLogin = accountRequired && !me && !isStaff;

  // Le panier survit à un passage par la page de connexion
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("lsvb_cart") ?? "null");
      if (saved && events.some((e) => e.id === saved.evId)) { setEvId(saved.evId); setCart(saved.cart ?? {}); }
    } catch {}
  }, [events]);
  useEffect(() => { try { sessionStorage.setItem("lsvb_cart", JSON.stringify({ evId, cart })); } catch {} }, [evId, cart]);

  const ev = events.find((e) => e.id === evId);
  const price = (id: string) => (ev ? ev.prices[id] ?? null : null);
  const qtyOf = (id: string) => Object.entries(cart).reduce((n, [key, v]) => n + (key === id || key.startsWith(id + "|") ? v : 0), 0);
  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  const tickets = catalog.filter((p) => p.category === "billet").reduce((n, p) => n + qtyOf(p.id), 0);
  const drinkIcon = (n: string) => catalog.find((p) => p.category === "boisson" && p.name === n)?.icon ?? "🥤";

  const lines = useMemo(() => {
    if (!ev) return [];
    const out: { key: string; label: string; q: number; unit: number }[] = [];
    for (const p of catalog) {
      const unit = ev.prices[p.id];
      if (unit == null) continue;
      if (p.choices.length) p.choices.forEach((c) => { const q = cart[`${p.id}|${c}`] ?? 0; if (q) out.push({ key: `${p.id}|${c}`, label: `${p.name} (${p.choice === "option" && p.choiceLabel ? `${p.choiceLabel} ${c}` : c})`, q, unit }); });
      else if (cart[p.id]) out.push({ key: p.id, label: p.name, q: cart[p.id], unit });
    }
    return out;
  }, [cart, ev, catalog]);
  const subtotal = lines.reduce((s, l) => s + l.q * l.unit, 0);
  const total = Math.max(0, subtotal - (promo?.discount ?? 0));

  // Le montant de la remise suit le panier
  useEffect(() => {
    if (!promo || !lines.length) return;
    const t = setTimeout(async () => {
      const r = await fetch("/api/promo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: promo.code, eventId: evId, items: cart }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setPromo({ code: d.code, text: d.text, discount: d.discount });
      else { setPromo(null); setPromoErr(d.error ?? "Code promo retiré."); }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, evId]);

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(""), 2400); }
  function add(p: SaleProduct, key: string) {
    if (totalItems >= MAX_ITEMS) return flash(`Maximum ${MAX_ITEMS} articles par commande`);
    if (p.category === "billet" && ev?.remaining != null && tickets >= ev.remaining) return flash("Plus assez de places disponibles");
    setCart((c) => ({ ...c, [key]: (c[key] ?? 0) + 1 }));
    if (p.choices.length) setStack((s) => ({ ...s, [p.id]: [...(s[p.id] ?? []), key] }));
  }
  function plus(p: SaleProduct) { if (p.choices.length) setAsking(p); else add(p, p.id); }
  function minus(p: SaleProduct) {
    let key = p.id;
    if (p.choices.length) {
      const st = [...(stack[p.id] ?? [])];
      const k = st.pop() ?? Object.keys(cart).filter((x) => x.startsWith(p.id + "|") && cart[x] > 0).pop();
      if (!k) return;
      key = k;
      setStack((s) => ({ ...s, [p.id]: st }));
    }
    setCart((c) => { const n = { ...c }; n[key] = Math.max(0, (n[key] ?? 0) - 1); if (!n[key]) delete n[key]; return n; });
  }
  function pickEvent(id: string) { setEvId(id); setCart({}); setStack({}); setPromo(null); setPromoErr(""); }

  async function applyPromo() {
    setPromoErr("");
    if (!promoInput.trim()) return;
    const r = await fetch("/api/promo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: promoInput, eventId: evId, items: cart }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setPromo(null); return setPromoErr(d.error ?? "Code promo refusé."); }
    setPromo({ code: d.code, text: d.text, discount: d.discount });
    setPromoInput("");
  }

  async function submit() {
    setErr("");
    if (!form.last.trim() || !form.first.trim()) return setErr("Indiquez votre nom et votre prénom.");
    if (!/^[0-9A-Za-z -]{4,10}$/.test(form.postal.trim())) return setErr("Indiquez votre code postal.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setErr("Adresse e-mail invalide.");
    setBusy(true);
    const res = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: evId, lastName: form.last, firstName: form.first, postal: form.postal, email: form.email, phone: form.phone, group: form.group, promo: promo?.code ?? "", items: cart }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) { setBusy(false); return setErr(data.error ?? "Commande impossible, réessayez."); }
    try {
      const mine = JSON.parse(localStorage.getItem("lsvb_orders") ?? "[]") as { id: string; token: string }[];
      localStorage.setItem("lsvb_orders", JSON.stringify([{ id: data.id, token: data.token }, ...mine.filter((m) => m.id !== data.id)].slice(0, 20)));
      sessionStorage.removeItem("lsvb_cart");
    } catch {}
    router.push(data.paid ? `/billets/${data.token}` : `/paiement/${data.token}`);
  }

  const row = (p: SaleProduct) => {
    const unit = price(p.id);
    if (unit == null) return null;
    const q = qtyOf(p.id);
    const det = p.choices.map((c) => [c, cart[`${p.id}|${c}`] ?? 0] as const).filter(([, n]) => n).map(([c, n]) => `${n}× ${c}`).join(" · ");
    const sub = det ? <span style={{ color: "var(--orange-d)", fontWeight: 700 }}>{det}</span>
      : p.description ? <span>{p.description}</span>
      : p.choice === "boisson" ? <span>{p.choices.join(", ")}</span>
      : p.choice === "option" ? <span>{p.choiceLabel ?? "Choix"} : {p.choices.join(", ")}</span> : null;
    const icon = p.icon ?? "•";
    return (
      <div key={p.id} className={`prod${p.category === "billet" ? "" : " food"}`}>
        <div className={`ic${[...icon].length > 2 ? " duo" : ""}`}>{icon}</div>
        <div className="nm"><b>{p.name}{p.category === "menu" ? <span className="formula-tag">MENU</span> : null}</b>{sub}</div>
        <div className="pr">{euros(unit)}</div>
        <div className="step">
          <button type="button" aria-label={`Retirer ${p.name}`} disabled={q <= 0} onClick={() => minus(p)}>−</button>
          <output>{q}</output>
          <button type="button" aria-label={`Ajouter ${p.name}`} onClick={() => plus(p)}>+</button>
        </div>
      </div>
    );
  };
  const offered = (cats: Category[]) => catalog.filter((p) => cats.includes(p.category) && price(p.id) != null);
  let n = 1;

  return (
    <div className="wrap">
      {demo ? <div className="banner">{canBuy ? "Paiement simulé (équipe) : SumUp n'est pas encore branché, aucune carte n'est débitée." : "La vente en ligne ouvre très bientôt."}</div> : null}
      <div className="grid2">
        <div>
          <div className="card">
            <div className="sec-title"><span className="n">{n++}</span>Choisissez votre match</div>
            {events.length ? (
              <div className="events">
                {events.map((e) => (
                  <button key={e.id} type="button" className={`ev${e.id === evId ? " on" : ""}`} onClick={() => pickEvent(e.id)}>
                    <div className="d">{longDate(e.startsAt)}</div>
                    {e.journee ? <div className="v" style={{ fontWeight: 800, color: "var(--blue)", marginTop: 2 }}>NM1 · Journée {e.journee}</div> : null}
                    <div className="t">{e.name}</div>
                    <div className="v">📍 {e.venue}</div>
                    <div className="left">
                      {e.remaining == null ? null : e.remaining === 0 ? <span className="pill warn">Complet</span>
                        : e.remaining < 100 ? <span className="pill warn">Plus que {e.remaining} places</span> : <span className="pill ok">Places disponibles</span>}
                    </div>
                  </button>
                ))}
              </div>
            ) : <div className="empty"><div className="e">🏀</div>Aucun match en vente pour le moment.</div>}
          </div>
          {ev ? (<>
            {SECTIONS.map((s) => {
              const items = offered(s.cats);
              if (!items.length) return null;
              const shop = !s.cats.includes("billet");
              return (
                <div className="card" key={s.title}>
                  <div className="sec-title"><span className="n">{n++}</span>{s.title}{s.note && ev.shopOpen ? <span className="muted small" style={{ textTransform: "none", fontWeight: 600, letterSpacing: 0 }}>— {s.note}</span> : null}</div>
                  {shop && !ev.shopOpen ? (
                    <p className="notice">Les commandes {s.title === "Buvette" ? "buvette" : "boutique"} sont closes pour ce match depuis le {longDate(ev.shopEnd)} (préparation des commandes). Vous pourrez acheter sur place.</p>
                  ) : (<>
                    {shop ? <p className="small muted" style={{ marginTop: -6 }}>Commandes possibles jusqu&apos;au {longDate(ev.shopEnd)}.</p> : null}
                    {s.cats.map((c) => {
                      const list = items.filter((p) => p.category === c);
                      if (!list.length) return null;
                      const cat = CATEGORIES.find((x) => x.key === c)!;
                      return <div key={c}>{s.cats.length > 1 ? <div className="subhead">{cat.label}{cat.hint ? <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 600 }}> — {cat.hint}</span> : null}</div> : null}{list.map(row)}</div>;
                    })}
                  </>)}
                </div>
              );
            })}
            <div className="card">
              <div className="sec-title"><span className="n">{n++}</span>Vos coordonnées</div>
              {isStaff ? <p className="notice" style={{ marginTop: -4 }}>Vente par l&apos;équipe : saisissez les coordonnées de l&apos;acheteur, les billets lui seront envoyés.</p>
                : me ? <p className="small muted" style={{ marginTop: -6 }}>Commande rattachée à votre compte : vos pass et votre ticket de caisse seront aussi dans « Mes pass » et « Mon profil ».</p>
                : mustLogin ? <p className="notice" style={{ marginTop: -4 }}>Un compte est nécessaire pour acheter. <a href="/connexion?suite=/acheter">Se connecter ou créer un compte</a> (votre panier est conservé).</p>
                : <p className="small muted" style={{ marginTop: -6 }}>Vous avez un compte ? <a href="/connexion?suite=/acheter">Connectez-vous</a> pour retrouver vos billets dans votre espace. Sinon, continuez simplement.</p>}
              <div className="row">
                <label className="f"><span>Nom *</span><input type="text" autoComplete="family-name" value={form.last} onChange={(e) => setForm({ ...form, last: e.target.value })} /></label>
                <label className="f"><span>Prénom *</span><input type="text" autoComplete="given-name" value={form.first} onChange={(e) => setForm({ ...form, first: e.target.value })} /></label>
              </div>
              <div className="row">
                <label className="f"><span>Code postal *</span><input type="text" inputMode="numeric" maxLength={10} autoComplete="postal-code" value={form.postal} onChange={(e) => setForm({ ...form, postal: e.target.value })} /></label>
                <label className="f"><span>Téléphone</span><input type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
              </div>
              <div className="row">
                <label className="f"><span>E-mail * (pour recevoir les billets)</span><input type="email" autoComplete="email" value={form.email} disabled={!!me} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
                <label className="f"><span>Groupe / structure</span><input type="text" placeholder="Ex. club, entreprise, école…" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} /></label>
              </div>
            </div>
          </>) : null}
        </div>
        <aside className="recap card">
          <div className="sec-title" style={{ marginBottom: 8 }}>Récapitulatif</div>
          <div className="small muted" style={{ marginBottom: 8 }}>{ev ? <><b style={{ color: "var(--blue-d)" }}>{ev.name}</b><br />{longDate(ev.startsAt)}</> : "Aucun match sélectionné"}</div>
          {lines.length ? lines.map((l) => <div className="line" key={l.key}><span>{l.q} × {l.label}</span><b>{euros(l.q * l.unit)}</b></div>) : <div className="muted small">Votre panier est vide.</div>}
          {promo ? (
            <div className="line promo-line"><span>Code <b>{promo.code}</b> ({promo.text}) <button type="button" className="linkbtn" aria-label="Retirer le code promo" onClick={() => setPromo(null)}>retirer</button></span><b>−{euros(promo.discount)}</b></div>
          ) : lines.length ? (
            <form className="promo" onSubmit={(e) => { e.preventDefault(); applyPromo(); }}>
              <input type="text" aria-label="Code promo" placeholder="Code promo" value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} autoCapitalize="characters" />
              <button className="btn ghost sm" disabled={!promoInput.trim()}>Appliquer</button>
            </form>
          ) : null}
          {promoErr ? <div className="err" role="alert">{promoErr}</div> : null}
          <div className="tot"><span style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 13 }}>Total TTC</span><b>{euros(total)}</b></div>
          {mustLogin
            ? <a className="btn pri full" style={{ marginTop: 14 }} href="/connexion?suite=/acheter">Se connecter pour acheter</a>
            : <button className="btn pri full" style={{ marginTop: 14 }} disabled={!canBuy || !lines.length || busy} onClick={submit}>{busy ? "Préparation du paiement…" : total === 0 && lines.length ? "Valider ma commande" : "Payer ma commande"}</button>}
          {err ? <div className="err" role="alert">{err}</div> : null}
          <p className="small muted" style={{ margin: "12px 0 0" }}>Paiement sécurisé par carte bancaire avec SumUp. Vous recevez par e-mail un QR code par billet et par article, et votre ticket de caisse.</p>
        </aside>
      </div>
      {asking ? (
        <ChoiceModal
          title={asking.name}
          kicker={asking.choice === "boisson" ? "Choisissez votre boisson" : `Choisissez : ${(asking.choiceLabel ?? "option").toLowerCase()}`}
          choices={asking.choices.map((c) => ({ name: c, icon: asking.choice === "boisson" ? drinkIcon(c) : null }))}
          onClose={() => setAsking(null)}
          onPick={(c) => { add(asking, `${asking.id}|${c}`); flash(`${asking.name} — ${c} ajouté`); setAsking(null); }}
        />
      ) : null}
      <div className={`toast${toast ? " on" : ""}`}>{toast}</div>
    </div>
  );
}
