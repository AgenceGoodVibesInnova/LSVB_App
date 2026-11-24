// Gabarit commun des e-mails de la billetterie LSVB (bleu et orange du club).
// Mise en page en tableaux et styles en ligne : seul format lu correctement par Gmail, Outlook, Apple Mail.

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

type Button = { label: string; url: string };
const C = { blue: "#1F5190", blueD: "#163B6B", orange: "#F08A12", bg: "#F3F5F9", ink: "#14243B", muted: "#5E6B80", line: "#E5E5E5" };
const FONT = "Montserrat,'Helvetica Neue',Helvetica,Arial,sans-serif";

function button(b: Button, primary: boolean) {
  const bg = primary ? C.orange : "#ffffff";
  const fg = primary ? "#ffffff" : C.blue;
  return `<a href="${esc(b.url)}" style="display:inline-block;background:${bg};color:${fg};border:2px solid ${primary ? C.orange : C.line};text-decoration:none;padding:13px 24px;border-radius:10px;font-family:${FONT};font-weight:800;font-size:14px;letter-spacing:1px;text-transform:uppercase;margin:4px">${esc(b.label)}</a>`;
}

export function renderEmail(o: {
  preheader: string;
  kicker?: string;
  title: string;
  paragraphs: string[]; // déjà échappés
  body?: string;
  primary?: Button;
  secondary?: Button;
  note?: string;
}) {
  const site = siteUrl();
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:26px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">
  <tr><td style="background:${C.blue};padding:20px 28px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td><a href="${site}"><img src="${site}/logo.png" width="72" alt="Les Sables Vendée Basket" style="display:block;width:72px;height:auto;border:0"></a></td>
      <td style="padding-left:14px;font-family:${FONT};color:#ffffff">
        <div style="font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:.5px">Billetterie</div>
        <div style="font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase">Les Sables <span style="color:${C.orange}">★</span> Vendée Basket</div>
      </td></tr></table>
  </td></tr>
  <tr><td style="padding:28px 32px 6px;font-family:${FONT};color:${C.ink}">
    ${o.kicker ? `<p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.orange};font-weight:800">${esc(o.kicker)}</p>` : ""}
    <h1 style="margin:0 0 14px;font-size:26px;line-height:1.15;font-weight:900;color:${C.blueD}">${esc(o.title)}</h1>
    ${o.paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${C.ink}">${p}</p>`).join("")}
  </td></tr>
  ${o.body ? `<tr><td style="padding:4px 32px 6px;font-family:${FONT}">${o.body}</td></tr>` : ""}
  ${o.primary || o.secondary ? `<tr><td align="center" style="padding:16px 26px 6px">${o.primary ? button(o.primary, true) : ""}${o.secondary ? button(o.secondary, false) : ""}</td></tr>` : ""}
  ${o.note ? `<tr><td align="center" style="padding:6px 32px 0;font-family:${FONT};font-size:12px;color:${C.muted}">${o.note}</td></tr>` : ""}
  <tr><td style="padding:24px 0 0"></td></tr>
  <tr><td style="background:${C.bg};padding:16px 32px;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};border-top:1px solid ${C.line}">
    Les Sables Vendée Basket · Matchs à l'Arena<br><a href="${site}" style="color:${C.blue}">${esc(site.replace(/^https?:\/\//, ""))}</a>
  </td></tr>
</table></td></tr></table></body></html>`;
  const text = [o.title, "", ...o.paragraphs.map((p) => p.replace(/<[^>]+>/g, "")), "", o.primary ? `${o.primary.label} : ${o.primary.url}` : "", `Billetterie LSVB — ${site}`].join("\n");
  return { html, text };
}

const euros = (c: number) => (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

/** Tableau récapitulatif d'une commande. */
export function orderTable(items: { label: string; q: number; unit_cents: number }[], total: number) {
  const rows = items.map((i) => `<tr>
    <td style="padding:9px 0;border-bottom:1px solid ${C.line};font-size:14px;color:${C.ink}">${i.q} × ${esc(i.label)}</td>
    <td align="right" style="padding:9px 0;border-bottom:1px solid ${C.line};font-size:14px;color:${C.ink};white-space:nowrap">${euros(i.unit_cents * i.q)}</td></tr>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};border-radius:10px;padding:6px 16px">
    ${rows}
    <tr><td style="padding:12px 0 6px;font-size:15px;font-weight:800;color:${C.blueD}">Total payé</td>
    <td align="right" style="padding:12px 0 6px;font-size:15px;font-weight:800;color:${C.blueD}">${euros(total)}</td></tr></table>`;
}
