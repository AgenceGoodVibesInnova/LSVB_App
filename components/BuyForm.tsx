"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TICKETS, FOOD, DRINKS, MAX_ITEMS, type Product, type Prices } from "@/lib/catalog";
import { euros, longDate } from "@/lib/format";
import DrinkModal from "./DrinkModal";

export type SaleEvent = { id: string; name: string; startsAt: string; venue: string; journee: number | null; prices: Prices; remaining: number | null };

type Me = { name: string; email: string; phone: string } | null;

export default function BuyForm({ events, demo, canBuy, me, isStaff, accountRequired }: { events: SaleEvent[]; demo: boolean; canBuy: boolean; me: Me; isStaff: boolean; accountRequired: boolean }) {
  const router = useRouter();
  const [evId, setEvId] = useState(events[0]?.id ?? "");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [stack, setStack] = useState<Record<string, string[]>>({});
  const [asking, setAsking] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: me?.name ?? "", email: me?.email ?? "", phone: me?.phone ?? "", group: "" });
  const mustLogin = accountRequired && !me && !isStaff;

  // Le panier survit à un passage par la page de connexion
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("lsvb_cart") ?? "null");
      if (saved && events.some((e) => e.id === saved.evId)) { setEvId(saved.evId); setCart(saved.cart ?? {}); }
    } catch {}
  }, [events]);
  useEffect(() => { try { sessionStorage.setItem("lsvb_cart", JSON.stringify({ evId, cart })); } catch {} }, [evId, cart]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const ev = events.find((e) => e.id === evId);
  const price = (k: string) => (ev ? ev.prices[k as keyof Prices] ?? null : null);
  const qtyOf = (k: string) => Object.entries(cart).reduce((n, [key, v]) => n + (key === k || key.startsWith(k + "|") ? v : 0), 0);
  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  const tickets = TICKETS.reduce((n, t) => n + qtyOf(t.key), 0);

  const lines = useMemo(() => {
    if (!ev) return [];
    const out: { key: string; label: string; q: number; unit: number }[] = [];
    for (const p of [...TICKETS, ...FOOD]) {
      const unit = ev.prices[p.key];
      if (unit == null) continue;
      if (p.drink) DRINKS.forEach((d) => { const q = cart[`${p.key}|${d.name}`] ?? 0; if (q) out.push({ key: `${p.key}|${d.name}`, label: `${p.label} (${d.name})`, q, unit }); });
      else if (cart[p.key]) out.push({ key: p.key, label: p.label, q: cart[p.key], unit });
    }
    return out;
  }, [cart, ev]);
  const total = lines.reduce((s, l) => s + l.q * l.unit, 0);

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(""), 2400); }
  function add(p: Product, key: string) {
    if (totalItems >= MAX_ITEMS) return flash(`Maximum ${MAX_ITEMS} articles par commande`);
    if (p.kind === "ticket" && ev?.remaining != null && tickets >= ev.remaining) return flash("Plus assez de places disponibles");
    setCart((c) => ({ ...c, [key]: (c[key] ?? 0) + 1 }));
    if (p.drink) setStack((s) => ({ ...s, [p.key]: [...(s[p.key] ?? []), key] }));
  }
  function plus(p: Product) { if (p.drink) setAsking(p); else add(p, p.key); }
  function minus(p: Product) {
    let key = p.key as string;
    if (p.drink) {
      const st = [...(stack[p.key] ?? [])];
      const k = st.pop() ?? Object.keys(cart).filter((x) => x.startsWith(p.key + "|") && cart[x] > 0).pop();
      if (!k) return;
      key = k;
      setStack((s) => ({ ...s, [p.key]: st }));
    }
    setCart((c) => { const n = { ...c }; n[key] = Math.max(0, (n[key] ?? 0) - 1); if (!n[key]) delete n[key]; return n; });
  }
  function pickEvent(id: string) { setEvId(id); setCart({}); setStack({}); }

  async function submit() {
    setErr("");
    if (!form.name.trim()) return setErr("Indiquez votre nom.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setErr("Adresse e-mail invalide.");
    setBusy(true);
    const res = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: evId, ...form, items: cart }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) { setBusy(false); return setErr(data.error ?? "Commande impossible, réessayez."); }
    try {
      const mine = JSON.parse(localStorage.getItem("lsvb_orders") ?? "[]") as { id: string; token: string }[];
      localStorage.setItem("lsvb_orders", JSON.stringify([{ id: data.id, token: data.token }, ...mine.filter((m) => m.id !== data.id)].slice(0, 20)));
    } catch {}
    try { sessionStorage.removeItem("lsvb_cart"); } catch {}
    router.push(`/paiement/${data.token}`);
  }

  const row = (p: Product) => {
    const unit = price(p.key);
    if (unit == null) return null;
    const q = qtyOf(p.key);
    const det = p.drink ? DRINKS.map((d) => [d.name, cart[`${p.key}|${d.name}`] ?? 0] as const).filter(([, c]) => c).map(([n, c]) => `${c}× ${n}`).join(" · ") : "";
    return (
      <div key={p.key} className={`prod${p.kind === "food" ? " food" : ""}`}>
        <div className={`ic${[...p.icon].length > 2 ? " duo" : ""}`}>{p.icon}</div>
        <div className="nm">
          <b>{p.label}{p.formula ? <span className="formula-tag">FORMULE</span> : null}</b>
          {det ? <span style={{ color: "var(--orange-d)", fontWeight: 700 }}>{det}</span> : p.sub ? <span>{p.sub}</span> : p.drink ? <span>Pepsi, Orangina, jus de fruit ou Ice Tea</span> : null}
        </div>
        <div className="pr">{euros(unit)}</div>
        <div className="step">
          <button type="button" aria-label={`Retirer ${p.label}`} disabled={q <= 0} onClick={() => minus(p)}>−</button>
          <output>{q}</output>
          <button type="button" aria-label={`Ajouter ${p.label}`} onClick={() => plus(p)}>+</button>
        </div>
      </div>
    );
  };
  const formulas = FOOD.filter((f) => f.formula && price(f.key) != null);
  const singles = FOOD.filter((f) => !f.formula && price(f.key) != null);

  return (
    <div className="wrap">
      {demo ? <div className="banner">{canBuy ? "Paiement simulé (équipe) : SumUp n'est pas encore branché, aucune carte n'est débitée." : "La vente en ligne ouvre très bientôt."}</div> : null}
      <div className="grid2">
        <div>
          <div className="card">
            <div className="sec-title"><span className="n">1</span>Choisissez votre match</div>
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
            <div className="card">
              <div className="sec-title"><span className="n">2</span>Billets</div>
              {TICKETS.map(row)}
            </div>
            {formulas.length + singles.length ? (
              <div className="card">
                <div className="sec-title"><span className="n">3</span>Buvette <span className="muted small" style={{ textTransform: "none", fontWeight: 600, letterSpacing: 0 }}>— facultatif, à récupérer sur place avec votre QR</span></div>
                {formulas.length ? <><div className="subhead">Formules</div>{formulas.map(row)}</> : null}
                {singles.length ? <><div className="subhead">À l&apos;unité</div>{singles.map(row)}</> : null}
              </div>
            ) : null}
            <div className="card">
              <div className="sec-title"><span className="n">4</span>Vos coordonnées</div>
              {isStaff ? <p className="notice" style={{ marginTop: -4 }}>Vente par l&apos;équipe : saisissez les coordonnées de l&apos;acheteur, les billets lui seront envoyés.</p>
                : me ? <p className="small muted" style={{ marginTop: -6 }}>Commande rattachée à votre compte : vos billets seront aussi dans « Mon compte ».</p>
                : mustLogin ? <p className="notice" style={{ marginTop: -4 }}>Un compte est nécessaire pour acheter. <a href="/connexion?suite=/">Se connecter ou créer un compte</a> (votre panier est conservé).</p>
                : <p className="small muted" style={{ marginTop: -6 }}>Vous avez un compte ? <a href="/connexion?suite=/">Connectez-vous</a> pour retrouver vos billets dans votre espace. Sinon, continuez simplement.</p>}
              <div className="row">
                <label className="f"><span>Nom et prénom *</span><input type="text" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <label className="f"><span>E-mail * (pour recevoir les billets)</span><input type="email" autoComplete="email" value={form.email} disabled={!!me} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              </div>
              <div className="row">
                <label className="f"><span>Téléphone</span><input type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
                <label className="f"><span>Groupe / structure</span><input type="text" placeholder="Ex. club, entreprise, école…" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} /></label>
              </div>
            </div>
          </>) : null}
        </div>
        <aside className="recap card">
          <div className="sec-title" style={{ marginBottom: 8 }}>Récapitulatif</div>
          <div className="small muted" style={{ marginBottom: 8 }}>{ev ? <><b style={{ color: "var(--blue-d)" }}>{ev.name}</b><br />{longDate(ev.startsAt)}</> : "Aucun match sélectionné"}</div>
          {lines.length ? lines.map((l) => <div className="line" key={l.key}><span>{l.q} × {l.label}</span><b>{euros(l.q * l.unit)}</b></div>) : <div className="muted small">Votre panier est vide.</div>}
          <div className="tot"><span style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 13 }}>Total</span><b>{euros(total)}</b></div>
          {mustLogin
            ? <a className="btn pri full" style={{ marginTop: 14 }} href="/connexion?suite=/">Se connecter pour acheter</a>
            : <button className="btn pri full" style={{ marginTop: 14 }} disabled={!canBuy || !lines.length || busy} onClick={submit}>{busy ? "Préparation du paiement…" : "Payer ma commande"}</button>}
          {err ? <div className="err" role="alert">{err}</div> : null}
          <p className="small muted" style={{ margin: "12px 0 0" }}>Paiement sécurisé par carte bancaire avec SumUp. Après le paiement, vous recevez un QR code par billet et par article buvette, à l&apos;écran et par e-mail.</p>
        </aside>
      </div>
      {asking ? <DrinkModal title={asking.label} onClose={() => setAsking(null)} onPick={(d) => { add(asking, `${asking.key}|${d}`); flash(`${asking.label} — ${d} ajouté`); setAsking(null); }} /> : null}
      <div className={`toast${toast ? " on" : ""}`}>{toast}</div>
    </div>
  );
}
