import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { requestStaff } from "@/lib/auth";

/** Compteurs en direct d'un match : entrées et buvette (commandes payées). */
export async function GET(req: Request) {
  if (!(await requestStaff("scan"))) return NextResponse.json({ error: "Connexion de l'équipe requise." }, { status: 401 });
  const event = new URL(req.url).searchParams.get("event") ?? "";
  const { data } = await supabaseService()
    .from("passes").select("kind, used_at, orders!inner(event_id, status)")
    .eq("orders.event_id", event).eq("orders.status", "paid").limit(20000);
  const s = { ticket: { n: 0, u: 0 }, food: { n: 0, u: 0 }, shop: { n: 0, u: 0 } };
  for (const p of data ?? []) { const k = p.kind as "ticket" | "food" | "shop"; s[k].n++; if (p.used_at) s[k].u++; }
  return NextResponse.json(s);
}
