// Calcul d'une commande côté serveur : lignes, code promo, TVA. Le navigateur n'envoie que des quantités.
import type { SupabaseClient } from "@supabase/supabase-js";
import { choicesFor, priceFor, salesWindows, MAX_ITEMS, HOLD_MINUTES, type Line, type Prices, type Product, type VatRow } from "./catalog";

export type Promo = {
  code: string; label: string | null; kind: "percent" | "amount"; value: number; scope: "billets" | "tout";
  event_id: string | null; valid_from: string | null; valid_until: string | null; max_uses: number | null; active: boolean;
};
export type EventRow = { id: string; name: string; on_sale: boolean; starts_at: string; sales_end_at: string | null; shop_end_at: string | null; prices: Prices };

export class OrderError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const normCode = (c: string) => c.trim().toUpperCase().replace(/\s+/g, "");

/** Vérifie un code promo pour un match. Lance OrderError si refusé. */
export async function checkPromo(admin: SupabaseClient, raw: string, eventId: string): Promise<Promo> {
  const code = normCode(raw);
  const { data } = await admin.from("promo_codes").select("*").eq("code", code).maybeSingle();
  const p = data as Promo | null;
  const now = Date.now();
  if (!p || !p.active) throw new OrderError("Ce code promo n'existe pas.");
  if (p.event_id && p.event_id !== eventId) throw new OrderError("Ce code promo n'est pas valable pour ce match.");
  if (p.valid_from && now < new Date(p.valid_from).getTime()) throw new OrderError("Ce code promo n'est pas encore valable.");
  if (p.valid_until && now > new Date(p.valid_until).getTime()) throw new OrderError("Ce code promo a expiré.");
  if (p.max_uses) {
    const since = new Date(now - HOLD_MINUTES * 60e3).toISOString();
    const { count } = await admin.from("orders").select("id", { count: "exact", head: true })
      .eq("promo_code", code).or(`status.eq.paid,and(status.eq.pending,created_at.gt.${since})`);
    if ((count ?? 0) >= p.max_uses) throw new OrderError("Ce code promo a atteint son nombre maximum d'utilisations.");
  }
  return p;
}

/** Répartit une remise sur les lignes concernées, au prorata (méthode des plus forts restes). */
function spread(lines: Line[], eligible: (l: Line) => boolean, discount: number) {
  const base = lines.reduce((s, l) => s + (eligible(l) ? l.q * l.unit_cents : 0), 0);
  if (!base || !discount) return;
  let left = discount;
  const parts = lines.map((l, i) => {
    const amt = eligible(l) ? (discount * l.q * l.unit_cents) / base : 0;
    return { i, floor: Math.floor(amt), rest: amt - Math.floor(amt) };
  });
  parts.forEach((p) => { lines[p.i].discount_cents = p.floor; left -= p.floor; });
  parts.filter((p) => eligible(lines[p.i])).sort((a, b) => b.rest - a.rest).slice(0, left).forEach((p) => { lines[p.i].discount_cents! += 1; });
}

/** TVA par taux, sur les montants TTC après remise. */
export function vatBreakdown(lines: Line[]): VatRow[] {
  const by = new Map<number, number>();
  for (const l of lines) by.set(l.vat_rate, (by.get(l.vat_rate) ?? 0) + l.q * l.unit_cents - (l.discount_cents ?? 0));
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([rate, ttc]) => {
    const ht = Math.round(ttc / (1 + rate / 100));
    return { rate, ht_cents: ht, vat_cents: ttc - ht, ttc_cents: ttc };
  });
}

/** Panier { "full": 2, "bt|Orangina": 1, "tshirt|L": 1 } → lignes, remise, TVA, total. */
export function priceCart(items: Record<string, unknown>, ev: EventRow, products: Product[], promo: Promo | null, now = Date.now()) {
  const { salesEnd, shopEnd } = salesWindows(ev);
  if (!ev.on_sale || now > salesEnd) throw new OrderError("La vente en ligne est terminée pour ce match.", 409);
  const lines: Line[] = [];
  for (const [key, raw] of Object.entries(items ?? {})) {
    const q = Number(raw);
    if (!Number.isInteger(q) || q <= 0) continue;
    const sep = key.indexOf("|");
    const id = sep < 0 ? key : key.slice(0, sep);
    const choice = sep < 0 ? null : key.slice(sep + 1);
    const p = products.find((x) => x.id === id);
    const unit = p ? priceFor(p, ev.prices) : null;
    if (!p || unit == null) throw new OrderError("Un article n'est plus disponible. Rechargez la page.", 409);
    if (p.category !== "billet" && now > shopEnd)
      throw new OrderError("Les commandes buvette et boutique sont closes pour ce match (préparation des commandes).", 409);
    const choices = choicesFor(p, products);
    if (choices.length ? !choice || !choices.includes(choice) : choice) throw new OrderError(`Choix invalide pour « ${p.name} ».`, 409);
    const label = choice ? `${p.name} (${p.choice === "option" && p.choice_label ? `${p.choice_label} ${choice}` : choice})` : p.name;
    lines.push({ k: p.id, cat: p.category, drink: choice, label, q, unit_cents: unit, vat_rate: p.vat_rate });
  }
  const count = lines.reduce((n, l) => n + l.q, 0);
  if (!count) throw new OrderError("Votre panier est vide.");
  if (count > MAX_ITEMS) throw new OrderError(`Maximum ${MAX_ITEMS} articles par commande.`);
  const subtotal = lines.reduce((s, l) => s + l.q * l.unit_cents, 0);

  let discount = 0;
  if (promo) {
    const eligible = (l: Line) => promo.scope === "tout" || l.cat === "billet";
    const base = lines.reduce((s, l) => s + (eligible(l) ? l.q * l.unit_cents : 0), 0);
    if (!base) throw new OrderError(promo.scope === "billets" ? "Ce code promo s'applique aux billets : ajoutez au moins un billet." : "Ce code promo ne s'applique pas à ce panier.");
    discount = Math.min(base, promo.kind === "percent" ? Math.round((base * Math.min(promo.value, 100)) / 100) : promo.value);
    spread(lines, eligible, discount);
  }
  const total = subtotal - discount;
  return { lines, subtotal, discount, total, vat: vatBreakdown(lines) };
}

export function promoText(p: Pick<Promo, "kind" | "value" | "scope">) {
  const v = p.kind === "percent" ? `-${p.value} %` : `-${(p.value / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}`;
  return `${v} ${p.scope === "billets" ? "sur les billets" : "sur la commande"}`;
}
