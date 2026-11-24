import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { requestStaff } from "@/lib/auth";
import { makeAuthLink } from "@/lib/authlinks";
import { sendMail } from "@/lib/mailer";
import { inviteEmail } from "@/lib/emails/templates";

const LABEL: Record<string, string> = { admin: "Administrateur", scan: "Scanner (contrôle et buvette)" };
const isRole = (r: unknown): r is "admin" | "scan" => r === "admin" || r === "scan";

/** Inviter une personne dans l'équipe : e-mail avec lien pour choisir son mot de passe. */
export async function POST(req: Request) {
  const me = await requestStaff("admin");
  if (!me) return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { email?: string; role?: string };
  const email = String(b.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Indiquez une adresse e-mail valide." }, { status: 400 });
  if (!isRole(b.role)) return NextResponse.json({ error: "Choisissez un niveau d'accès." }, { status: 400 });
  const next = b.role === "admin" ? "/admin" : "/scanner";
  // Nouvelle personne : lien d'invitation. Personne déjà inscrite (ex. client) : lien de connexion directe.
  let { link, userId, error } = await makeAuthLink("invite", email, { next: `/mot-de-passe?suite=${next}` });
  if (!link) {
    if (!/registered|exists/i.test(error ?? "")) return NextResponse.json({ error: "Invitation impossible : " + error }, { status: 500 });
    ({ link, userId, error } = await makeAuthLink("magiclink", email, { next }));
    if (!link) return NextResponse.json({ error: "Invitation impossible : " + error }, { status: 500 });
  }
  const { error: e2 } = await supabaseService().from("staff").upsert({ user_id: userId, email, role: b.role });
  if (e2) return NextResponse.json({ error: "Invitation impossible." }, { status: 500 });
  const sent = await sendMail({ to: email, ...inviteEmail(link, LABEL[b.role]) });
  return NextResponse.json({ message: sent ? `Invitation envoyée à ${email}.` : `${email} a bien accès, mais l'e-mail n'a pas pu partir (réglages SMTP).` });
}

/** Changer le niveau d'accès. */
export async function PATCH(req: Request) {
  const me = await requestStaff("admin");
  if (!me) return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { userId?: string; role?: string };
  if (b.userId === me.user.id) return NextResponse.json({ error: "Vous ne pouvez pas changer votre propre niveau." }, { status: 400 });
  if (!isRole(b.role)) return NextResponse.json({ error: "Niveau inconnu." }, { status: 400 });
  await supabaseService().from("staff").update({ role: b.role }).eq("user_id", b.userId ?? "");
  return NextResponse.json({ ok: true });
}

/** Retirer l'accès (le compte reste, sans accès équipe). */
export async function DELETE(req: Request) {
  const me = await requestStaff("admin");
  if (!me) return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { userId?: string };
  if (b.userId === me.user.id) return NextResponse.json({ error: "Vous ne pouvez pas vous retirer vous-même." }, { status: 400 });
  await supabaseService().from("staff").delete().eq("user_id", b.userId ?? "");
  return NextResponse.json({ ok: true });
}
