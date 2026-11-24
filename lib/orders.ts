import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMail } from "./mailer";
import QRCode from "qrcode";
import { passCode } from "./format";
import { ticketsEmail } from "./emails/templates";
import { loadReceipt } from "./receipt";

import { siteUrl as site } from "./emails/layout";

/** Marque la commande payée (une seule fois) et envoie les billets par e-mail. */
export async function markPaid(admin: SupabaseClient, id: string, method?: "sumup" | "demo" | "manuel" | "gratuit") {
  const { data } = await admin
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString(), ...(method ? { pay_method: method } : {}) })
    .eq("id", id)
    .neq("status", "paid")
    .select("id")
    .maybeSingle();
  if (data) {
    await admin.rpc("assign_receipt", { p_order: id }); // n° de ticket de caisse, continu par année
    await sendTickets(admin, id);
  }
}

/** E-mail « vos billets » : tous les QR codes intégrés + ticket de caisse. Renvoie true si envoyé. */
export async function sendTickets(admin: SupabaseClient, id: string, force = false) {
  const r = await loadReceipt(admin, { id });
  if (!r || r.status !== "paid") return false;
  if (!force) {
    const { data } = await admin.from("orders").select("email_sent_at").eq("id", id).single();
    if (data?.email_sent_at) return false;
  }
  const attachments = await Promise.all(r.passes.map(async (p) => ({
    filename: `qr-${p.idx + 1}.png`,
    content: await QRCode.toBuffer(`LSVB:${passCode(r.id, p.idx, p.token)}`, { type: "png", width: 340, margin: 1, errorCorrectionLevel: "M" }),
    cid: `qr${p.idx}@lsvb`,
    contentType: "image/png",
  })));
  const mail = ticketsEmail(r, `${site()}/billets/${r.access_token}`, `${site()}/recu/${r.access_token}`);
  const ok = await sendMail({ to: r.email, ...mail, attachments });
  if (ok) await admin.from("orders").update({ email_sent_at: new Date().toISOString() }).eq("id", id);
  return ok;
}
