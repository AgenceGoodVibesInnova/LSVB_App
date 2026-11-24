import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMail } from "./mailer";
import { euros, longDate } from "./format";
import type { Line } from "./catalog";

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "";

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
    .select("id, access_token, buyer_name, email, lines, total_cents, email_sent_at, status, events(name, starts_at, venue)")
    .eq("id", id)
    .maybeSingle();
  if (!o || o.status !== "paid" || (o.email_sent_at && !force)) return false;
  const ev = (Array.isArray(o.events) ? o.events[0] : o.events) as { name: string; starts_at: string; venue: string } | null;
  const url = `${site()}/billets/${o.access_token}`;
  const lines = (o.lines as Line[]).map((l) => `${l.q} × ${l.label}`);
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const html = `<!doctype html><html><body style="margin:0;background:#F3F5F9;font-family:Arial,Helvetica,sans-serif;color:#14243B">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden">
    <tr><td style="background:#1F5190;padding:20px 24px;color:#fff">
      <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:bold">Les Sables <span style="color:#F08A12">★</span> Vendée Basket</div>
      <div style="font-size:24px;font-weight:900;margin-top:6px">Vos billets sont prêts</div>
    </td></tr>
    <tr><td style="padding:22px 24px;font-size:15px;line-height:1.5">
      Bonjour ${esc(o.buyer_name)},<br><br>
      Merci pour votre commande n° <b>${o.id}</b> pour <b>${esc(ev?.name ?? "")}</b>${ev ? `, ${esc(longDate(ev.starts_at))}` : ""}${ev?.venue ? ` — ${esc(ev.venue)}` : ""}.<br><br>
      ${lines.map(esc).join("<br>")}<br><b>Total payé : ${euros(o.total_cents)}</b><br><br>
      <a href="${url}" style="display:inline-block;background:#F08A12;color:#fff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:10px;text-transform:uppercase;letter-spacing:1px">Afficher mes QR codes</a><br><br>
      <span style="color:#5E6B80;font-size:13px">Présentez un QR code par personne à l'entrée, et vos bons buvette au comptoir. Ce lien est personnel : ne le partagez qu'avec les membres de votre groupe.</span>
    </td></tr>
  </table></td></tr></table></body></html>`;
  const text = `Bonjour ${o.buyer_name},\n\nVos billets pour ${ev?.name ?? ""} (commande ${o.id}) :\n${lines.join("\n")}\nTotal payé : ${euros(o.total_cents)}\n\nVos QR codes : ${url}\n`;
  const ok = await sendMail({ to: o.email, subject: `Vos billets — ${ev?.name ?? "LSVB"}`, html, text });
  if (ok) await admin.from("orders").update({ email_sent_at: new Date().toISOString() }).eq("id", id);
  return ok;
}
