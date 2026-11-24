import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { requestStaff } from "@/lib/auth";
import { fromParisInput } from "@/lib/format";
import { normCode } from "@/lib/pricing";

const DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Création ou modification d'un code promo (nombre de codes illimité). */
export async function POST(req: Request) {
  if (!(await requestStaff("admin"))) return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const code = normCode(String(b.code ?? ""));
  if (!/^[A-Z0-9_-]{2,30}$/.test(code)) return NextResponse.json({ error: "Code : 2 à 30 lettres, chiffres, tirets (ex. TALMONT2026, 10-2026)." }, { status: 400 });
  const kind = b.kind === "amount" ? "amount" : "percent";
  const raw = Number(String(b.value ?? "").replace(",", "."));
  const value = kind === "percent" ? Math.round(raw) : Math.round(raw * 100);
  if (!(value > 0) || (kind === "percent" && value > 100)) return NextResponse.json({ error: kind === "percent" ? "Remise : entre 1 et 100 %." : "Montant de remise invalide." }, { status: 400 });
  const d = (v: unknown, endOfDay = false) => {
    const s = String(v ?? "");
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return fromParisInput(`${s}T${endOfDay ? "23:59" : "00:00"}`);
    if (DT.test(s)) return fromParisInput(s);
    throw new Error("date");
  };
  let from: string | null, until: string | null;
  try { from = d(b.validFrom); until = d(b.validUntil, true); } catch { return NextResponse.json({ error: "Dates de validité invalides." }, { status: 400 }); }
  if (from && until && until < from) return NextResponse.json({ error: "La date de fin doit suivre la date de début." }, { status: 400 });
  const max = String(b.maxUses ?? "").trim() === "" ? null : Math.floor(Number(b.maxUses));
  if (max !== null && !(max > 0)) return NextResponse.json({ error: "Nombre d'utilisations invalide (vide = illimité)." }, { status: 400 });
  const row = {
    code, kind, value, label: String(b.label ?? "").trim().slice(0, 80) || null,
    scope: b.scope === "tout" ? "tout" : "billets", event_id: String(b.eventId ?? "") || null,
    valid_from: from, valid_until: until, max_uses: max, active: b.active !== false,
  };
  const admin = supabaseService();
  if (b.isNew) {
    const { data: exists } = await admin.from("promo_codes").select("code").eq("code", code).maybeSingle();
    if (exists) return NextResponse.json({ error: `Le code ${code} existe déjà.` }, { status: 409 });
  }
  const { error } = await admin.from("promo_codes").upsert(row);
  if (error) { console.error(error); return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 }); }
  return NextResponse.json({ code });
}
