import { NextResponse } from "next/server";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";

/** Modification du profil client (nom, prénom, téléphone). */
export async function PATCH(req: Request) {
  const { data: { user } } = await (await supabaseServer()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { first_name?: string; last_name?: string; phone?: string };
  const { error } = await supabaseService().from("profiles").update({
    first_name: String(b.first_name ?? "").trim().slice(0, 60) || null,
    last_name: String(b.last_name ?? "").trim().slice(0, 60) || null,
    phone: String(b.phone ?? "").trim().slice(0, 20) || null,
  }).eq("id", user.id);
  if (error) return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
