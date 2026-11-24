import { supabaseService } from "@/lib/supabase/server";
import { requestStaff } from "@/lib/auth";
import { PRODUCTS, type Line } from "@/lib/catalog";

/** Export CSV (Excel) des commandes d'un match. */
export async function GET(req: Request) {
  if (!(await requestStaff("admin"))) return new Response("Réservé aux administrateurs.", { status: 403 });
  const event = new URL(req.url).searchParams.get("event") ?? "";
  const { data } = await supabaseService()
    .from("orders").select("id, created_at, buyer_name, email, phone, grp, lines, total_cents, status, pay_method, passes(used_at)")
    .eq("event_id", event).in("status", ["paid", "pending"]).order("created_at");
  const head = ["Commande", "Date", "Nom", "E-mail", "Téléphone", "Groupe", ...PRODUCTS.map((p) => p.label), "Total (€)", "Statut", "Paiement", "Scannés"];
  const rows = (data ?? []).map((o) => {
    const lines = o.lines as Line[];
    const q = (k: string) => lines.filter((l) => l.k === k).reduce((n, l) => n + l.q, 0);
    return [o.id, new Date(o.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }), o.buyer_name, o.email, o.phone ?? "", o.grp ?? "",
      ...PRODUCTS.map((p) => q(p.key)), (o.total_cents / 100).toFixed(2).replace(".", ","), o.status === "paid" ? "payé" : "en attente", o.pay_method,
      (o.passes as { used_at: string | null }[]).filter((p) => p.used_at).length];
  });
  const csv = "﻿" + [head, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="commandes-${event}.csv"` } });
}
