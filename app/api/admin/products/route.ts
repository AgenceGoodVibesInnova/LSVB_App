import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { requestStaff } from "@/lib/auth";
import { CATEGORIES } from "@/lib/catalog";

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "produit";

/** Ajout ou modification d'un produit du catalogue (billet, menu, boisson, snack, confiserie, boutique). */
export async function POST(req: Request) {
  if (!(await requestStaff("admin"))) return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(b.name ?? "").trim().slice(0, 80);
  const category = String(b.category ?? "");
  if (!name) return NextResponse.json({ error: "Indiquez le nom du produit." }, { status: 400 });
  if (!CATEGORIES.some((c) => c.key === category)) return NextResponse.json({ error: "Choisissez une catégorie." }, { status: 400 });
  const price = Math.round(Number(String(b.price ?? "").replace(",", ".")) * 100);
  const vat = Number(String(b.vat ?? "").replace(",", "."));
  if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: "Prix invalide." }, { status: 400 });
  if (!Number.isFinite(vat) || vat < 0 || vat >= 100) return NextResponse.json({ error: "Taux de TVA invalide." }, { status: 400 });
  const choice = b.choice === "boisson" || b.choice === "option" ? b.choice : null;
  const options = choice === "option" ? String(b.options ?? "").split(/[,;\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 20) : [];
  if (choice === "option" && !options.length) return NextResponse.json({ error: "Indiquez les choix possibles (ex. S, M, L, XL)." }, { status: 400 });
  const admin = supabaseService();
  let id = typeof b.id === "string" && /^[a-z0-9_-]{1,40}$/.test(b.id) ? b.id : "";
  if (!id) {
    id = slug(name);
    const { data: taken } = await admin.from("products").select("id").like("id", `${id}%`);
    const ids = new Set((taken ?? []).map((t) => t.id));
    for (let i = 2; ids.has(id); i++) id = `${slug(name)}-${i}`;
  }
  const row = {
    id, name, category, price_cents: price, vat_rate: vat,
    description: String(b.description ?? "").trim().slice(0, 120) || null,
    icon: String(b.icon ?? "").trim().slice(0, 8) || null,
    choice, choice_label: choice === "option" ? String(b.choiceLabel ?? "").trim().slice(0, 30) || "Choix" : choice === "boisson" ? "Boisson" : null,
    options, active: b.active !== false, sort: Math.floor(Number(b.sort) || 0),
  };
  const { error } = await admin.from("products").upsert(row);
  if (error) { console.error(error); return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 }); }
  return NextResponse.json({ id });
}
