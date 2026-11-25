import { redirect } from "next/navigation";
import { supabaseServer, supabaseService } from "./supabase/server";

export type Role = "admin" | "scan";
const RANK: Record<Role, number> = { scan: 1, admin: 2 };

/** Personne connectée (client ou équipe), ou null. */
export async function currentUser() {
  const { data } = await (await supabaseServer()).auth.getUser();
  return data.user ?? null;
}

/** Membre de l'équipe connecté (session du site), ou null. */
export async function staffMember() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabaseService().from("staff").select("role, email").eq("user_id", user.id).maybeSingle();
  if (!data) return null;
  return { user, role: data.role as Role, email: data.email as string };
}

/** Page réservée à l'équipe : redirige vers la connexion si besoin. */
export async function requireStaff(min: Role = "scan", from = "/admin/scanner") {
  const s = await staffMember();
  if (!s) redirect(`/admin/connexion?suite=${encodeURIComponent(from)}`);
  if (RANK[s.role] < RANK[min]) redirect("/admin/scanner");
  return s;
}

/** Route d'API réservée à l'équipe : null si non autorisé. */
export async function requestStaff(min: Role = "scan") {
  const s = await staffMember();
  if (!s || RANK[s.role] < RANK[min]) return null;
  return s;
}
