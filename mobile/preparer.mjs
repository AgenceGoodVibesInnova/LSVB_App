// Prépare les fichiers embarqués dans l'application avant « cap sync » :
// la page hors connexion reçoit l'adresse du site (APP_URL) pour le bouton « Réessayer ».
import { readFileSync, writeFileSync } from "node:fs";

const url = process.env.APP_URL ?? "https://app.lsvb.fr";
if (!/^https:\/\/[^/]+/.test(url)) {
  console.error(`APP_URL doit commencer par https:// (reçu : ${url})`);
  process.exit(1);
}
const dir = new URL(".", import.meta.url);
const html = readFileSync(new URL("hors-ligne.modele.html", dir), "utf8").replace("__APP_URL__", url.replace(/"/g, ""));
writeFileSync(new URL("www/hors-ligne.html", dir), html);
console.log(`Application configurée pour ${url}`);
