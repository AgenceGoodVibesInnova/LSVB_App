import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { currentUser, requestStaff } from "@/lib/auth";
import { createCheckout, sumupConfigured } from "@/lib/sumup";
import { kindOf, loadProducts, BON_LABEL, HOLD_MINUTES, type Pass } from "@/lib/catalog";
import { checkPromo, priceCart, OrderError, type EventRow } from "@/lib/pricing";
import { markPaid } from "@/lib/orders";
import { code } from "@/lib/format";

type Body = { eventId?: string; lastName?: string; firstName?: string; postal?: string; name?: string; email?: string; phone?: string; group?: string; promo?: string; items?: Record<string, number> };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const admin = supabaseService();
  const staff = await requestStaff("scan");
  // Un membre de l'équipe peut vendre pour quelqu'un d'autre (guichet) : la commande va à l'e-mail saisi
  const user = staff ? null : await currentUser();
  const { data: settings } = await admin.from("settings").select("account_required").eq("id", 1).maybeSingle();
  if (settings?.account_required && !user && !staff) return NextResponse.json({ error: "Connectez-vous ou créez un compte pour acheter." }, { status: 401 });
  const last = (body.lastName ?? "").trim().slice(0, 60);
  const first = (body.firstName ?? "").trim().slice(0, 60);
  const postal = (body.postal ?? "").trim().toUpperCase().slice(0, 10);
  const name = `${first} ${last.toUpperCase()}`.trim();
  // Client connecté : la commande est rattachée à son compte et à son e-mail
  const email = (user?.email ?? body.email ?? "").trim().toLowerCase().slice(0, 190);
  if (!last || !first) return NextResponse.json({ error: "Indiquez votre nom et votre prénom." }, { status: 400 });
  if (!/^[0-9A-Z -]{4,10}$/.test(postal)) return NextResponse.json({ error: "Indiquez votre code postal." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });

  // Sans SumUp, seul le paiement simulé est possible, et uniquement pour l'équipe connectée (tests).
  const demo = !sumupConfigured();
  if (demo && !staff) return NextResponse.json({ error: "Le paiement en ligne n'est pas encore ouvert. Réessayez plus tard." }, { status: 503 });

  const { data: ev } = await admin.from("events").select("id, name, on_sale, starts_at, sales_end_at, shop_end_at, prices").eq("id", body.eventId ?? "").maybeSingle();
  if (!ev) return NextResponse.json({ error: "Ce match n'est pas en vente." }, { status: 400 });

  let priced;
  try {
    const products = await loadProducts(admin);
    const promo = body.promo?.trim() ? await checkPromo(admin, body.promo, ev.id) : null;
    priced = { ...priceCart(body.items ?? {}, ev as EventRow, products, promo), promo };
  } catch (e) {
    if (e instanceof OrderError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { lines, subtotal, discount, total, vat, promo } = priced;

  // Billets : un QR par personne. Buvette et boutique : un seul QR chacun, qui regroupe tous les articles.
  const passes: Pass[] = [];
  for (const l of lines.filter((x) => x.cat === "billet"))
    for (let i = 0; i < l.q; i++) passes.push({ idx: passes.length, kind: "ticket", type: l.k, label: l.label, drink: null, token: code(4) });
  for (const kind of ["food", "shop"] as const) {
    const items = lines.filter((x) => x.cat !== "billet" && kindOf(x.cat) === kind).map((x) => ({ label: x.label, q: x.q }));
    if (items.length) passes.push({ idx: passes.length, kind, type: kind, label: BON_LABEL[kind], drink: null, token: code(4), items });
  }

  const free = total === 0; // ex. code promo à 100 % (invitations)
  const id = code(8);
  const { data: created, error } = await admin.rpc("create_order", {
    p_order: {
      id, event_id: ev.id, user_id: user?.id ?? null, buyer_name: name, buyer_first: first, buyer_last: last, postal_code: postal, email,
      phone: (body.phone ?? "").trim().slice(0, 30) || null, grp: (body.group ?? "").trim().slice(0, 120) || null,
      lines, subtotal_cents: subtotal, discount_cents: discount, promo_code: promo?.code ?? null, vat, total_cents: total,
      is_demo: demo && !free, pay_method: free ? "gratuit" : demo ? "demo" : "sumup",
    },
    p_passes: passes,
    p_hold_minutes: HOLD_MINUTES,
  });
  if (error) {
    const m = error.message;
    if (m.includes("SOLD_OUT")) return NextResponse.json({ error: "Il ne reste pas assez de places pour ce match." }, { status: 409 });
    if (m.includes("EVENT_CLOSED")) return NextResponse.json({ error: "Ce match n'est plus en vente." }, { status: 409 });
    if (m.includes("PROMO_EXHAUSTED")) return NextResponse.json({ error: "Ce code promo a atteint son nombre maximum d'utilisations." }, { status: 409 });
    if (m.includes("PROMO_INVALID")) return NextResponse.json({ error: "Ce code promo n'est plus valable." }, { status: 409 });
    console.error(error);
    return NextResponse.json({ error: "Commande impossible à enregistrer." }, { status: 500 });
  }
  const token = (Array.isArray(created) ? created[0] : created)?.access_token as string;

  if (free) {
    await markPaid(admin, id, "gratuit");
    return NextResponse.json({ id, token, paid: true });
  }
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
