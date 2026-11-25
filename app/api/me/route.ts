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

/**
 * Suppression du compte client (exigée par l'App Store et Google Play).
 * Le profil et les appareils sont effacés. Les commandes payées sont conservées pour la comptabilité
 * (tickets de caisse, 10 ans) mais ne sont plus rattachées à aucun compte.
 */
export async function DELETE(req: Request) {
  const { data: { user } } = await (await supabaseServer()).auth.getUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (b.confirm !== "SUPPRIMER") return NextResponse.json({ error: "Confirmation manquante." }, { status: 400 });
  const admin = supabaseService();
  const { data: staff } = await admin.from("staff").select("role").eq("user_id", user.id).maybeSingle();
  if (staff) return NextResponse.json({ error: "Ce compte fait partie de l'équipe du club : demandez à un administrateur de vous retirer de l'équipe d'abord." }, { status: 409 });
  await admin.from("orders").update({ user_id: null }).eq("user_id", user.id);
  await admin.from("devices").delete().eq("user_id", user.id);
  const { error } = await admin.auth.admin.deleteUser(user.id); // le profil part avec (on delete cascade)
  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Suppression impossible pour le moment. Réessayez plus tard." }, { status: 500 });
  }
  await (await supabaseServer()).auth.signOut().catch(() => {});
  return NextResponse.json({ ok: true });
}
