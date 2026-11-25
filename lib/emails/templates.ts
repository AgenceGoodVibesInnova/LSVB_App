import { esc, renderEmail, siteUrl } from "./layout";
import { longDate, passCode } from "../format";
import { PAY_LABEL, pct, type ReceiptData } from "../receipt";

export function confirmSignupEmail(firstName: string | null, url: string) {
  return {
    subject: "Confirmez votre compte · Billetterie LSVB",
    ...renderEmail({
      preheader: "Un clic pour activer votre compte billetterie.",
      kicker: "Bienvenue",
      title: `Bienvenue${firstName ? " " + firstName : ""} !`,
      paragraphs: [
        "Merci d'avoir créé votre compte sur la billetterie des Sables Vendée Basket. Il ne reste qu'une étape : confirmer votre adresse e-mail.",
        "Ensuite, vous retrouverez tous vos billets et bons buvette dans votre espace, match après match.",
      ],
      primary: { label: "Activer mon compte", url },
      note: "Vous n'êtes pas à l'origine de cette inscription ? Ignorez simplement cet e-mail.",
    }),
  };
}

export function welcomeEmail(firstName: string | null) {
  const site = siteUrl();
  return {
    subject: `Votre compte billetterie est prêt${firstName ? ", " + firstName : ""} !`,
    ...renderEmail({
      preheader: "Réservez vos places pour le prochain match à l'Arena.",
      kicker: "Compte activé",
      title: "On se voit à l'Arena !",
      paragraphs: ["Votre compte est prêt. Réservez vos places et votre buvette en quelques clics, et retrouvez vos QR codes à tout moment dans votre espace."],
      primary: { label: "Réserver mes places", url: `${site}/acheter` },
      secondary: { label: "Mon compte", url: `${site}/compte` },
    }),
  };
}

export function resetEmail(url: string) {
  return {
    subject: "Nouveau mot de passe · Billetterie LSVB",
    ...renderEmail({
      preheader: "Choisissez un nouveau mot de passe en un clic.",
      kicker: "Mot de passe",
      title: "Nouveau mot de passe",
      paragraphs: ["Vous avez demandé à changer votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau."],
      primary: { label: "Choisir un mot de passe", url },
      note: "Vous n'avez rien demandé ? Ignorez cet e-mail : votre mot de passe actuel reste valable.",
    }),
  };
}

export function inviteEmail(url: string, role: string) {
  return {
    subject: "Vous rejoignez l'équipe billetterie LSVB",
    ...renderEmail({
      preheader: "Choisissez votre mot de passe pour accéder à l'espace équipe.",
      kicker: "Espace équipe",
      title: "Bienvenue dans l'équipe",
      paragraphs: [
        `Vous avez accès à la billetterie des Sables Vendée Basket avec le niveau <strong>${esc(role)}</strong>.`,
        "Choisissez votre mot de passe pour vous connecter. Les jours de match, ouvrez le scanner depuis votre téléphone.",
      ],
      primary: { label: "Choisir mon mot de passe", url },
      note: "Ce lien est personnel et ne fonctionne qu'une seule fois.",
    }),
  };
}

const eur = (c: number) => (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const KIND: Record<string, string> = { ticket: "Billet d'entrée", food: "Bon buvette", shop: "Bon boutique" };

/** QR codes intégrés au mail (images jointes « cid: ») : rien à télécharger, tout est dans l'e-mail. */
function qrGrid(r: ReceiptData, eventName: string) {
  const count: Record<string, number> = {};
  const total: Record<string, number> = {};
  r.passes.forEach((p) => { total[p.kind] = (total[p.kind] ?? 0) + 1; });
  const cells = r.passes.map((p) => {
    count[p.kind] = (count[p.kind] ?? 0) + 1;
    const color = p.kind === "ticket" ? "#1F5190" : "#F08A12";
    return `<td width="50%" valign="top" style="padding:6px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #E5E5E5;border-radius:12px;overflow:hidden">
        <tr><td style="background:${color};color:#fff;padding:8px 12px;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">${KIND[p.kind]} · ${count[p.kind]}/${total[p.kind]}</td></tr>
        <tr><td align="center" style="padding:10px 8px 4px"><img src="cid:qr${p.idx}@lsvb" width="170" height="170" alt="QR code ${esc(passCode(r.id, p.idx, p.token))}" style="display:block;width:170px;height:170px"></td></tr>
        <tr><td align="center" style="padding:0 8px 10px;font-family:Arial,sans-serif">
          <div style="font-size:14px;font-weight:bold;color:#163B6B">${esc(p.label)}</div>
          ${p.items?.length ? `<div style="font-size:12px;color:#14243B;text-align:left;background:#FFF1E0;border-radius:8px;padding:6px 10px;margin:6px 0">${p.items.map((i) => `<b>${i.q}×</b> ${esc(i.label)}`).join("<br>")}</div>` : ""}
          <div style="font-size:11px;color:#5E6B80;font-family:monospace">${esc(passCode(r.id, p.idx, p.token))}</div>
          <div style="font-size:11px;color:#5E6B80">${esc(eventName)}</div>
        </td></tr>
      </table></td>`;
  });
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(`<tr>${cells[i]}${cells[i + 1] ?? '<td width="50%"></td>'}</tr>`);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>`;
}

/** Ticket de caisse : détail, remise, TVA par taux, mentions du club. */
export function receiptBlock(r: ReceiptData) {
  const td = "padding:6px 0;border-bottom:1px solid #E5E5E5;font-size:13px;color:#14243B;font-family:Arial,sans-serif";
  const lines = r.lines.map((l) => `<tr><td style="${td}">${l.q} × ${esc(l.label)}<br><span style="color:#5E6B80;font-size:11px">${eur(l.unit_cents)} TTC · TVA ${pct(l.vat_rate ?? 0)}</span></td><td align="right" style="${td};white-space:nowrap">${eur(l.q * l.unit_cents)}</td></tr>`).join("");
  const vat = r.vat.map((v) => `<tr><td style="padding:3px 0;font-size:12px;color:#5E6B80;font-family:Arial,sans-serif">TVA ${pct(v.rate)} · base HT ${eur(v.ht_cents)}</td><td align="right" style="padding:3px 0;font-size:12px;color:#5E6B80;font-family:Arial,sans-serif">${eur(v.vat_cents)}</td></tr>`).join("");
  const l = r.legal;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F5F9;border-radius:10px;padding:14px 16px">
    <tr><td colspan="2" style="font-family:Arial,sans-serif;padding-bottom:8px"><div style="font-size:15px;font-weight:bold;color:#163B6B">Ticket de caisse ${esc(r.receipt_no ?? "")}</div>
      <div style="font-size:12px;color:#5E6B80">${esc(l.legal_name ?? "")}${l.legal_address ? ` · ${esc(l.legal_address)}` : ""}${l.siret ? ` · SIRET ${esc(l.siret)}` : ""}${l.vat_number ? ` · TVA ${esc(l.vat_number)}` : ""}</div>
      <div style="font-size:12px;color:#5E6B80">${r.paid_at ? new Date(r.paid_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) : ""} · commande ${esc(r.id)} · ${esc(PAY_LABEL[r.pay_method] ?? r.pay_method)}</div></td></tr>
    ${lines}
    ${r.discount_cents ? `<tr><td style="${td};color:#1E9E5A">Code promo ${esc(r.promo_code ?? "")}</td><td align="right" style="${td};color:#1E9E5A">−${eur(r.discount_cents)}</td></tr>` : ""}
    <tr><td style="padding:10px 0 6px;font-size:15px;font-weight:bold;color:#163B6B;font-family:Arial,sans-serif">Total TTC</td><td align="right" style="padding:10px 0 6px;font-size:15px;font-weight:bold;color:#163B6B;font-family:Arial,sans-serif">${eur(r.total_cents)}</td></tr>
    ${vat}
  </table>`;
}

export function ticketsEmail(r: ReceiptData, url: string, receiptUrl: string) {
  const site = siteUrl();
  const ev = r.event;
  const when = ev ? longDate(ev.starts_at) : "";
  return {
    subject: `${r.is_demo ? "[Essai] " : ""}Vos billets — ${ev?.name ?? "LSVB"}`,
    ...renderEmail({
      preheader: `Commande ${r.id} confirmée : vos ${r.passes.length} QR codes sont dans cet e-mail.`,
      kicker: `Commande ${r.id}`,
      title: "Vos billets sont prêts",
      paragraphs: [
        `Bonjour ${esc(r.buyer_name)}, merci pour votre commande${ev ? ` pour <strong>${esc(ev.name)}</strong>, ${esc(when)}${ev.venue ? ` — ${esc(ev.venue)}` : ""}` : ""}.`,
        r.is_demo ? "Commande d'essai : le paiement a été simulé, rien n'a été débité." : "Vos QR codes sont ci-dessous : <strong>rien à télécharger</strong>, montrez simplement cet e-mail sur votre téléphone. Un QR par personne à l'entrée ; un seul QR pour toute votre commande buvette, et un pour la boutique.",
      ],
      body: `${qrGrid(r, ev?.name ?? "")}<div style="height:18px"></div>${receiptBlock(r)}`,
      primary: { label: "Ouvrir mes billets en ligne", url },
      secondary: r.user_id ? { label: "Mon compte", url: `${site}/compte` } : { label: "Ticket de caisse", url: receiptUrl },
      note: "Ce lien et ces QR codes sont personnels : ne les partagez qu'avec les membres de votre groupe.",
    }),
  };
}
