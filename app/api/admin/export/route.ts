import { supabaseService } from "@/lib/supabase/server";
import { requestStaff } from "@/lib/auth";
import { loadProducts, type Line } from "@/lib/catalog";

/** Export CSV (Excel) des commandes d'un match : une colonne par produit, remise, n° de ticket de caisse. */
export async function GET(req: Request) {
  if (!(await requestStaff("admin"))) return new Response("Réservé aux administrateurs.", { status: 403 });
  const event = new URL(req.url).searchParams.get("event") ?? "";
  const admin = supabaseService();
  const [{ data }, products] = await Promise.all([
    admin.from("orders").select("id, receipt_no, created_at, buyer_name, buyer_last, buyer_first, postal_code, email, phone, grp, lines, subtotal_cents, discount_cents, promo_code, total_cents, status, pay_method, passes(used_at)")
      .eq("event_id", event).in("status", ["paid", "pending"]).order("created_at"),
    loadProducts(admin, true),
  ]);
  const head = ["Commande", "Ticket de caisse", "Date", "Nom", "Prénom", "Code postal", "E-mail", "Téléphone", "Groupe", ...products.map((p) => p.name), "Sous-total (€)", "Code promo", "Remise (€)", "Total TTC (€)", "Statut", "Paiement", "QR scannés"];
  const e2 = (c: number) => (c / 100).toFixed(2).replace(".", ",");
  const rows = (data ?? []).map((o) => {
    const lines = o.lines as Line[];
    const q = (k: string) => lines.filter((l) => l.k === k).reduce((n, l) => n + l.q, 0);
    return [o.id, o.receipt_no ?? "", new Date(o.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }), o.buyer_last ?? o.buyer_name, o.buyer_first ?? "", o.postal_code ?? "", o.email, o.phone ?? "", o.grp ?? "",
      ...products.map((p) => q(p.id)), e2(o.subtotal_cents ?? o.total_cents), o.promo_code ?? "", e2(o.discount_cents ?? 0), e2(o.total_cents),
      o.status === "paid" ? "payé" : "en attente", o.pay_method, (o.passes as { used_at: string | null }[]).filter((p) => p.used_at).length];
  });
  const csv = "﻿" + [head, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="commandes-${event}.csv"` } });
}
