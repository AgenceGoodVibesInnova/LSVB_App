import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { requestStaff } from "@/lib/auth";
import { code, fromParisInput } from "@/lib/format";

const DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Création ou modification d'un match (administrateur). Prix spéciaux en centimes, null = produit non proposé. */
export async function POST(req: Request) {
  if (!(await requestStaff("admin"))) return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(b.name ?? "").trim().slice(0, 160);
  const date = String(b.date ?? "");
  if (!name || !DT.test(date)) return NextResponse.json({ error: "Affiche et date obligatoires." }, { status: 400 });
  const opt = (v: unknown) => { const s = String(v ?? ""); if (!s) return null; if (!DT.test(s)) throw new Error("date"); return fromParisInput(s); };
  let salesEnd: string | null, shopEnd: string | null;
  try { salesEnd = opt(b.salesEnd); shopEnd = opt(b.shopEnd); } catch { return NextResponse.json({ error: "Date de fin de vente invalide." }, { status: 400 }); }
  const startsAt = fromParisInput(date);
  if (salesEnd && salesEnd > startsAt) return NextResponse.json({ error: "La fin de vente des billets doit précéder le match." }, { status: 400 });

  const prices: Record<string, number | null> = {};
  for (const [k, v] of Object.entries((b.prices ?? {}) as Record<string, unknown>)) {
    if (!/^[a-z0-9_-]{1,40}$/.test(k)) continue;
    if (v === null) prices[k] = null;
    else { const n = Number(v); if (!Number.isInteger(n) || n < 0) return NextResponse.json({ error: "Prix invalide." }, { status: 400 }); prices[k] = n; }
  }
  const id = typeof b.id === "string" && /^[A-Za-z0-9]{3,16}$/.test(b.id) ? b.id : code(6);
  const row = {
    id, name, starts_at: startsAt, venue: String(b.venue ?? "").trim().slice(0, 160),
    capacity: Math.max(0, Math.floor(Number(b.capacity) || 0)), on_sale: !!b.onSale,
    journee: b.journee === "" || b.journee == null ? null : Number(b.journee), prices, sales_end_at: salesEnd, shop_end_at: shopEnd,
  };
  const { error } = await supabaseService().from("events").upsert(row);
  if (error) { console.error(error); return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 }); }
  return NextResponse.json({ id });
}
