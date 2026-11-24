import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { getCheckout } from "@/lib/sumup";
import { markPaid } from "@/lib/orders";

/**
 * Notification SumUp (« return_url ») : utile si le client ferme la page avant la fin du paiement.
 * Le contenu reçu n'est jamais cru tel quel : on relit le paiement auprès de SumUp.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { id?: string; checkout_id?: string };
  const cid = body.id ?? body.checkout_id;
  if (!cid) return NextResponse.json({ ok: true });
  const admin = supabaseService();
  const { data: o } = await admin.from("orders").select("id, total_cents, status").eq("sumup_checkout_id", cid).maybeSingle();
  if (o && o.status !== "paid") {
    try {
      const c = await getCheckout(cid);
      if (c.status === "PAID" && Math.round(Number(c.amount) * 100) === o.total_cents) await markPaid(admin, o.id);
    } catch (e) {
      console.error(e);
    }
  }
  return NextResponse.json({ ok: true });
}
