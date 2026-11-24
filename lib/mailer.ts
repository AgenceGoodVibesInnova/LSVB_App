import nodemailer from "nodemailer";

/**
 * Envoi des e-mails par SMTP (boîte d’envoi du club).
 * Renvoie false sans planter si l'envoi n'est pas configuré.
 */
export type Attachment = { filename: string; content: Buffer | string; cid?: string; contentType?: string };

export async function sendMail(opts: { to: string; subject: string; html: string; text: string; attachments?: Attachment[] }) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    console.warn("E-mail non envoyé : SMTP_HOST / SMTP_USER / SMTP_PASS manquants");
    return false;
  }
  const port = Number(process.env.SMTP_PORT ?? 465);
  const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  try {
    await transport.sendMail({
      from: process.env.EMAIL_FROM ?? `LSVB Billetterie <${user}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      attachments: opts.attachments,
    });
    return true;
  } catch (e) {
    console.error("Échec de l'envoi de l'e-mail", e);
    return false;
  }
}
