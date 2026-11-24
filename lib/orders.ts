import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMail } from "./mailer";
import { longDate } from "./format";
import { ticketsEmail } from "./emails/templates";
import type { Line } from "./catalog";

import { siteUrl as site } from "./emails/layout";

/** Marque la commande payée (une seule fois) et envoie les billets par e-mail. */
export async function markPaid(admin: SupabaseClient, id: string, method?: "sumup" | "demo" | "manuel") {
  const { data } = await admin
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString(), ...(method ? { pay_method: method } : {}) })
    .eq("id", id)
    .neq("status", "paid")
    .select("id")
    .maybeSingle();
  if (data) await sendTickets(admin, id);
}

/** E-mail « vos billets » avec le lien privé vers les QR codes. Renvoie true si envoyé. */
export async function sendTickets(admin: SupabaseClient, id: string, force = false) {
  const { data: o } = await admin
    .from("orders")
    .select("id, access_token, user_id, buyer_name, email, lines, total_cents, email_sent_at, status, is_demo, events(name, starts_at, venue)")
    .eq("id", id)
    .maybeSingle();
  if (!o || o.status !== "paid" || (o.email_sent_at && !force)) return false;
  const ev = (Array.isArray(o.events) ? o.events[0] : o.events) as { name: string; starts_at: string; venue: string } | null;
  const mail = ticketsEmail(
    { id: o.id, buyer_name: o.buyer_name, total_cents: o.total_cents, lines: o.lines as Line[], is_demo: o.is_demo },
    ev ? { name: ev.name, when: longDate(ev.starts_at), venue: ev.venue } : null,
    `${site()}/billets/${o.access_token}`,
    !!o.user_id,
  );
  const ok = await sendMail({ to: o.email, ...mail });
  if (ok) await admin.from("orders").update({ email_sent_at: new Date().toISOString() }).eq("id", id);
  return ok;
}
