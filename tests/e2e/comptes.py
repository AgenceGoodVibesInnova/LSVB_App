"""Comptes clients et espace administrateur (site lancé avec le faux SumUp, voir README).
Inscription + confirmation par e-mail, achat rattaché au compte, « Mon compte », mot de passe oublié,
compte obligatoire, tableau de bord, clients, invitation d'un bénévole, droits d'accès."""
import json, os, re, subprocess, urllib.request, time
from playwright.sync_api import sync_playwright

L = os.path.join(os.path.dirname(__file__), "..", ".local"); SHOTS = os.path.join(L, "shots")
PW = open(os.path.join(L, "admin_pw")).read().strip()
BASE = "http://localhost:3000"; S = "http://127.0.0.1:4010"
fails = []
U = lambda s: s.upper()
def check(c, l):
    print(("OK  " if c else "ÉCHEC ") + l)
    if not c: fails.append(l)
sql = lambda q: subprocess.run(["psql", "-qtA", "-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-c", q], capture_output=True, text=True).stdout.strip()
def mails(to):
    r = urllib.request.Request("http://127.0.0.1:1080/email", headers={"Authorization": "Basic dGVzdDp0ZXN0"})
    return [m for m in json.load(urllib.request.urlopen(r)) if any(t["address"] == to for t in m["to"])]
def last_link(to, contains="/auth/confirm"):
    for _ in range(20):
        ms = mails(to)
        if ms:
            links = re.findall(r'href="([^"]+)"', ms[-1]["html"])
            l = [x for x in links if contains in x]
            if l: return l[0].replace("&amp;", "&"), ms[-1]
        time.sleep(0.5)
    return None, None
def post(url, data):
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers={"content-type": "application/json"}, method="POST")
    try: r = urllib.request.urlopen(req); return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"{}")

stamp = str(int(time.time()))[-6:]
CLIENT = f"lea{stamp}@test.local"; BENEVOLE = f"benevole{stamp}@test.local"
sql("update settings set account_required=false")

with sync_playwright() as p:
    b = p.chromium.launch()
    # 0. Commande sans compte avec l'e-mail de Léa (avant son inscription)
    g = b.new_page(); g.goto(BASE + "/acheter"); g.wait_for_load_state("networkidle")
    g.locator(".prod", has_text="Plein tarif").locator("button[aria-label^='Ajouter']").click()
    g.fill("input[autocomplete=family-name]", "Invitée"); g.fill("input[autocomplete=given-name]", "Léa"); g.fill("input[autocomplete=postal-code]", "85100"); g.fill("input[autocomplete=email]", CLIENT)
    g.click("button:has-text('Payer ma commande')"); g.wait_for_url(re.compile("/paiement/")); guest_token = g.url.rsplit("/", 1)[1]
    cid = sql(f"select sumup_checkout_id from orders where access_token='{guest_token}'")
    post(f"{S}/_set/{cid}/PAID", {}); post(f"{BASE}/api/orders/{guest_token}/verify", {})

    # 1. Inscription
    c = b.new_page(viewport={"width": 1280, "height": 900})
    c.goto(BASE + "/connexion"); c.click("button[role=tab]:has-text('Créer mon profil')")
    c.fill("input[autocomplete=given-name]", "Léa"); c.fill("input[autocomplete=family-name]", "Bernard"); c.fill("input[autocomplete=tel]", "0611223344"); c.fill("input[autocomplete=postal-code]", "85340")
    c.fill("input[autocomplete=email]", CLIENT); c.fill("input[autocomplete=new-password]", "MotDePasse-Lea1")
    c.click("button:has-text('Créer mon profil') >> nth=-1"); c.wait_for_selector(".okbox")
    check("Profil créé" in c.inner_text(".okbox"), "inscription : e-mail de confirmation annoncé")
    link, m = last_link(CLIENT)
    check(bool(link) and "Confirmez" in m["subject"], "e-mail de confirmation reçu")
    c.goto(link); c.wait_for_url(re.compile("/compte"))
    t = U(c.inner_text("main"))
    check("BONJOUR LÉA" in t, "compte activé, arrivée dans « Mon compte »")
    check("LSVB VS FOUGÈRES" in t and "MES PASS" in t and "LSVB-" in t, "commande passée sans compte retrouvée (prochains matchs et factures)")
    time.sleep(1); check(any("prêt" in x["subject"] for x in mails(CLIENT)), "e-mail de bienvenue")
    check("MON PROFIL" in U(c.inner_text("nav")) and "MES PASS" in U(c.inner_text("nav")), "menu : Mes pass, Mon profil")

    # 2. Achat connecté : coordonnées pré-remplies, commande rattachée
    c.goto(BASE + "/acheter"); c.wait_for_load_state("networkidle")
    check(c.input_value("input[autocomplete=family-name]") == "Bernard" and c.input_value("input[autocomplete=given-name]") == "Léa" and c.input_value("input[autocomplete=postal-code]") == "85340" and c.is_disabled("input[autocomplete=email]"), "coordonnées pré-remplies (nom, prénom, code postal)")
    c.locator(".ev", has_text="Challans").click()
    c.locator(".prod", has_text="Enfant").locator("button[aria-label^='Ajouter']").click()
    c.click("button:has-text('Payer ma commande')"); c.wait_for_url(re.compile("/paiement/")); tok = c.url.rsplit("/", 1)[1]
    uid = sql(f"select id from auth.users where email='{CLIENT}'")
    check(sql(f"select user_id from orders where access_token='{tok}'") == uid, "commande rattachée au compte")
    c.goto(BASE + "/compte"); check("PAYER" in U(c.inner_text("main")), "commande en attente : bouton « Payer »")
    post(f"{S}/_set/" + sql(f"select sumup_checkout_id from orders where access_token='{tok}'") + "/PAID", {}); post(f"{BASE}/api/orders/{tok}/verify", {})
    c.goto(BASE + "/compte"); t = U(c.inner_text("main"))
    check("LSVB VS CHALLANS" in t and t.count("MES PASS") >= 2 and t.count("LSVB-20") == 2, "deux réservations à venir et deux factures")
    c.goto(BASE + "/pass"); pt = U(c.inner_text("main"))
    check("PLACES" in pt and "BUVETTE" in pt and "BOUTIQUE" in pt and c.locator(".pass").count() == 2 and c.locator(".used-pass").count() == 0, "Mes pass : 2 places actives (onglet Places)")
    c.screenshot(path=f"{SHOTS}/8b-mes-pass.png", full_page=True)
    c.screenshot(path=f"{SHOTS}/8-compte.png", full_page=True)

    # 3. Profil
    c.goto(BASE + "/compte")
    c.fill("form:has-text('Mes informations') input[autocomplete=tel]", "0699887766"); c.fill("input[autocomplete=street-address]", "12 rue des Sables"); c.fill("input[autocomplete=address-level2]", "Les Sables-d'Olonne")
    c.click("button:has-text('Enregistrer')"); c.wait_for_selector("text=Enregistré")
    check(sql(f"select phone||'|'||address||'|'||city from profiles where id='{uid}'") == "0699887766|12 rue des Sables|Les Sables-d'Olonne", "profil : téléphone, adresse, ville")
    # 4. Accès interdit à la gestion pour un client
    c.goto(BASE + "/admin"); c.wait_for_url(re.compile("/admin/connexion|/admin/scanner"))
    check("/admin/connexion" in c.url, "client : pas d'accès à l'espace administrateur")
    r = c.request.post(BASE + "/api/scan", data={"code": "X", "eventId": "J15FOU"}); check(r.status == 401, "client : pas d'accès au scan")
    # 5. Déconnexion, mot de passe oublié
    c.goto(BASE + "/compte"); c.click("button:has-text('Déconnexion')"); c.wait_for_url(BASE + "/")
    c.goto(BASE + "/connexion"); c.fill("input[autocomplete=email]", CLIENT); c.click("button:has-text('Mot de passe oublié')"); c.wait_for_selector(".okbox")
    link, _ = last_link(CLIENT, "type=recovery")
    c.goto(link); c.wait_for_url(re.compile("/mot-de-passe"))
    c.fill("input[type=password] >> nth=0", "NouveauMdp-Lea2"); c.fill("input[type=password] >> nth=1", "NouveauMdp-Lea2")
    c.click("button:has-text('Enregistrer et continuer')"); c.wait_for_url(re.compile("/compte"))
    check(True, "mot de passe oublié → nouveau mot de passe → compte")

    # 6. Administrateur
    a = b.new_page(viewport={"width": 1280, "height": 900})
    a.goto(BASE + "/admin"); a.fill("input[type=email]", "admin@test.local"); a.fill("input[type=password]", PW); a.click("button:has-text('Se connecter')")
    a.wait_for_url(BASE + "/admin"); t = U(a.inner_text("main"))
    check("TABLEAU DE BORD" in t and "PROCHAINS MATCHS" in t and "LSVB VS CHALLANS" in t, "tableau de bord")
    a.screenshot(path=f"{SHOTS}/9-tableau-de-bord.png", full_page=True)
    a.goto(BASE + "/admin/clients"); t = U(a.inner_text("main"))
    check("LÉA BERNARD" in t and "COMPTE" in t, "fichier clients")
    a.goto(BASE + "/admin/clients?q=bernard"); check("Léa Bernard" in a.inner_text("tbody"), "recherche client")
    a.screenshot(path=f"{SHOTS}/10-clients.png", full_page=True)
    a.goto(BASE + "/admin/commandes?match=J16CHA&q=lea"); check("Léa Bernard" in a.inner_text("tbody"), "recherche de commande")
    # Réglage : compte obligatoire
    a.goto(BASE + "/admin/reglages"); a.check("input[type=checkbox]"); a.click("button:has-text('Enregistrer')"); a.wait_for_selector("text=Réglages enregistrés")
    anon = b.new_page(); anon.goto(BASE + "/acheter"); anon.wait_for_load_state("networkidle")
    check(anon.locator("a:has-text('Se connecter pour acheter')").count() == 1, "compte obligatoire : bouton « Se connecter pour acheter »")
    s_, d_ = post(f"{BASE}/api/orders", {"eventId": "J16CHA", "lastName": "X", "firstName": "Y", "postal": "85000", "email": "x@test.local", "items": {"full": 1}})
    check(s_ == 401, "compte obligatoire : commande refusée sans connexion")
    a.goto(BASE + "/admin/reglages"); a.uncheck("input[type=checkbox]"); a.click("button:has-text('Enregistrer')"); a.wait_for_selector("text=Réglages enregistrés")
    # Équipe : invitation d'un bénévole
    a.goto(BASE + "/admin/equipe"); a.fill("form:has-text('Inviter') input[type=email]", BENEVOLE); a.select_option("form:has-text('Inviter') select", "scan")
    a.click("button:has-text(\"Envoyer l'invitation\")"); a.wait_for_selector(".okbox")
    check("Invitation envoyée" in a.inner_text(".okbox"), "invitation envoyée")
    a.screenshot(path=f"{SHOTS}/11-equipe.png", full_page=True)
    link, m = last_link(BENEVOLE)
    v = b.new_page(); v.goto(link); v.wait_for_url(re.compile("/mot-de-passe"))
    v.fill("input[type=password] >> nth=0", "Benevole-Scan-1"); v.fill("input[type=password] >> nth=1", "Benevole-Scan-1")
    v.click("button:has-text('Enregistrer et continuer')"); v.wait_for_url(re.compile(r"3000/admin/scanner"))
    check("MATCH CONTRÔLÉ" in U(v.inner_text("main")), "bénévole : mot de passe choisi, arrivée sur le scanner")
    v.goto(BASE + "/admin/commandes"); v.wait_for_url(re.compile("/admin/scanner")); check("/admin/scanner" in v.url, "bénévole : pas d'accès à la gestion")
    side = U(v.inner_text(".adm-side"))
    check("SCANNER" in side and "COMMANDES" not in side and "RÉGLAGES" not in side, "bénévole : menu Scanner seulement")
    # Retrait de l'accès
    a.goto(BASE + "/admin/equipe"); a.click(f"button[aria-label='Retirer {BENEVOLE}']"); a.click("button:has-text('Retirer')"); a.wait_for_timeout(800)
    check(sql(f"select count(*) from staff where email='{BENEVOLE}'") == "0", "accès retiré")
    r = v.request.get(BASE + "/api/scan/stats?event=J15FOU"); check(r.status == 401, "bénévole retiré : scan refusé")
    # Mobile : espace admin
    mob = b.new_page(viewport={"width": 390, "height": 844}, storage_state=a.context.storage_state())
    mob.goto(BASE + "/admin"); over = mob.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
    check(not over, "espace admin sans débordement sur mobile")
    mob.screenshot(path=f"{SHOTS}/12-admin-mobile.png")
    b.close()
print("RESUME:", fails)
