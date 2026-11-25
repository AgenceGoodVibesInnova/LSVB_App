import { NextResponse } from "next/server";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";

/** Modification du profil client (nom, prénom, téléphone). */
export async function PATCH(req: Request) {
  const { data: { user } } = await (await supabaseServer()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { first_name?: string; last_name?: string; phone?: string; postal_code?: string; address?: string; city?: string; marketing_opt_in?: boolean };
  const admin = supabaseService();
  const { data: before } = await admin.from("profiles").select("marketing_opt_in").eq("id", user.id).single();
  const { error } = await admin.from("profiles").update({
    postal_code: String(b.postal_code ?? "").trim().slice(0, 10) || null,
    address: String(b.address ?? "").trim().slice(0, 160) || null,
    city: String(b.city ?? "").trim().slice(0, 80) || null,
    marketing_opt_in: !!b.marketing_opt_in,
    ...(!!b.marketing_opt_in !== !!before?.marketing_opt_in ? { marketing_opt_in_at: b.marketing_opt_in ? new Date().toISOString() : null } : {}),
    first_name: String(b.first_name ?? "").trim().slice(0, 60) || null,
    last_name: String(b.last_name ?? "").trim().slice(0, 60) || null,
    phone: String(b.phone ?? "").trim().slice(0, 20) || null,
  }).eq("id", user.id);
  if (error) return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
