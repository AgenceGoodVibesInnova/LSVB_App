# Billetterie LSVB

Billetterie en ligne des matchs des Sables Vendée Basket à l'Arena : achat de billets et de la buvette
(formules tacos ou sandwich + boisson offerte, boissons au choix), paiement SumUp, QR codes, scan à l'entrée
et à la buvette, espace de gestion.

- **Code** : ce dépôt GitHub
- **Application** : Next.js, hébergée sur Vercel
- **Base de données et comptes de l'équipe** : Supabase
- **Paiement** : SumUp (API de paiement en ligne, formulaire de carte intégré à la page)
- **E-mails** (envoi des billets) : SMTP de la boîte d'envoi du club

## Pages

| Adresse | Rôle |
|---|---|
| `/` | Achat : choix du match, billets, buvette (fenêtre de choix de la boisson), coordonnées |
| `/paiement/[lien]` | Paiement SumUp (carte bancaire) |
| `/billets/[lien]` | QR codes : un par billet et un par article buvette (lien privé, aussi envoyé par e-mail) |
| `/mes-billets` | Retrouver ses billets (n° de commande + e-mail), les renvoyer par e-mail |
| `/equipe/connexion` | Connexion de l'équipe (lien « Accès équipe » en pied de page) |
| `/scanner` | Contrôle des QR : mode Entrée ou Buvette, caméra, photo ou douchette, compteurs en direct |
| `/admin` | Matchs et prix, commandes par match, encaissement sur place, export Excel, renvoi des billets |

## Niveaux d'accès

- **admin** : gestion + scanner.
- **scan** : scanner uniquement (bénévoles au contrôle et à la buvette).

Les prix, la jauge et le statut de paiement sont toujours vérifiés côté serveur. Un QR code ne peut être
validé qu'une fois, même scanné au même moment sur deux téléphones. Les places sont réservées 30 minutes
pendant le paiement, puis libérées si le paiement n'aboutit pas.

## Mise en ligne, étape par étape

### 1. Supabase
1. Créer un projet sur supabase.com (région Europe).
2. SQL Editor : exécuter `supabase/migrations/0001_init.sql`, puis `supabase/matchs-2026-2027.sql`
   (les 7 matchs à domicile NM1 restants, heure 20:00 par défaut).
3. Authentication > Providers > Email : désactiver « Allow new users to sign up » (seule l'équipe a un compte).
4. Récupérer l'URL du projet, la clé « publishable » et la clé « secret » (Project Settings > API).

### 2. SumUp
1. Sur developer.sumup.com (avec le compte marchand du club), créer une clé API et noter le code marchand.
2. Vérifier auprès de SumUp que le paiement en ligne (« Online Payments ») est activé sur le compte.

Tant que `SUMUP_API_KEY` et `SUMUP_MERCHANT_CODE` sont vides, la vente au public reste fermée et l'équipe
connectée peut tester tout le parcours avec un **paiement simulé** (rien n'est débité).

### 3. Envoi des e-mails
Renseigner dans Vercel `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` et `EMAIL_FROM` (boîte d'envoi du club).
Sans ces réglages, tout fonctionne mais les billets ne sont pas envoyés par e-mail (ils restent affichés à l'écran
et retrouvables dans « Mes billets »).

### 4. Vercel
1. Importer ce dépôt GitHub (Add New > Project).
2. Renseigner les variables de `.env.example` (ne pas renseigner `SUMUP_API_BASE`, réservé aux tests locaux).
3. Déployer.

### 5. Nom de domaine
Dans Vercel > Settings > Domains, ajouter par exemple `billetterie.lsvb.fr`, puis recopier chez le registraire
les enregistrements DNS indiqués par Vercel. Mettre la même adresse dans `NEXT_PUBLIC_SITE_URL`.

### 6. Premier administrateur
1. Supabase > Authentication > Users > Add user > Create new user (e-mail + mot de passe, « Auto Confirm User » coché).
2. SQL Editor : exécuter `supabase/premier-administrateur.sql` après y avoir mis cette adresse.
3. Se connecter sur `/equipe/connexion`.

### 7. Bénévoles du scan
Pour chaque bénévole : créer son compte comme ci-dessus, puis exécuter `supabase/ajouter-benevole.sql`
avec son adresse. Il se connecte sur `/equipe/connexion` et arrive directement sur le scanner.

### 8. Ouvrir la vente
Dans `/admin`, vérifier les heures, prix et jauge de chaque match, et cocher « En vente ».

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
```

Chaque scénario se termine par `RESUME: []` quand tout passe.
