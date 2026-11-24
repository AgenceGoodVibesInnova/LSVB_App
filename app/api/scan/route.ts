import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { requestStaff } from "@/lib/auth";
import { CODE_RE } from "@/lib/format";

type R = { result: "ok" | "warn" | "bad"; title: string; detail?: string; who?: string; code?: string };
const reply = (r: R) => NextResponse.json(r);

/** Contrôle d'un QR code à l'entrée (mode « ticket ») ou à la buvette (mode « food »). */
export async function POST(req: Request) {
  const staff = await requestStaff("scan");
  if (!staff) return NextResponse.json({ error: "Connexion de l'équipe requise." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { code?: string; eventId?: string; mode?: string };
  const mode = b.mode === "food" ? "food" : b.mode === "shop" ? "shop" : "ticket";
  const POSTE = { ticket: "l'entrée", food: "la buvette", shop: "le stand boutique" } as const;
  const TITRE = { ticket: "Billet d'entrée", food: "Bon buvette", shop: "Bon boutique" } as const;
  const m = String(b.code ?? "").toUpperCase().match(CODE_RE);
  if (!m) return reply({ result: "bad", title: "QR non reconnu", detail: "Ce code n'est pas un billet LSVB" });
  const [, oid, idxS, tok] = m;
  const idx = Number(idxS);

  const admin = supabaseService();
  const { data: p } = await admin
    .from("passes")
    .select("kind, label, token, used_at, orders!inner(event_id, status, buyer_name, grp, events(name, starts_at))")
    .eq("order_id", oid).eq("idx", idx).maybeSingle();
  if (!p || p.token !== tok) return reply({ result: "bad", title: "Billet invalide", detail: "Code introuvable" });
  const o = (Array.isArray(p.orders) ? p.orders[0] : p.orders) as { event_id: string; status: string; buyer_name: string; grp: string | null; events: { name: string; starts_at: string } | { name: string; starts_at: string }[] | null };
  const ev = Array.isArray(o.events) ? o.events[0] : o.events;
  const who = o.buyer_name + (o.grp ? ` · ${o.grp}` : "");

  if (o.event_id !== b.eventId)
    return reply({ result: "bad", title: "Mauvais match", detail: `Valable pour : ${ev?.name ?? "un autre match"}`, who });
  if (o.status !== "paid") return reply({ result: "bad", title: "Non payé", detail: "Le paiement de cette commande n'est pas confirmé", who });
  if (p.kind !== mode) {
    const k = p.kind as keyof typeof POSTE;
    return reply({ result: "warn", title: TITRE[k], detail: `À présenter à ${POSTE[k]}, pas à ${POSTE[mode]}`, who: `${p.label} · ${who}` });
  }

  // Passage enregistré une seule fois, même si deux appareils scannent en même temps
  const { data: done } = await admin
    .from("passes")
    .update({ used_at: new Date().toISOString(), used_mode: mode, used_by: staff.user.id })
    .eq("order_id", oid).eq("idx", idx).is("used_at", null)
    .select("idx");
  if (!done?.length) {
    const { data: again } = await admin.from("passes").select("used_at").eq("order_id", oid).eq("idx", idx).single();
    const at = again?.used_at ? new Date(again.used_at) : null;
    return reply({
      result: "bad",
      title: mode === "ticket" ? "Déjà scanné" : mode === "food" ? "Déjà servi" : "Déjà remis",
      detail: at ? `Le ${at.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })} à ${at.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" })}` : undefined,
      who: `${p.label} · ${who}`,
    });
  }
  const { count } = await admin.from("passes").select("idx", { count: "exact", head: true }).eq("order_id", oid).eq("kind", p.kind);
  return reply({
    result: "ok",
    title: mode === "food" ? "À servir" : mode === "shop" ? "À remettre" : "Entrée validée",
    detail: p.label,
    who: who + (count && count > 1 ? ` · commande de ${count}` : ""),
    code: `${oid}-${idx}-${tok}`,
  });
}
