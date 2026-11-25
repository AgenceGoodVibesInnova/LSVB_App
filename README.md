# Billetterie LSVB

Billetterie en ligne des matchs des Sables Vendée Basket à l'Arena : billets, buvette (menus avec boisson offerte,
snacks, boissons, confiserie) et boutique du club (t-shirt avec tailles), codes promo, paiement SumUp, QR codes et
ticket de caisse par e-mail, comptes clients, scan à l'entrée / à la buvette / à la boutique, rapport de TVA par match.

- **Code** : ce dépôt GitHub
- **Application** : Next.js, hébergée sur Vercel
- **Base de données et comptes** (clients et équipe) : Supabase
- **Paiement** : SumUp (API de paiement en ligne, formulaire de carte intégré à la page)
- **E-mails** (billets, confirmation de compte, mot de passe, invitations) : SMTP de la boîte d'envoi du club, gabarit commun `lib/emails/layout.ts`

## Pages

| Adresse | Rôle |
|---|---|
| `/` | Accueil de l'application : deux boutons, « Mon compte client » et « Espace admin » |
| `/acheter` | Achat : choix du match, billets, buvette, boutique (choix de la boisson ou de la taille), code promo, coordonnées (nom, prénom, code postal) |
| `/pass` | Mes pass : tous les QR codes du client, onglets Places / Buvette / Boutique ; en couleur si actifs, grisés une fois scannés |
| `/paiement/[lien]` | Paiement SumUp (carte bancaire) |
| `/billets/[lien]` | QR codes d'une commande : un par billet, un seul pour toute la buvette, un seul pour la boutique (lien privé ; aussi dans l'e-mail) |
| `/recu/[lien]` | Ticket de caisse numéroté (LSVB-2026-000001), détail TVA, imprimable |
| `/mes-billets` | Retrouver ses billets sans compte (n° de commande + e-mail), les renvoyer par e-mail |
| `/connexion` | Connexion, création du profil client, mot de passe oublié |
| `/compte` | Mon profil : nom, prénom, adresse, code postal, ville, téléphone ; prochains matchs ; historique des factures |
| `/admin/connexion` | Connexion de l'équipe (lien « Espace administrateur » en pied de page) |
| `/admin` | Tableau de bord : chiffre d'affaires, billets, buvette, remplissage des prochains matchs |
| `/admin/matchs` | Matchs, heures, jauges, fins de vente (billets / buvette-boutique), produits proposés et prix spéciaux par match |
| `/admin/produits` | Catalogue : billets, menus, snacks, boissons, confiserie, boutique ; prix TTC, taux de TVA, choix (boisson offerte, tailles) |
| `/admin/promos` | Codes promo illimités : % ou €, billets ou toute la commande, un match ou tous, dates de validité, nombre d'utilisations |
| `/admin/commandes` | Commandes par match, bon de préparation (menus, boissons, boutique), recherche, encaissement sur place, export Excel |
| `/admin/rapports` | Rapport de TVA par match ou pour la saison : TVA par taux, détail par produit, règlements, codes promo ; CSV, impression, envoi par e-mail |
| `/admin/clients` | Fichier clients (avec ou sans compte), recherche, export Excel |
| `/admin/equipe` | Invitations par e-mail, niveaux Administrateur / Scanner, retrait d'accès |
| `/admin/reglages` | Compte client obligatoire ou non, mentions du ticket de caisse (SIRET, TVA), e-mail des rapports |
| `/confidentialite` | Politique de confidentialité (exigée par l'App Store et Google Play) |
| `/admin/scanner` | Contrôle des QR : mode Entrée, Buvette ou Boutique (toute la commande s'affiche), caméra, photo ou douchette, compteurs en direct. Seule page ouverte aux bénévoles (niveau Scanner) |

## Applications iOS et Android (App Store, Google Play)

Les applications (dossiers `ios/` et `android/`, outil Capacitor) ouvrent la billetterie en ligne dans une
vue native : une seule version du site à maintenir, toute modification publiée sur Vercel est visible
immédiatement dans les applications, sans repasser par les stores. Elles ajoutent :

- les **notifications** : « Pensez à activer vos notifications » sur l'inscription et « Mon profil » ; si elles ont
  été refusées, le bouton **ouvre directement la page Notifications des réglages du téléphone** ;
- la **caméra** pour le scanner de l'espace admin ;
- l'icône et l'écran de démarrage aux couleurs du club, une page « Pas de connexion internet ».

Exigences des stores déjà en place : **suppression du compte** depuis « Mon profil » (obligatoire chez Apple),
**politique de confidentialité** sur `/confidentialite`, aucune publicité ni traceur. Le paiement par SumUp est
autorisé dans l'application : billets, buvette et t-shirts sont des biens et services utilisés hors de l'application.

### Construire les applications
Identifiant : `fr.lsvb.billetterie` · Nom : « LSVB Billetterie ». L'adresse du site est lue dans `APP_URL`
(par défaut `https://billetterie.lsvb.fr`) : la mettre à jour une fois le domaine choisi.

```bash
npm install
APP_URL=https://billetterie.lsvb.fr npm run app:android   # ouvre Android Studio
APP_URL=https://billetterie.lsvb.fr npm run app:ios       # ouvre Xcode (Mac obligatoire)
npm run app:icones                                         # régénère icônes et écran de démarrage depuis assets/
```

À chaque envoi sur GitHub, l'onglet **Actions** vérifie le site et construit une version de test Android (fichier
APK téléchargeable, installable sur un téléphone Android) et iOS (simulateur).

### Publier
1. **Comptes** : Apple Developer Program (99 €/an, au nom du club : numéro D-U-N-S de l'association requis)
   et Google Play Console (25 $ une fois, compte « organisation »).
2. **Android** : dans Android Studio, *Build › Generate Signed App Bundle* (créer la clé de signature et la conserver
   précieusement), puis envoyer le fichier `.aab` dans la Play Console.
3. **iOS** : dans Xcode, choisir l'équipe Apple du club (*Signing & Capabilities*), ajouter la capacité
   *Push Notifications*, puis *Product › Archive › Distribute App* vers App Store Connect.
4. **Fiches** : captures d'écran, description, adresse de la politique de confidentialité
   (`https://…/confidentialite`), questionnaire sur les données (e-mail, nom, adresse, téléphone, achats :
   utilisés pour le service, non partagés, non utilisés pour le suivi).
5. **Compte de démonstration pour Apple et Google** : créer un compte client de test et le fournir dans la fiche
   (les vérificateurs doivent pouvoir se connecter).

### Notifications « commande prête »
Les applications savent déjà demander l'autorisation et ouvrir les réglages. Pour envoyer réellement les
notifications : créer un projet Firebase, y ajouter l'application Android (`google-services.json` dans
`android/app/`) et la clé APNs d'Apple, puis mettre `NEXT_PUBLIC_PUSH_READY=1` dans Vercel : les téléphones
s'enregistrent alors dans la table `devices`. Le bouton d'envoi « commande prête » côté admin reste à construire.

## Ventes, TVA et codes promo

- **Catalogue** : chaque produit a un prix TTC et un taux de TVA. Taux proposés par défaut (à valider avec
  l'expert-comptable) : billetterie d'une manifestation sportive 5,5 % ; menus, snacks et boissons sans alcool
  vendus à emporter 10 % ; confiserie et boutique 20 %.
- **Fins de vente** : par match, les billets se vendent jusqu'au début du match (ou la date choisie) ; la buvette
  et la boutique s'arrêtent par défaut **3 jours avant** pour laisser le temps de commander la marchandise.
- **Codes promo** : saisis par le client avant le paiement. Le montant de la remise est réparti sur les lignes
  concernées pour que la TVA reste juste. Un code à 100 % valide la commande sans paiement (invitations).
- **Ticket de caisse** : numérotation continue par année, attribuée au paiement ; envoyé dans l'e-mail avec tous
  les QR codes (images intégrées, rien à télécharger) et disponible dans « Mon compte ».
- **Rapport de TVA** : commandes payées uniquement, commandes d'essai (paiement simulé) exclues.

## Comptes

- **Clients** : le compte est facultatif par défaut (achat possible sans compte, billets envoyés par e-mail).
  Dans `/admin/reglages`, on peut le rendre obligatoire. Une commande passée sans compte apparaît
  automatiquement dans le compte créé ensuite avec la même adresse e-mail.
- **Administrateur** : tout l'espace administrateur, plus le scanner.
- **Scanner** : le scanner uniquement (bénévoles au contrôle et à la buvette).
- Un membre de l'équipe connecté peut vendre au guichet pour quelqu'un d'autre : les billets partent à l'e-mail saisi.

## Mise en ligne, étape par étape

### 1. Supabase
1. Créer un projet sur supabase.com (région Europe).
2. SQL Editor : exécuter dans l'ordre `supabase/migrations/0001_init.sql`, `0002_comptes.sql`, `0003_catalogue_promos_tva.sql`, `0004_pass_profil.sql`, `0005_relance_suppression_app.sql`,
   puis `supabase/matchs-2026-2027.sql`
   (les 7 matchs à domicile NM1 restants, heure 20:00 par défaut).
3. Authentication > URL Configuration : *Site URL* = l'adresse du site (ex. `https://billetterie.lsvb.fr`),
   et l'ajouter avec `/**` aux *Redirect URLs* (ainsi que l'adresse Vercel).
4. Récupérer l'URL du projet, la clé « publishable » et la clé « secret » (Project Settings > API).

Les e-mails de compte (confirmation, mot de passe oublié, invitation) sont envoyés par le site lui-même,
aux couleurs du club : rien à modifier dans les modèles d'e-mails de Supabase.

### 2. SumUp
1. Sur developer.sumup.com (avec le compte marchand du club), créer une clé API et noter le code marchand.
2. Vérifier auprès de SumUp que le paiement en ligne (« Online Payments ») est activé sur le compte.

Tant que `SUMUP_API_KEY` et `SUMUP_MERCHANT_CODE` sont vides, la vente au public reste fermée et l'équipe
connectée peut tester tout le parcours avec un **paiement simulé** (rien n'est débité).

### 3. Envoi des e-mails (indispensable pour les comptes)
Renseigner dans Vercel `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` et `EMAIL_FROM` (boîte d'envoi du club).
Sans ces réglages, les clients ne peuvent pas confirmer leur compte et les billets ne partent pas par e-mail
(ils restent affichés à l'écran et retrouvables dans « Mes billets »).

### 4. Vercel
1. Importer ce dépôt GitHub (Add New > Project).
2. Renseigner les variables de `.env.example` (ne pas renseigner `SUMUP_API_BASE`, réservé aux tests locaux).
3. Déployer.

### 5. Nom de domaine
Dans Vercel > Settings > Domains, ajouter par exemple `billetterie.lsvb.fr`, puis recopier chez le registraire
les enregistrements DNS indiqués par Vercel. Mettre la même adresse dans `NEXT_PUBLIC_SITE_URL`.

### 6. Premier administrateur
1. Sur le site, créer un compte (page `/connexion`) avec votre adresse et le confirmer par e-mail.
2. Supabase > SQL Editor : exécuter `supabase/premier-administrateur.sql` après y avoir mis cette adresse.
3. Se connecter sur `/admin/connexion`.

### 7. Équipe et bénévoles
Dans `/admin/equipe`, inviter chaque personne par e-mail avec le niveau **Scanner** (bénévoles) ou
**Administrateur**. Elle reçoit un lien pour choisir son mot de passe, puis arrive sur le scanner ou la gestion.

### 8. Ouvrir la vente
Dans `/admin/reglages`, renseigner les mentions du ticket de caisse (nom, adresse, SIRET, n° de TVA).
Dans `/admin/produits`, vérifier prix et taux de TVA. Dans `/admin/matchs`, vérifier heures, jauges et fins de vente,
et cocher « En vente ».
Dans `/admin/reglages`, choisir si le compte client est obligatoire.

## Le jour du match
- Contrôle : `/admin/scanner`, mode **Entrée**, choisir le match. Caméra du téléphone, photo du QR, ou douchette USB/Bluetooth.
- Buvette et boutique : `/admin/scanner`, mode **Buvette** ou **Boutique** : l'écran affiche toute la commande à servir ou à remettre.
- Vert = valide · Rouge = déjà scanné, mauvais match ou non payé · Orange = QR présenté au mauvais poste.
- Erreur de scan : bouton « Annuler ce passage ».

## Développement local

```bash
cp .env.example .env.local   # puis remplir
npm install
npm run dev
```

## Tests

```bash
bash tests/tout-tester.sh   # tout, sur une copie locale neuve (Linux) : types, règles de code, 5 parcours
```

La copie locale (`tests/local/demarrer.sh`) réunit PostgreSQL 16, Supabase Auth, un capteur d'e-mails (MailDev)
et un faux serveur SumUp. Les parcours :

- `parcours.py` : achat (paiement simulé), e-mail avec QR et ticket de caisse, scan, gestion, affichage mobile ;
- `catalogue.py` : produits, prix par match, codes promo, fins de vente, TVA, boutique, bon de préparation, rapport de TVA ;
- `sumup.py` : paiement SumUp, vérification, notification, carte refusée, jauge, sécurité ;
- `comptes.py` : inscription, confirmation, profil, mot de passe oublié, tableau de bord, clients, bénévoles, droits ;
- `app.py` : relance d'un paiement expiré sans survente, commande annulée, confidentialité, appareils, suppression du compte.

Chaque parcours se termine par `RESUME: []` quand tout passe.
