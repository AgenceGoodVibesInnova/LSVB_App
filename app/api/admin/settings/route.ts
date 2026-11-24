import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { requestStaff } from "@/lib/auth";

export async function POST(req: Request) {
  if (!(await requestStaff("admin"))) return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { account_required?: boolean; contact_email?: string };
  const { error } = await supabaseService().from("settings").upsert({
    id: 1, account_required: !!b.account_required, contact_email: String(b.contact_email ?? "").trim().slice(0, 190) || null, updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
