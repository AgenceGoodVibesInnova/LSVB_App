import type { SupabaseClient } from "@supabase/supabase-js";
import type { Line, VatRow } from "./catalog";
import { vatBreakdown } from "./pricing";

export type Legal = { legal_name: string | null; legal_address: string | null; siret: string | null; vat_number: string | null; contact_email: string | null };
export type ReceiptData = {
  id: string; access_token: string; receipt_no: string | null; status: string; pay_method: string; is_demo: boolean;
  buyer_name: string; email: string; user_id: string | null; created_at: string; paid_at: string | null;
  lines: Line[]; subtotal_cents: number; discount_cents: number; promo_code: string | null; total_cents: number; vat: VatRow[];
  event: { name: string; starts_at: string; venue: string } | null;
  passes: { idx: number; kind: "ticket" | "food" | "shop"; label: string; token: string; used_at: string | null }[];
  legal: Legal;
};

/** Commande complète pour le ticket de caisse, l'e-mail et la page des billets. */
export async function loadReceipt(admin: SupabaseClient, by: { token?: string; id?: string }): Promise<ReceiptData | null> {
  let q = admin.from("orders").select("id, access_token, receipt_no, status, pay_method, is_demo, buyer_name, email, user_id, created_at, paid_at, lines, subtotal_cents, discount_cents, promo_code, total_cents, vat, events(name, starts_at, venue), passes(idx, kind, label, token, used_at)");
  q = by.token ? q.eq("access_token", by.token) : q.eq("id", by.id ?? "");
  const [{ data: o }, { data: legal }] = await Promise.all([
    q.maybeSingle(),
    admin.from("settings").select("legal_name, legal_address, siret, vat_number, contact_email").eq("id", 1).maybeSingle(),
  ]);
  if (!o) return null;
  const lines = (o.lines ?? []) as Line[];
  // Anciennes commandes (avant la TVA par produit) : on recalcule à partir des lignes
  const vat = (o.vat as VatRow[])?.length ? (o.vat as VatRow[]) : vatBreakdown(lines.map((l) => ({ ...l, vat_rate: l.vat_rate ?? 0 })));
  return {
    ...(o as unknown as ReceiptData),
    lines,
    subtotal_cents: o.subtotal_cents ?? o.total_cents,
    discount_cents: o.discount_cents ?? 0,
    vat,
    event: (Array.isArray(o.events) ? o.events[0] : o.events) as ReceiptData["event"],
    passes: ((o.passes ?? []) as ReceiptData["passes"]).sort((a, b) => a.idx - b.idx),
    legal: (legal ?? { legal_name: "Les Sables Vendée Basket", legal_address: null, siret: null, vat_number: null, contact_email: null }) as Legal,
  };
}

export const PAY_LABEL: Record<string, string> = { sumup: "Carte bancaire (SumUp)", demo: "Paiement simulé (essai)", manuel: "Encaissé sur place", gratuit: "Offert (code promo)" };
export const pct = (r: number) => `${r.toLocaleString("fr-FR")} %`;
