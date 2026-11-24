import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { requestStaff } from "@/lib/auth";

const txt = (v: unknown, n = 190) => String(v ?? "").trim().slice(0, n) || null;

export async function POST(req: Request) {
  if (!(await requestStaff("admin"))) return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { error } = await supabaseService().from("settings").upsert({
    id: 1, account_required: !!b.account_required, contact_email: txt(b.contact_email), report_email: txt(b.report_email),
    legal_name: txt(b.legal_name, 120), legal_address: txt(b.legal_address, 200), siret: txt(b.siret, 20), vat_number: txt(b.vat_number, 20),
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
