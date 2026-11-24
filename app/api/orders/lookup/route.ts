import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { sendTickets } from "@/lib/orders";

/** « Mes billets » : n° de commande + e-mail → lien privé. Renvoie aussi l'e-mail si demandé. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { id?: string; email?: string; resend?: boolean };
  const id = (b.id ?? "").trim().toUpperCase();
  const email = (b.email ?? "").trim().toLowerCase();
  await new Promise((r) => setTimeout(r, 400)); // freine les essais en série
  const admin = supabaseService();
  const { data: o } = await admin.from("orders").select("id, access_token, status").eq("id", id).eq("email", email).maybeSingle();
  if (!o) return NextResponse.json({ error: "Aucune commande ne correspond à ce numéro et cet e-mail." }, { status: 404 });
  let sent = false;
  if (b.resend && o.status === "paid") sent = await sendTickets(admin, o.id, true);
  return NextResponse.json({ token: o.access_token, status: o.status, sent });
}
