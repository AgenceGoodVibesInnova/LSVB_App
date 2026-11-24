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
| `/` | Achat : choix du match, billets, buvette, boutique (fenêtre de choix de la boisson ou de la taille), code promo, coordonnées |
| `/paiement/[lien]` | Paiement SumUp (carte bancaire) |
| `/billets/[lien]` | QR codes : un par billet et un par article buvette / boutique (lien privé ; tous les QR sont aussi dans l'e-mail) |
| `/recu/[lien]` | Ticket de caisse numéroté (LSVB-2026-000001), détail TVA, imprimable |
| `/mes-billets` | Retrouver ses billets sans compte (n° de commande + e-mail), les renvoyer par e-mail |
| `/connexion` | Compte client : connexion, création de compte, mot de passe oublié |
| `/compte` | Espace client : prochains matchs et QR codes, anciens achats et tickets de caisse, informations, mot de passe |
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
| `/scanner` | Contrôle des QR : mode Entrée, Buvette ou Boutique, caméra, photo ou douchette, compteurs en direct |

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
2. SQL Editor : exécuter dans l'ordre `supabase/migrations/0001_init.sql`, `0002_comptes.sql`, `0003_catalogue_promos_tva.sql`,
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
- Contrôle : `/scanner`, mode **Entrée**, choisir le match. Caméra du téléphone, photo du QR, ou douchette USB/Bluetooth.
- Buvette : `/scanner`, mode **Buvette** : l'écran affiche le produit et la boisson à servir.
- Vert = valide · Rouge = déjà scanné, mauvais match ou non payé · Orange = QR présenté au mauvais poste.
- Erreur de scan : bouton « Annuler ce passage ».

## Développement local

```bash
cp .env.example .env.local   # puis remplir
npm install
npm run dev
```

## Tests

```
bash tests/local/demarrer.sh       # copie locale complète : PostgreSQL 16, Supabase Auth, e-mails (MailDev), site
python3 tests/e2e/parcours.py      # achat (paiement simulé), e-mail avec QR et ticket de caisse, scan, gestion, mobile
python3 tests/e2e/catalogue.py     # produits, prix par match, codes promo, fins de vente, TVA, ticket de caisse,
                                   # boutique, bon de préparation, rapport de TVA (CSV et e-mail)
# chemin SumUp réel contre un faux serveur SumUp :
python3 tests/local/faux-sumup.py &
#   relancer le site avec SUMUP_API_KEY=sk_test_local SUMUP_MERCHANT_CODE=MTEST SUMUP_API_BASE=http://127.0.0.1:4010
python3 tests/e2e/sumup.py         # création du paiement, vérification, notification, refus de carte, jauge, sécurité
python3 tests/e2e/comptes.py       # inscription, confirmation, compte, mot de passe oublié, compte obligatoire,
                                   # tableau de bord, clients, invitation d'un bénévole, droits d'accès
```

Chaque scénario se termine par `RESUME: []` quand tout passe.
