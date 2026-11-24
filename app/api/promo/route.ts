import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { loadProducts } from "@/lib/catalog";
import { checkPromo, priceCart, promoText, OrderError, type EventRow } from "@/lib/pricing";

/** Aperçu d'un code promo sur le panier en cours (le montant définitif est recalculé à la commande). */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { code?: string; eventId?: string; items?: Record<string, number> };
  await new Promise((r) => setTimeout(r, 250)); // freine les essais en série
  const admin = supabaseService();
  const { data: ev } = await admin.from("events").select("id, name, on_sale, starts_at, sales_end_at, shop_end_at, prices").eq("id", b.eventId ?? "").maybeSingle();
  if (!ev) return NextResponse.json({ error: "Match introuvable." }, { status: 400 });
  try {
    const promo = await checkPromo(admin, String(b.code ?? ""), ev.id);
    const r = priceCart(b.items ?? {}, ev as EventRow, await loadProducts(admin), promo);
    return NextResponse.json({ code: promo.code, label: promo.label, text: promoText(promo), discount: r.discount, total: r.total });
  } catch (e) {
    if (e instanceof OrderError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
