import { supabaseService } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Politique de confidentialité" };

/** Politique de confidentialité (lien exigé par l'App Store et Google Play). */
export default async function Confidentialite() {
  const { data: s } = await supabaseService().from("settings").select("legal_name, legal_address, contact_email").eq("id", 1).maybeSingle();
  const club = s?.legal_name || "Les Sables Vendée Basket";
  const contact = s?.contact_email || null;
  return (
    <main className="wrap legal">
      <div className="card">
        <h1 style={{ color: "var(--blue-d)", fontSize: 26 }}>Politique de confidentialité</h1>
        <p>La billetterie et l&apos;application sont éditées par <b>{club}</b>{s?.legal_address ? `, ${s.legal_address}` : ""}, responsable du traitement des données.</p>

        <h2>Données collectées</h2>
        <ul>
          <li>À l&apos;achat : nom, prénom, code postal, adresse e-mail, téléphone (facultatif), nom de groupe (facultatif), contenu de la commande.</li>
          <li>Dans le profil : adresse postale, ville, choix de recevoir ou non les actualités du club.</li>
          <li>Au contrôle : date et heure de passage de chaque QR code.</li>
          <li>Dans l&apos;application : un identifiant technique de l&apos;appareil, uniquement si vous acceptez les notifications.</li>
        </ul>
        <p>Les données de carte bancaire sont saisies chez SumUp et ne sont jamais transmises ni conservées par le club.</p>

        <h2>Utilisation</h2>
        <ul>
          <li>Établir et envoyer vos billets, bons et tickets de caisse ; contrôler les entrées ; répondre à vos demandes (exécution de la vente).</li>
          <li>Tenir la comptabilité et les déclarations de TVA du club (obligation légale).</li>
          <li>Vous prévenir quand votre commande est prête, si vous avez activé les notifications (consentement).</li>
          <li>Vous envoyer les actualités du club, seulement si vous l&apos;avez demandé (consentement, retirable à tout moment dans « Mon profil »).</li>
        </ul>
        <p>Aucune donnée n&apos;est vendue ni utilisée à des fins publicitaires. L&apos;application ne contient aucun traceur publicitaire.</p>

        <h2>Prestataires</h2>
        <p>Hébergement du site : Vercel. Base de données et comptes : Supabase (serveurs en Europe). Paiement : SumUp.
          Envoi des e-mails : le service de messagerie du club. Notifications : Apple et Google.</p>

        <h2>Durée de conservation</h2>
        <ul>
          <li>Compte client : jusqu&apos;à sa suppression, ou 3 ans sans activité.</li>
          <li>Commandes et tickets de caisse : 10 ans (obligation comptable).</li>
        </ul>

        <h2>Vos droits</h2>
        <p>Vous pouvez consulter et corriger vos informations dans « Mon profil », et <b>supprimer votre compte</b> au bas de cette même page.
          Vous disposez aussi d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, d&apos;opposition et de portabilité
          {contact ? <> en écrivant à <a href={`mailto:${contact}`}>{contact}</a></> : " en contactant le club"}.
          En cas de difficulté, vous pouvez saisir la CNIL (cnil.fr).</p>
      </div>
    </main>
  );
}
