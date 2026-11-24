import type { SupabaseClient } from "@supabase/supabase-js";
import { CATEGORIES, type Line, type VatRow } from "./catalog";
import { PAY_LABEL } from "./receipt";

export type Report = {
  title: string; event: { id: string; name: string; starts_at: string } | null; generatedAt: string;
  orders: number; ttc: number; ht: number; vat: number; discount: number;
  byRate: VatRow[];
  byProduct: { label: string; cat: string; rate: number; q: number; gross: number; discount: number; ttc: number; ht: number; vat: number }[];
  byCategory: { label: string; q: number; ttc: number }[];
  byPayment: { label: string; n: number; ttc: number }[];
  byPromo: { code: string; n: number; discount: number }[];
};

/** Rapport de TVA d'un match (ou de la saison si eventId = "all") : commandes payées uniquement. */
export async function buildReport(admin: SupabaseClient, eventId: string): Promise<Report> {
  let q = admin.from("orders").select("id, lines, vat, total_cents, discount_cents, promo_code, pay_method, is_demo, event_id").eq("status", "paid").limit(50000);
  if (eventId !== "all") q = q.eq("event_id", eventId);
  const [{ data: od }, { data: ev }] = await Promise.all([
    q, eventId === "all" ? Promise.resolve({ data: null }) : admin.from("events").select("id, name, starts_at").eq("id", eventId).maybeSingle(),
  ]);
  const orders = (od ?? []).filter((o) => !o.is_demo); // les commandes d'essai n'entrent pas dans la TVA
  const rate = new Map<number, VatRow>();
  const prod = new Map<string, Report["byProduct"][number]>();
  const pay = new Map<string, { n: number; ttc: number }>();
  const promo = new Map<string, { n: number; discount: number }>();
  for (const o of orders) {
    for (const v of (o.vat as VatRow[]) ?? []) {
      const r = rate.get(v.rate) ?? { rate: v.rate, ht_cents: 0, vat_cents: 0, ttc_cents: 0 };
      r.ht_cents += v.ht_cents; r.vat_cents += v.vat_cents; r.ttc_cents += v.ttc_cents; rate.set(v.rate, r);
    }
    for (const l of (o.lines as Line[]) ?? []) {
      const key = `${l.k}|${l.vat_rate}`;
      const name = l.label.replace(/ \(.*\)$/, "");
      const p = prod.get(key) ?? { label: name, cat: l.cat, rate: l.vat_rate ?? 0, q: 0, gross: 0, discount: 0, ttc: 0, ht: 0, vat: 0 };
      const net = l.q * l.unit_cents - (l.discount_cents ?? 0);
      const ht = Math.round(net / (1 + (l.vat_rate ?? 0) / 100));
      p.q += l.q; p.gross += l.q * l.unit_cents; p.discount += l.discount_cents ?? 0; p.ttc += net; p.ht += ht; p.vat += net - ht;
      prod.set(key, p);
    }
    const m = PAY_LABEL[o.pay_method] ?? o.pay_method;
    const pm = pay.get(m) ?? { n: 0, ttc: 0 }; pm.n++; pm.ttc += o.total_cents; pay.set(m, pm);
    if (o.promo_code) { const pr = promo.get(o.promo_code) ?? { n: 0, discount: 0 }; pr.n++; pr.discount += o.discount_cents ?? 0; promo.set(o.promo_code, pr); }
  }
  const byRate = [...rate.values()].sort((a, b) => a.rate - b.rate);
  const byProduct = [...prod.values()].sort((a, b) => CATEGORIES.findIndex((c) => c.key === a.cat) - CATEGORIES.findIndex((c) => c.key === b.cat) || b.ttc - a.ttc);
  const byCategory = CATEGORIES.map((c) => ({ label: c.label, q: byProduct.filter((p) => p.cat === c.key).reduce((s, p) => s + p.q, 0), ttc: byProduct.filter((p) => p.cat === c.key).reduce((s, p) => s + p.ttc, 0) })).filter((c) => c.q);
  return {
    title: ev ? `${ev.name}` : "Saison complète",
    event: ev, generatedAt: new Date().toISOString(), orders: orders.length,
    ttc: byRate.reduce((s, r) => s + r.ttc_cents, 0), ht: byRate.reduce((s, r) => s + r.ht_cents, 0), vat: byRate.reduce((s, r) => s + r.vat_cents, 0),
    discount: orders.reduce((s, o) => s + (o.discount_cents ?? 0), 0),
    byRate, byProduct, byCategory,
    byPayment: [...pay.entries()].map(([label, v]) => ({ label, ...v })),
    byPromo: [...promo.entries()].map(([code, v]) => ({ code, ...v })).sort((a, b) => b.discount - a.discount),
  };
}

const e2 = (c: number) => (c / 100).toFixed(2).replace(".", ",");
/** CSV (Excel, séparateur « ; ») du rapport. */
export function reportCsv(r: Report) {
  const rows: (string | number)[][] = [
    [`Rapport de TVA — ${r.title}`], [`Édité le ${new Date(r.generatedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`, `${r.orders} commandes payées`], [],
    ["TVA par taux"], ["Taux (%)", "Base HT (€)", "TVA (€)", "TTC (€)"],
    ...r.byRate.map((v) => [String(v.rate).replace(".", ","), e2(v.ht_cents), e2(v.vat_cents), e2(v.ttc_cents)]),
    ["Total", e2(r.ht), e2(r.vat), e2(r.ttc)], [],
    ["Détail par produit"], ["Produit", "Catégorie", "Taux TVA (%)", "Quantité", "TTC brut (€)", "Remises (€)", "TTC net (€)", "HT (€)", "TVA (€)"],
    ...r.byProduct.map((p) => [p.label, CATEGORIES.find((c) => c.key === p.cat)?.label ?? p.cat, String(p.rate).replace(".", ","), p.q, e2(p.gross), e2(p.discount), e2(p.ttc), e2(p.ht), e2(p.vat)]), [],
    ["Règlements"], ["Mode", "Commandes", "TTC (€)"], ...r.byPayment.map((p) => [p.label, p.n, e2(p.ttc)]), [],
    ["Codes promo"], ["Code", "Commandes", "Remise TTC (€)"], ...r.byPromo.map((p) => [p.code, p.n, e2(p.discount)]),
  ];
  return "﻿" + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
}
