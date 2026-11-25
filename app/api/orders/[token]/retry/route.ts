import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { createCheckout, sumupConfigured } from "@/lib/sumup";
import { HOLD_MINUTES } from "@/lib/catalog";

/** Nouveau paiement SumUp pour une commande non payée (carte refusée, paiement abandonné). */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = supabaseService();
  const { data: o } = await admin.from("orders").select("id, status, total_cents, is_demo, events(name, on_sale)").eq("access_token", token).maybeSingle();
  if (!o) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  if (o.status === "paid") return NextResponse.json({ status: "paid" });
  if (o.status === "cancelled") return NextResponse.json({ error: "Cette commande a été annulée." }, { status: 409 });
  const ev = (Array.isArray(o.events) ? o.events[0] : o.events) as { name: string; on_sale: boolean } | null;
  if (!ev?.on_sale) return NextResponse.json({ error: "Ce match n'est plus en vente." }, { status: 409 });
  if (o.is_demo || !sumupConfigured()) return NextResponse.json({ error: "Paiement en ligne indisponible." }, { status: 503 });
  // Places (et code promo) revérifiées si la réservation a expiré : pas de survente
  const { error: held } = await admin.rpc("renew_hold", { p_order: o.id, p_hold_minutes: HOLD_MINUTES });
  if (held) {
    const m = held.message;
    if (m.includes("SOLD_OUT")) return NextResponse.json({ error: "Il ne reste plus assez de places pour ce match." }, { status: 409 });
    if (m.includes("EVENT_CLOSED")) return NextResponse.json({ error: "Ce match n'est plus en vente." }, { status: 409 });
    if (m.includes("PROMO")) return NextResponse.json({ error: "Le code promo de cette commande n'est plus valable : refaites une commande." }, { status: 409 });
    console.error(held);
    return NextResponse.json({ error: "Relance du paiement impossible." }, { status: 500 });
  }
  try {
    const c = await createCheckout({ reference: `${o.id}-${Date.now().toString(36)}`, amountCents: o.total_cents, description: `LSVB · ${ev.name} · commande ${o.id}` });
    await admin.from("orders").update({ sumup_checkout_id: c.id }).eq("id", o.id);
    return NextResponse.json({ status: "pending", checkoutId: c.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Le paiement n'a pas pu être préparé. Réessayez dans un instant." }, { status: 502 });
  }
}
