import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { requestStaff } from "@/lib/auth";
import { CODE_RE } from "@/lib/format";

/** Annule le dernier passage (erreur de scan). */
export async function POST(req: Request) {
  if (!(await requestStaff("scan"))) return NextResponse.json({ error: "Connexion de l'équipe requise." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { code?: string };
  const m = String(b.code ?? "").toUpperCase().match(CODE_RE);
  if (!m) return NextResponse.json({ error: "Code invalide." }, { status: 400 });
  await supabaseService().from("passes").update({ used_at: null, used_mode: null, used_by: null })
    .eq("order_id", m[1]).eq("idx", Number(m[2])).eq("token", m[3]);
  return NextResponse.json({ ok: true });
}
