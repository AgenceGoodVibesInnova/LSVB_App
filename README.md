# Billetterie LSVB

Billetterie en ligne des matchs des Sables Vendée Basket à l'Arena : achat de billets et de la buvette
(formules tacos ou sandwich + boisson offerte, boissons au choix), paiement SumUp, QR codes, comptes clients,
scan à l'entrée et à la buvette, espace administrateur.

- **Code** : ce dépôt GitHub
- **Application** : Next.js, hébergée sur Vercel
- **Base de données et comptes** (clients et équipe) : Supabase
- **Paiement** : SumUp (API de paiement en ligne, formulaire de carte intégré à la page)
- **E-mails** (billets, confirmation de compte, mot de passe, invitations) : SMTP de la boîte d'envoi du club, gabarit commun `lib/emails/layout.ts`

## Pages

| Adresse | Rôle |
|---|---|
| `/` | Achat : choix du match, billets, buvette (fenêtre de choix de la boisson), coordonnées (pré-remplies si connecté) |
| `/paiement/[lien]` | Paiement SumUp (carte bancaire) |
| `/billets/[lien]` | QR codes : un par billet et un par article buvette (lien privé, aussi envoyé par e-mail) |
| `/mes-billets` | Retrouver ses billets sans compte (n° de commande + e-mail), les renvoyer par e-mail |
| `/connexion` | Compte client : connexion, création de compte, mot de passe oublié |
| `/compte` | Espace client : prochains matchs et QR codes, historique, informations, mot de passe |
| `/admin/connexion` | Connexion de l'équipe (lien « Espace administrateur » en pied de page) |
| `/admin` | Tableau de bord : chiffre d'affaires, billets, buvette, remplissage des prochains matchs |
| `/admin/matchs` | Matchs, heures, jauges, prix, ouverture de la vente |
| `/admin/commandes` | Commandes par match, recherche, encaissement sur place, renvoi des billets, export Excel |
| `/admin/clients` | Fichier clients (avec ou sans compte), recherche, export Excel |
| `/admin/equipe` | Invitations par e-mail, niveaux Administrateur / Scanner, retrait d'accès |
| `/admin/reglages` | Compte client obligatoire ou non, e-mail de contact, état des branchements SumUp et e-mail |
| `/scanner` | Contrôle des QR : mode Entrée ou Buvette, caméra, photo ou douchette, compteurs en direct |

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
2. SQL Editor : exécuter `supabase/migrations/0001_init.sql`, puis `0002_comptes.sql`, puis `supabase/matchs-2026-2027.sql`
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
Dans `/admin/matchs`, vérifier les heures, prix et jauge de chaque match, et cocher « En vente ».
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
python3 tests/e2e/parcours.py      # achat (paiement simulé), e-mail, QR, scan entrée/buvette, gestion, mobile
# chemin SumUp réel contre un faux serveur SumUp :
python3 tests/local/faux-sumup.py &
#   relancer le site avec SUMUP_API_KEY=sk_test_local SUMUP_MERCHANT_CODE=MTEST SUMUP_API_BASE=http://127.0.0.1:4010
python3 tests/e2e/sumup.py         # création du paiement, vérification, notification, refus de carte, jauge, sécurité
python3 tests/e2e/comptes.py       # inscription, confirmation, compte, mot de passe oublié, compte obligatoire,
                                   # tableau de bord, clients, invitation d'un bénévole, droits d'accès
```

Chaque scénario se termine par `RESUME: []` quand tout passe.
