import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { getCheckout, sumupConfigured } from "@/lib/sumup";
import { markPaid } from "@/lib/orders";

/** Vérifie le paiement auprès de SumUp (jamais sur la seule parole du navigateur). Accès : lien privé de la commande. */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = supabaseService();
  const { data: order } = await admin.from("orders").select("id, sumup_checkout_id, total_cents, status, is_demo").eq("access_token", token).maybeSingle();
  if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  if (order.status === "paid") return NextResponse.json({ status: "paid" });
  if (!order.sumup_checkout_id) return NextResponse.json({ error: "Paiement absent." }, { status: 400 });

  // Paiement simulé : accepté seulement pour une commande créée en mode simulé, tant que SumUp n'est pas branché.
  if (order.is_demo) {
    if (order.sumup_checkout_id.startsWith("demo-") && !sumupConfigured()) {
      await markPaid(admin, order.id, "demo");
      return NextResponse.json({ status: "paid" });
    }
    return NextResponse.json({ error: "Paiement simulé indisponible." }, { status: 400 });
  }
  try {
    const c = await getCheckout(order.sumup_checkout_id);
    if (c.status === "PAID" && Math.round(Number(c.amount) * 100) === order.total_cents) {
      await markPaid(admin, order.id);
      return NextResponse.json({ status: "paid" });
    }
    if (c.status === "FAILED" || c.status === "EXPIRED") return NextResponse.json({ status: "failed" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Vérification du paiement impossible pour le moment. Réessayez dans un instant." }, { status: 502 });
  }
  return NextResponse.json({ status: order.status });
}
