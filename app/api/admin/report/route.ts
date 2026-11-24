import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { requestStaff } from "@/lib/auth";
import { buildReport, reportCsv } from "@/lib/report";
import { sendMail } from "@/lib/mailer";
import { renderEmail, esc } from "@/lib/emails/layout";
import { euros } from "@/lib/format";

const fileName = (id: string) => `rapport-tva-${id === "all" ? "saison" : id}.csv`;

/** Téléchargement du rapport de TVA (CSV Excel). */
export async function GET(req: Request) {
  if (!(await requestStaff("admin"))) return new Response("Réservé aux administrateurs.", { status: 403 });
  const event = new URL(req.url).searchParams.get("event") ?? "all";
  const csv = reportCsv(await buildReport(supabaseService(), event));
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${fileName(event)}"` } });
}

/** Envoi du rapport par e-mail (adresse des réglages, sinon celle de l'administrateur connecté). */
export async function POST(req: Request) {
  const me = await requestStaff("admin");
  if (!me) return NextResponse.json({ error: "Réservé aux administrateurs." }, { status: 403 });
  const { event = "all" } = (await req.json().catch(() => ({}))) as { event?: string };
  const admin = supabaseService();
  const r = await buildReport(admin, event);
  const { data: s } = await admin.from("settings").select("report_email").eq("id", 1).maybeSingle();
  const to = s?.report_email || me.email;
  const rates = r.byRate.map((v) => `TVA ${String(v.rate).replace(".", ",")} % : base HT ${euros(v.ht_cents)}, TVA ${euros(v.vat_cents)}`).map(esc);
  const mail = renderEmail({
    preheader: `TVA collectée : ${euros(r.vat)} pour ${euros(r.ttc)} TTC.`,
    kicker: "Rapport de TVA", title: r.title,
    paragraphs: [`${r.orders} commandes payées · ${euros(r.ttc)} TTC · ${euros(r.ht)} HT · <strong>TVA collectée ${euros(r.vat)}</strong>`, ...rates, "Le détail par produit, par mode de règlement et par code promo est dans le fichier joint (à ouvrir avec Excel)."],
  });
  const ok = await sendMail({ to, subject: `Rapport de TVA — ${r.title}`, ...mail, attachments: [{ filename: fileName(event), content: reportCsv(r), contentType: "text/csv; charset=utf-8" }] });
  return ok ? NextResponse.json({ message: `Rapport envoyé à ${to}.` }) : NextResponse.json({ error: "L'e-mail n'a pas pu partir (réglages SMTP)." }, { status: 502 });
}
