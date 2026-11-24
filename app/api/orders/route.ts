import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { currentUser, requestStaff } from "@/lib/auth";
import { createCheckout, sumupConfigured } from "@/lib/sumup";
import { parseCartKey, MAX_ITEMS, HOLD_MINUTES, type Line, type Pass, type Prices } from "@/lib/catalog";
import { code } from "@/lib/format";

type Body = { eventId?: string; name?: string; email?: string; phone?: string; group?: string; items?: Record<string, number> };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const admin = supabaseService();
  const staff = await requestStaff("scan");
  // Un membre de l'équipe peut vendre pour quelqu'un d'autre (guichet) : la commande va à l'e-mail saisi
  const user = staff ? null : await currentUser();
  const { data: settings } = await admin.from("settings").select("account_required").eq("id", 1).maybeSingle();
  if (settings?.account_required && !user && !staff) return NextResponse.json({ error: "Connectez-vous ou créez un compte pour acheter." }, { status: 401 });
  const name = (body.name ?? "").trim().slice(0, 120);
  // Client connecté : la commande est rattachée à son compte et à son e-mail
  const email = (user?.email ?? body.email ?? "").trim().toLowerCase().slice(0, 190);
  if (!name) return NextResponse.json({ error: "Indiquez votre nom." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });

  // Sans SumUp, seul le paiement simulé est possible, et uniquement pour l'équipe connectée (tests).
  const demo = !sumupConfigured();
  if (demo && !staff)
    return NextResponse.json({ error: "Le paiement en ligne n'est pas encore ouvert. Réessayez plus tard." }, { status: 503 });

  const { data: ev } = await admin.from("events").select("id, name, on_sale, prices").eq("id", body.eventId ?? "").maybeSingle();
  if (!ev || !ev.on_sale) return NextResponse.json({ error: "Ce match n'est pas en vente." }, { status: 400 });
  const prices = ev.prices as Prices;

  // Les prix viennent toujours de la base, jamais du navigateur.
  const lines: Line[] = [];
  for (const [key, raw] of Object.entries(body.items ?? {})) {
    const q = Number(raw);
    if (!Number.isInteger(q) || q <= 0) continue;
    const parsed = parseCartKey(key);
    const unit = parsed ? prices[parsed.p.key] : null;
    if (!parsed || unit == null) return NextResponse.json({ error: "Un article n'est plus disponible. Rechargez la page." }, { status: 409 });
    lines.push({ k: parsed.p.key, drink: parsed.drink, label: parsed.drink ? `${parsed.p.label} (${parsed.drink})` : parsed.p.label, q, unit_cents: unit });
  }
  const count = lines.reduce((n, l) => n + l.q, 0);
  if (!count) return NextResponse.json({ error: "Votre panier est vide." }, { status: 400 });
  if (count > MAX_ITEMS) return NextResponse.json({ error: `Maximum ${MAX_ITEMS} articles par commande.` }, { status: 400 });
  const total = lines.reduce((s, l) => s + l.q * l.unit_cents, 0);
  if (total <= 0) return NextResponse.json({ error: "Montant invalide." }, { status: 400 });

  const passes: Pass[] = [];
  for (const l of lines) {
    const kind = ["full", "reduced", "child"].includes(l.k) ? "ticket" : "food";
    for (let i = 0; i < l.q; i++) passes.push({ idx: passes.length, kind, type: l.k, label: l.label, drink: l.drink, token: code(4) });
  }

  const id = code(8);
  const { data: created, error } = await admin.rpc("create_order", {
    p_order: { id, event_id: ev.id, user_id: user?.id ?? null, buyer_name: name, email, phone: (body.phone ?? "").trim().slice(0, 30) || null, grp: (body.group ?? "").trim().slice(0, 120) || null, lines, total_cents: total, is_demo: demo, pay_method: demo ? "demo" : "sumup" },
    p_passes: passes,
    p_hold_minutes: HOLD_MINUTES,
  });
  if (error) {
    if (error.message.includes("SOLD_OUT")) return NextResponse.json({ error: "Il ne reste pas assez de places pour ce match." }, { status: 409 });
    if (error.message.includes("EVENT_CLOSED")) return NextResponse.json({ error: "Ce match n'est plus en vente." }, { status: 409 });
    console.error(error);
    return NextResponse.json({ error: "Commande impossible à enregistrer." }, { status: 500 });
  }
  const token = (Array.isArray(created) ? created[0] : created)?.access_token as string;

  if (demo) {
    await admin.from("orders").update({ sumup_checkout_id: `demo-${id}` }).eq("id", id);
    return NextResponse.json({ id, token });
  }
  try {
    const checkout = await createCheckout({ reference: id, amountCents: total, description: `LSVB · ${ev.name} · commande ${id}` });
    await admin.from("orders").update({ sumup_checkout_id: checkout.id }).eq("id", id);
  } catch (e) {
    await admin.from("orders").delete().eq("id", id);
    console.error(e);
    return NextResponse.json({ error: "Le paiement n'a pas pu être préparé. Réessayez dans un instant." }, { status: 502 });
  }
  return NextResponse.json({ id, token });
}
