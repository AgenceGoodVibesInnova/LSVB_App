import type { SupabaseClient } from "@supabase/supabase-js";

export type Client = { email: string; name: string; phone: string; account: boolean; orders: number; tickets: number; spent: number; last: string; lastEvent: string };

/** Fichier clients : acheteurs (avec ou sans compte) et comptes créés, regroupés par e-mail. */
export async function clientList(admin: SupabaseClient): Promise<Client[]> {
  const [{ data: od }, { data: profiles }, { data: staff }] = await Promise.all([
    admin.from("orders").select("email, buyer_name, phone, total_cents, created_at, events(name), passes(kind)").eq("status", "paid").order("created_at").limit(20000),
    admin.from("profiles").select("id, email, first_name, last_name, phone, created_at").limit(20000),
    admin.from("staff").select("user_id"),
  ]);
  const team = new Set((staff ?? []).map((s) => s.user_id));
  const map = new Map<string, Client>();
  for (const p of profiles ?? []) {
    if (!p.email || team.has(p.id)) continue;
    map.set(p.email, { email: p.email, name: [p.first_name, p.last_name].filter(Boolean).join(" "), phone: p.phone ?? "", account: true, orders: 0, tickets: 0, spent: 0, last: p.created_at, lastEvent: "" });
  }
  for (const o of od ?? []) {
    const c = map.get(o.email) ?? { email: o.email, name: "", phone: "", account: false, orders: 0, tickets: 0, spent: 0, last: o.created_at, lastEvent: "" };
    c.name ||= o.buyer_name; c.phone ||= o.phone ?? "";
    c.orders++; c.spent += o.total_cents; c.tickets += (o.passes as { kind: string }[]).filter((p) => p.kind === "ticket").length;
    c.last = o.created_at;
    const ev = Array.isArray(o.events) ? o.events[0] : o.events;
    c.lastEvent = (ev as { name: string } | null)?.name ?? "";
    map.set(o.email, c);
  }
  return [...map.values()].sort((a, b) => b.last.localeCompare(a.last));
}
