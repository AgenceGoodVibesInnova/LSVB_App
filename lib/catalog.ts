// Catalogue de la billetterie, géré dans /admin/produits (table products).
// Chaque match peut masquer un produit ou lui donner un prix spécial (events.prices).
import type { SupabaseClient } from "@supabase/supabase-js";

export type Category = "billet" | "menu" | "boisson" | "snack" | "confiserie" | "boutique";
export type Kind = "ticket" | "food" | "shop";

export const CATEGORIES: { key: Category; label: string; short: string; kind: Kind; hint?: string }[] = [
  { key: "billet", label: "Billets", short: "Billets", kind: "ticket" },
  { key: "menu", label: "Menus", short: "Menus", kind: "food", hint: "boisson offerte au choix" },
  { key: "snack", label: "Snacks", short: "Snacks", kind: "food" },
  { key: "boisson", label: "Boissons", short: "Boissons", kind: "food" },
  { key: "confiserie", label: "Confiserie", short: "Confiserie", kind: "food" },
  { key: "boutique", label: "Boutique du club", short: "Boutique", kind: "shop", hint: "à retirer au stand boutique" },
];
export const kindOf = (c: Category): Kind => CATEGORIES.find((x) => x.key === c)?.kind ?? "food";
export const KIND_LABEL: Record<Kind, string> = { ticket: "Billet d'entrée", food: "Bon buvette", shop: "Bon boutique" };

export type Product = {
  id: string;
  category: Category;
  name: string;
  description: string | null;
  icon: string | null;
  price_cents: number;
  vat_rate: number;
  choice: "boisson" | "option" | null;
  choice_label: string | null;
  options: string[];
  active: boolean;
  sort: number;
};

/** Exceptions de prix par match : absent = prix du catalogue, null = non proposé, nombre = prix spécial (centimes). */
export type Prices = Record<string, number | null>;

export const MAX_ITEMS = 80;
export const HOLD_MINUTES = 30;
export const SHOP_DAYS_BEFORE = 3;

export async function loadProducts(admin: SupabaseClient, withInactive = false): Promise<Product[]> {
  let q = admin.from("products").select("*").order("sort").order("name");
  if (!withInactive) q = q.eq("active", true);
  const { data } = await q;
  const order = CATEGORIES.map((c) => c.key);
  return ((data ?? []) as Product[])
    .map((p) => ({ ...p, vat_rate: Number(p.vat_rate), options: p.options ?? [] }))
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.sort - b.sort);
}

/** Prix d'un produit pour un match, ou null s'il n'y est pas proposé. */
export function priceFor(p: Product, prices: Prices | null | undefined): number | null {
  if (!p.active) return null;
  if (prices && Object.prototype.hasOwnProperty.call(prices, p.id)) return prices[p.id];
  return p.price_cents;
}

/** Choix proposés pour un produit : boissons actives, ou options (tailles…). */
export function choicesFor(p: Product, products: Product[]): string[] {
  if (p.choice === "boisson") return products.filter((x) => x.category === "boisson" && x.active).map((x) => x.name);
  if (p.choice === "option") return p.options;
  return [];
}

/** Fins de vente d'un match : billets (par défaut au début du match), buvette et boutique (par défaut 3 jours avant). */
export function salesWindows(ev: { starts_at: string; sales_end_at?: string | null; shop_end_at?: string | null }) {
  const start = new Date(ev.starts_at).getTime();
  const salesEnd = ev.sales_end_at ? new Date(ev.sales_end_at).getTime() : start;
  const shopEnd = ev.shop_end_at ? new Date(ev.shop_end_at).getTime() : start - SHOP_DAYS_BEFORE * 86400e3;
  return { salesEnd, shopEnd: Math.min(shopEnd, salesEnd) };
}

/** Ligne de commande, figée au moment de l'achat (prix et TVA de ce jour-là). */
export type Line = {
  k: string;               // id du produit
  cat: Category;
  drink: string | null;    // choix : boisson ou option (taille…)
  label: string;
  q: number;
  unit_cents: number;
  vat_rate: number;
  discount_cents?: number; // part de la remise affectée à la ligne
};
export type PassItem = { label: string; q: number };
/** Billet : un QR par personne. Buvette et boutique : un seul QR par commande, qui liste les articles (items). */
export type Pass = { idx: number; kind: Kind; type: string; label: string; drink: string | null; token: string; items?: PassItem[] | null };
export const BON_LABEL: Record<Kind, string> = { ticket: "Billet", food: "Bon buvette", shop: "Bon boutique" };
export type VatRow = { rate: number; ht_cents: number; vat_cents: number; ttc_cents: number };
