import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { requestStaff } from "@/lib/auth";
import { markPaid, sendTickets } from "@/lib/orders";

/** Encaissement manuel (espèces, terminal SumUp sur place), annulation, renvoi des billets. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requestStaff("admin"))) return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  const admin = supabaseService();
  if (b.action === "paid") await markPaid(admin, id, "manuel");
  else if (b.action === "cancel") await admin.from("orders").update({ status: "cancelled" }).eq("id", id);
  else if (b.action === "resend") return NextResponse.json({ sent: await sendTickets(admin, id, true) });
  else return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
