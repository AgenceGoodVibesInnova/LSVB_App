// Catalogue de la billetterie : billets et buvette. Les prix sont propres à chaque match (events.prices, en centimes).

export type Kind = "ticket" | "food";
export type Product = { key: PriceKey; label: string; sub?: string; icon: string; kind: Kind; formula?: boolean; drink?: boolean };
export type PriceKey = "full" | "reduced" | "child" | "bt" | "bs" | "b" | "s" | "t";
export type Prices = Partial<Record<PriceKey, number | null>>;

export const TICKETS: Product[] = [
  { key: "full", label: "Plein tarif", sub: "Adulte", icon: "🎟️", kind: "ticket" },
  { key: "reduced", label: "Tarif réduit", sub: "Sur justificatif", icon: "🎟️", kind: "ticket" },
  { key: "child", label: "Enfant", sub: "Moins de 12 ans", icon: "🧒", kind: "ticket" },
];

export const FOOD: Product[] = [
  { key: "bt", label: "Tacos + boisson offerte", icon: "🌮🥤", kind: "food", formula: true, drink: true },
  { key: "bs", label: "Sandwich + boisson offerte", icon: "🥪🥤", kind: "food", formula: true, drink: true },
  { key: "b", label: "Boisson", icon: "🥤", kind: "food", drink: true },
  { key: "s", label: "Sandwich", icon: "🥪", kind: "food" },
  { key: "t", label: "Tacos", icon: "🌮", kind: "food" },
];

export const PRODUCTS: Product[] = [...TICKETS, ...FOOD];
export const PRICE_KEYS = PRODUCTS.map((p) => p.key);
export const DRINKS = [
  { name: "Pepsi", icon: "🥤" },
  { name: "Orangina", icon: "🍊" },
  { name: "Jus de fruit", icon: "🧃" },
  { name: "Ice Tea", icon: "🧋" },
] as const;
export const DRINK_NAMES: string[] = DRINKS.map((d) => d.name);

export const MAX_ITEMS = 80;
export const HOLD_MINUTES = 30;

export const product = (key: string) => PRODUCTS.find((p) => p.key === key);

/** Clé de panier : « full », ou « bt|Orangina » pour un produit avec boisson. */
export function parseCartKey(key: string): { p: Product; drink: string | null } | null {
  const [k, drink] = key.split("|");
  const p = product(k);
  if (!p) return null;
  if (p.drink) return drink && DRINK_NAMES.includes(drink) ? { p, drink } : null;
  return drink ? null : { p, drink: null };
}

export type Line = { k: PriceKey; drink: string | null; label: string; q: number; unit_cents: number };
export type Pass = { idx: number; kind: Kind; type: PriceKey; label: string; drink: string | null; token: string };
