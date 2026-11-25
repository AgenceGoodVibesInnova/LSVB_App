"""Parcours complet en local : achat (paiement simulé), billets, e-mail, scan entrée/buvette, gestion.
Prérequis : bash tests/local/demarrer.sh"""
import json, os, re, urllib.request
from playwright.sync_api import sync_playwright

L = os.path.join(os.path.dirname(__file__), "..", ".local")
SHOTS = os.path.join(L, "shots"); os.makedirs(SHOTS, exist_ok=True)
PW = open(os.path.join(L, "admin_pw")).read().strip()
BASE = "http://localhost:3000"
fails = []
import subprocess
# Match de référence remis à zéro (copie locale de test uniquement)
subprocess.run(["psql", "-q", "-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-c",
  "delete from orders where event_id='J15FOU'; update events set starts_at='2026-12-11 20:00 Europe/Paris', capacity=0 where id='J15FOU'; update settings set account_required=false"], check=True)
def check(cond, label):
    print(("OK  " if cond else "ÉCHEC ") + label)
    if not cond: fails.append(label)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1280, "height": 900})
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))

    # 1. Public sans SumUp : vente fermée
    pg.goto(BASE); pg.wait_for_load_state("networkidle")
    check(pg.locator("a.home-main", has_text="Mon compte client").count() == 1 and pg.locator("a.home-admin", has_text="Espace admin").count() == 1 and pg.locator("header").count() == 0, "accueil : deux boutons, sans menu")
    pg.screenshot(path=f"{SHOTS}/0-accueil.png")
    pg.goto(BASE + "/acheter"); pg.wait_for_load_state("networkidle")
    check("ouvre très bientôt" in pg.content(), "public : vente fermée tant que SumUp n'est pas branché")
    nav = pg.inner_text("header nav").upper()
    check("ACHETER" in nav and "MES PASS" in nav and "MON PROFIL" in nav and "SCANNER" not in nav and "GESTION" not in nav, "menu public : Acheter, Mes pass, Mon profil")
    check(pg.locator(".ev").count() == 7, "7 matchs à domicile affichés")
    pg.screenshot(path=f"{SHOTS}/1-accueil.png", full_page=True)

    # 2. Connexion équipe
    pg.goto(BASE + "/scanner"); pg.wait_for_url(re.compile("/admin/connexion"))
    pg.fill("input[type=email]", "admin@test.local"); pg.fill("input[type=password]", PW); pg.click("button:has-text('Se connecter')")
    pg.wait_for_url(re.compile("/admin/scanner")); check(True, "connexion équipe")

    # 3. Achat (paiement simulé)
    pg.goto(BASE + "/acheter"); pg.wait_for_load_state("networkidle")
    rows = pg.locator(".prod")
    def plus(label): pg.locator(".prod", has_text=label).first.locator("button[aria-label^='Ajouter']").click()
    plus("Plein tarif"); plus("Plein tarif"); plus("Enfant")
    plus("Tacos + boisson offerte"); check(pg.locator(".modal").is_visible(), "fenêtre de choix de boisson")
    pg.screenshot(path=f"{SHOTS}/2-boisson.png")
    pg.click(".drink:has-text('Orangina')")
    plus("Sandwich + boisson offerte"); pg.click(".drink:has-text('Ice Tea')")
    recap = pg.inner_text(".recap")
    check("Tacos + boisson offerte (Orangina)" in recap and "37,00" in recap.replace(" ", " "), f"récapitulatif et total 37,00 € ({recap.splitlines()[-4:]})")
    pg.fill("input[autocomplete=family-name]", "Martin"); pg.fill("input[autocomplete=given-name]", "Jeanne"); pg.fill("input[autocomplete=postal-code]", "85100"); pg.fill("input[autocomplete=email]", "jeanne@test.local"); pg.fill("input[placeholder^='Ex. club']", "Club Ados")
    pg.click("button:has-text('Payer ma commande')"); pg.wait_for_url(re.compile("/paiement/"))
    pg.screenshot(path=f"{SHOTS}/3-paiement.png", full_page=True)
    pg.click("button:has-text('Simuler le paiement')"); pg.wait_for_url(re.compile("/billets/"))
    token = pg.url.rsplit("/", 1)[1]
    codes = pg.eval_on_selector_all(".tk .code", "e=>e.map(x=>x.textContent)")
    check(len(codes) == 4, f"4 QR codes (3 billets + 1 bon buvette pour toute la commande) : {codes}")
    bon = pg.inner_text(".tk:has-text('Bon buvette')")
    check("Tacos + boisson offerte (Orangina)" in bon and "Sandwich + boisson offerte (Ice Tea)" in bon, "le bon buvette liste tous les articles")
    pg.screenshot(path=f"{SHOTS}/4-billets.png", full_page=True)

    # 4. E-mail reçu (MailDev)
    req = urllib.request.Request("http://127.0.0.1:1080/email", headers={"Authorization": "Basic dGVzdDp0ZXN0"})
    try:
        mails = json.load(urllib.request.urlopen(req))
    except Exception:
        mails = json.load(urllib.request.urlopen("http://127.0.0.1:1080/email"))
    m = [x for x in mails if any(t["address"] == "jeanne@test.local" for t in x["to"])]
    check(bool(m) and token in m[-1]["html"], "e-mail « Vos billets » avec le lien privé")
    check(bool(m) and m[-1]["html"].count("cid:qr") == 4 and len(m[-1].get("attachments") or []) == 4, "les 4 QR codes sont dans l'e-mail (images intégrées)")
    check(bool(m) and "Ticket de caisse LSVB-" in m[-1]["html"] and "TVA 5,5" in m[-1]["html"], "ticket de caisse avec TVA dans l'e-mail")

    # 5. Scanner
    pg.goto(BASE + "/admin/scanner"); pg.wait_for_load_state("networkidle")
    check(pg.locator(".adm-side a", has_text="Scanner").count() == 1, "scanner dans l'espace administrateur")
    pg.select_option("select", "J15FOU")
    inp = pg.locator("input[placeholder^='K7P2']")
    def scan(c):
        with pg.expect_response(lambda r: r.url.endswith("/api/scan")):
            inp.fill(c); inp.press("Enter")
        pg.wait_for_function("!document.querySelector('.result').innerText.includes('Vérification')")
        return pg.inner_text(".result")
    r = scan(codes[0]); check("ENTRÉE VALIDÉE" in r.upper(), "entrée validée")
    pg.screenshot(path=f"{SHOTS}/5-scan-ok.png", full_page=True)
    r = scan(codes[0]); check("DÉJÀ SCANNÉ" in r.upper(), "double passage refusé")
    r = scan(codes[3]); check("BON BUVETTE" in r.upper(), "bon buvette présenté à l'entrée")
    pg.click(".mode button:has-text('Buvette')")
    r = scan("LSVB:" + codes[3]); check("COMMANDE À SERVIR" in r.upper() and "Orangina" in r and "Ice Tea" in r, f"buvette : toute la commande s'affiche ({r!r})")
    inp.fill("XXXX"); inp.press("Enter"); pg.wait_for_timeout(600); r = pg.inner_text(".result"); check("NON RECONNU" in r.upper(), "QR inconnu")
    pg.select_option("select", "J16CHA"); pg.click(".mode button:has-text('Entrée')")
    r = scan(codes[1]); check("MAUVAIS MATCH" in r.upper(), "mauvais match")
    pg.select_option("select", "J15FOU")
    pg.wait_for_timeout(500)
    r = scan(codes[1]); check("ENTRÉE VALIDÉE" in r.upper(), "2e billet validé")
    with pg.expect_response(lambda r: "/api/scan/undo" in r.url):
        pg.click("button:has-text('Annuler ce passage')")
    r = scan(codes[1]); check("ENTRÉE VALIDÉE" in r.upper(), "annulation puis re-scan")
    pg.wait_for_timeout(800)
    st = pg.inner_text(".stats"); check("2 / 3" in st and "1 / 1" in st, f"compteurs en direct ({st!r})")

    # 6. Gestion
    pg.goto(BASE + "/admin/matchs"); pg.wait_for_load_state("networkidle")
    pg.click("tr:has-text('LSVB vs Fougères') button:has-text('Modifier')")
    pg.fill("#ev-form input[type=datetime-local]", "2026-12-11T20:30")
    pg.locator("#ev-form label:has-text('Jauge') input").fill("1500")
    pg.click("#ev-form button:has-text('Enregistrer')"); pg.wait_for_timeout(1200)
    check("11/12 20:30" in pg.inner_text("main"), "modification de l'heure du match")
    pg.goto(BASE + "/admin/commandes?match=J15FOU"); pg.wait_for_load_state("networkidle")
    t = pg.inner_text("main")
    check("Jeanne MARTIN" in t and "37,00" in t.replace("\u202f", " "), "commande visible en gestion")
    pg.screenshot(path=f"{SHOTS}/6-gestion.png", full_page=True)
    with pg.expect_download() as d:
        pg.click("a:has-text('Télécharger')")
    csv = open(d.value.path(), encoding="utf-8-sig").read()
    check("\"Martin\";\"Jeanne\";\"85100\"" in csv and "Tacos + boisson offerte" in csv, "export CSV (nom, prénom, code postal)")

    # 7. Mes billets
    pg2 = b.new_page()
    pg2.goto(BASE + "/mes-billets")
    oid = codes[0].split("-")[0]
    pg2.fill("input[placeholder='K7P2QX9M']", oid); pg2.fill("input[type=email]", "JEANNE@test.local")
    pg2.click("button:has-text('Afficher mes billets')"); pg2.wait_for_url(re.compile("/billets/"))
    check(pg2.locator(".tk .used").count() == 3, "billets retrouvés, passages marqués « utilisé »")

    # 8. Mobile
    m = b.new_page(viewport={"width": 390, "height": 844}); m.goto(BASE + "/acheter"); m.wait_for_load_state("networkidle")
    over = m.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
    check(not over, "pas de débordement horizontal sur mobile")
    m.screenshot(path=f"{SHOTS}/7-mobile.png", full_page=False)
    check(not errs, f"aucune erreur JavaScript {errs}")
    b.close()

print("RESUME:", fails)
