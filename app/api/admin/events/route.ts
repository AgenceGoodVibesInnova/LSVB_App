import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { requestStaff } from "@/lib/auth";
import { PRICE_KEYS } from "@/lib/catalog";
import { code, fromParisInput } from "@/lib/format";

/** Création ou modification d'un match (administrateur). Prix reçus en euros, enregistrés en centimes. */
export async function POST(req: Request) {
  if (!(await requestStaff("admin"))) return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(b.name ?? "").trim().slice(0, 160);
  const date = String(b.date ?? "");
  if (!name || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date)) return NextResponse.json({ error: "Affiche et date obligatoires." }, { status: 400 });
  const prices: Record<string, number | null> = {};
  const raw = (b.prices ?? {}) as Record<string, unknown>;
  for (const k of PRICE_KEYS) {
    const v = raw[k];
    prices[k] = v === "" || v == null ? null : Math.round(Number(String(v).replace(",", ".")) * 100);
    if (prices[k] !== null && !(prices[k]! >= 0)) return NextResponse.json({ error: "Prix invalide." }, { status: 400 });
  }
  const id = typeof b.id === "string" && /^[A-Za-z0-9]{3,16}$/.test(b.id) ? b.id : code(6);
  const row = {
    id, name, starts_at: fromParisInput(date), venue: String(b.venue ?? "").trim().slice(0, 160),
    capacity: Math.max(0, Math.floor(Number(b.capacity) || 0)), on_sale: !!b.onSale,
    journee: b.journee === "" || b.journee == null ? null : Number(b.journee), prices,
  };
  const { error } = await supabaseService().from("events").upsert(row);
  if (error) { console.error(error); return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 }); }
  return NextResponse.json({ id });
}
