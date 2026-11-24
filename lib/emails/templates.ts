import { esc, orderTable, renderEmail, siteUrl } from "./layout";
import type { Line } from "../catalog";

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
      primary: { label: "Réserver mes places", url: site },
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

export function ticketsEmail(o: { id: string; buyer_name: string; total_cents: number; lines: Line[]; is_demo?: boolean }, ev: { name: string; when: string; venue: string } | null, url: string, hasAccount: boolean) {
  const site = siteUrl();
  return {
    subject: `${o.is_demo ? "[Essai] " : ""}Vos billets — ${ev?.name ?? "LSVB"}`,
    ...renderEmail({
      preheader: `Commande ${o.id} confirmée : vos QR codes sont prêts.`,
      kicker: `Commande ${o.id}`,
      title: "Vos billets sont prêts",
      paragraphs: [
        `Bonjour ${esc(o.buyer_name)}, merci pour votre commande${ev ? ` pour <strong>${esc(ev.name)}</strong>, ${esc(ev.when)}${ev.venue ? ` — ${esc(ev.venue)}` : ""}` : ""}.`,
        o.is_demo ? "Commande d'essai : le paiement a été simulé, rien n'a été débité." : "Votre paiement est bien reçu.",
        "Présentez un QR code par personne à l'entrée, et vos bons à la buvette. Ce lien est personnel : ne le partagez qu'avec les membres de votre groupe.",
      ],
      body: orderTable(o.lines, o.total_cents),
      primary: { label: "Afficher mes QR codes", url },
      secondary: hasAccount ? { label: "Mon compte", url: `${site}/compte` } : undefined,
    }),
  };
}
