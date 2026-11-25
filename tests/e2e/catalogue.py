"""Catalogue, codes promo, fins de vente, TVA, ticket de caisse, boutique (site en paiement simulé, équipe connectée)."""
import json, os, re, subprocess, urllib.request, time
from datetime import date, timedelta
from playwright.sync_api import sync_playwright

L = os.path.join(os.path.dirname(__file__), "..", ".local"); SHOTS = os.path.join(L, "shots")
PW = open(os.path.join(L, "admin_pw")).read().strip()
BASE = "http://localhost:3000"
fails = []
U = lambda s: s.upper()
N = lambda s: s.replace(" ", " ").replace("\xa0", " ")
def check(c, l):
    print(("OK  " if c else "ÉCHEC ") + l)
    if not c: fails.append(l)
sql = lambda q: subprocess.run(["psql", "-qtA", "-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-c", q], capture_output=True, text=True).stdout.strip()
sql("delete from promo_codes; delete from products where id in ('coca-cola'); update events set prices='{}', sales_end_at=null, shop_end_at=null; update settings set account_required=false")
today = date.today(); d = lambda n: (today + timedelta(days=n)).isoformat()

with sync_playwright() as p:
    b = p.chromium.launch()
    a = b.new_page(viewport={"width": 1280, "height": 1000})
    a.goto(BASE + "/admin/connexion"); a.fill("input[type=email]", "admin@test.local"); a.fill("input[type=password]", PW); a.click("button:has-text('Se connecter')"); a.wait_for_url(BASE + "/admin")

    # 1. Nouveau produit : une boisson
    a.goto(BASE + "/admin/produits")
    a.locator(".card", has_text="Boissons").locator("button:has-text('+ Ajouter')").click()
    a.fill("#prod-form input[placeholder^='Ex. Coca']", "Coca-Cola"); a.fill("#prod-form input[placeholder='🥤']", "🥤")
    a.fill("#prod-form label:has-text('Prix TTC') input", "3")
    a.click("#prod-form button:has-text('Enregistrer')"); a.wait_for_timeout(1200)
    check(sql("select price_cents||'|'||vat_rate from products where id='coca-cola'") == "300|10.00", "nouvelle boisson : Coca-Cola 3 € TVA 10 %")
    a.screenshot(path=f"{SHOTS}/13-produits.png", full_page=True)

    # 2. Prix spécial et produit masqué pour un match
    a.goto(BASE + "/admin/matchs"); a.click("tr:has-text('LSVB vs Rennes') button:has-text('Modifier')")
    a.fill("input[aria-label='Prix spécial Plein tarif']", "12")
    a.locator(".offer-row", has_text="Sachet de bonbons").locator("input[type=checkbox]").uncheck()
    a.click("#ev-form button:has-text('Enregistrer')"); a.wait_for_timeout(1200)
    check(sql("select prices::text from events where id='J18REN'") in ('{"full": 1200, "bonbons": null}', '{"bonbons": null, "full": 1200}'), "match Rennes : plein tarif 12 €, bonbons masqués")

    # 3. Codes promo
    a.goto(BASE + "/admin/promos")
    def promo(code, label, value, kind="percent", scope="billets", event="", fr="", to="", maxu=""):
        a.fill("input[placeholder='TALMONT2026']", code); a.fill("input[placeholder='Club de Talmont']", label)
        a.select_option("label:has-text('Type de remise') select", kind); a.fill("label:has-text('Remise') input", str(value))
        a.select_option("label:has-text(\"S'applique\") select", scope); a.select_option("label:has-text('Match') select", event)
        a.fill("label:has-text('Valable du') input", fr); a.fill("label:has-text('au (inclus)') input", to); a.fill("label:has-text('Utilisations max') input", maxu)
        a.click("form button:has-text('Enregistrer')"); a.wait_for_timeout(900)
    promo("TALMONT2026", "Club de Talmont", 10, event="J15FOU", fr=d(-1), to=d(7))
    promo("10-2026", "Promo du mois", 2, kind="amount", scope="tout", fr=d(-30), to=d(-2))
    promo("UNEFOIS", "Test 1 utilisation", 50, maxu="1")
    promo("INVIT", "Invitations partenaires", 100)
    t = a.inner_text("tbody")
    check(all(c in t for c in ["TALMONT2026", "10-2026", "UNEFOIS", "INVIT"]) and "EXPIRÉ" in U(t), "4 codes créés, 10-2026 marqué expiré")
    a.screenshot(path=f"{SHOTS}/14-promos.png", full_page=True)

    # 4. Achat : 2 billets + t-shirt M avec TALMONT2026 (−10 % sur les billets)
    a.goto(BASE + "/acheter"); a.wait_for_load_state("networkidle")
    check(a.locator(".prod .nm b", has_text=re.compile(r"^Coca-Cola$")).count() == 1, "la nouvelle boisson est en vente")
    plus = lambda name: a.locator(".prod", has_text=name).first.locator("button[aria-label^='Ajouter']").click()
    plus("Plein tarif"); plus("Plein tarif")
    plus("T-shirt LSVB"); check("TAILLE" in U(a.inner_text(".modal")), "fenêtre de choix de la taille")
    a.click(".drink:has-text('M')")
    plus("Tacos + boisson offerte"); check(a.locator(".drink", has_text="Coca-Cola").count() == 1, "Coca-Cola proposé comme boisson offerte")
    a.click(".drink:has-text('Coca-Cola')")
    a.fill("input[aria-label='Code promo']", "10-2026"); a.click("button:has-text('Appliquer')"); a.wait_for_selector(".recap .err")
    check("expiré" in a.inner_text(".recap .err"), "code expiré refusé")
    a.fill("input[aria-label='Code promo']", "talmont2026"); a.click("button:has-text('Appliquer')"); a.wait_for_selector(".promo-line")
    r = N(a.inner_text(".recap"))
    check("−2,00 €" in r and "46,00 €" in r, f"TALMONT2026 : −2,00 € sur les billets, total 46,00 € ({r.splitlines()[-4:]})")
    a.screenshot(path=f"{SHOTS}/15-promo-panier.png", full_page=True)
    a.fill("input[autocomplete=family-name]", "Talmont"); a.fill("input[autocomplete=given-name]", "Club"); a.fill("input[autocomplete=postal-code]", "85440"); a.fill("input[autocomplete=email]", "talmont@test.local")
    a.click("button:has-text('Payer ma commande')"); a.wait_for_url(re.compile("/paiement/"))
    check("TALMONT2026" in a.inner_text("main"), "remise rappelée sur la page de paiement")
    a.click("button:has-text('Simuler le paiement')"); a.wait_for_url(re.compile("/billets/")); tok = a.url.rsplit("/", 1)[1]
    oid = sql(f"select id from orders where access_token='{tok}'")
    vat = json.loads(sql(f"select vat::text from orders where id='{oid}'"))
    check(vat == [{"rate": 5.5, "ht_cents": 1706, "vat_cents": 94, "ttc_cents": 1800}, {"rate": 10, "ht_cents": 727, "vat_cents": 73, "ttc_cents": 800}, {"rate": 20, "ht_cents": 1667, "vat_cents": 333, "ttc_cents": 2000}], f"TVA par taux enregistrée ({vat})")
    check(re.fullmatch(r"LSVB-\d{4}-\d{6}", sql(f"select receipt_no from orders where id='{oid}'") or "") is not None, "n° de ticket de caisse attribué")
    check("BON BOUTIQUE" in U(a.inner_text(".tickets")), "QR « Bon boutique » pour le t-shirt")
    a.click("a:has-text('Ticket de caisse')"); a.wait_for_url(re.compile("/recu/"))
    t = N(a.inner_text("main"))
    check("TALMONT2026" in t and "5,5 %" in t and "17,06 €" in t and "3,33 €" in t, "ticket de caisse : remise et TVA par taux")
    a.screenshot(path=f"{SHOTS}/16-ticket-de-caisse.png", full_page=True)

    # 5. Code à 1 utilisation, code d'un autre match, invitation à 100 %
    def api_order(eventId, items, promo):
        return a.request.post(BASE + "/api/orders", data={"eventId": eventId, "lastName": "X", "firstName": "Y", "postal": "85000", "email": "x@test.local", "items": items, "promo": promo})
    r1 = api_order("J16CHA", {"full": 1}, "TALMONT2026"); check(r1.status == 400 and "pas valable pour ce match" in r1.json()["error"], "code réservé à un autre match refusé")
    r1 = api_order("J16CHA", {"full": 1}, "UNEFOIS"); r2 = api_order("J16CHA", {"full": 1}, "UNEFOIS")
    check(r1.ok and r2.status == 400 and "maximum" in r2.json()["error"], "code à 1 utilisation : 2e utilisation refusée")
    r = api_order("J16CHA", {"child": 2}, "INVIT"); dd = r.json()
    check(r.ok and dd.get("paid") and sql(f"select status||'|'||pay_method||'|'||total_cents from orders where id='{dd['id']}'") == "paid|gratuit|0", "invitation à 100 % : validée sans paiement")
    r = api_order("J16CHA", {"bonbons": 1}, "TALMONT2026"); check(r.status == 400, "code billets sans billet dans le panier refusé")

    # 6. Fins de vente
    sql("update events set shop_end_at = now() - interval '1 hour' where id='J16CHA'")
    a.goto(BASE + "/acheter"); a.click(".ev:has-text('Challans')")
    check("COMMANDES BUVETTE SONT CLOSES" in U(a.inner_text("main")) and a.locator(".prod", has_text="Tacos").count() == 0, "buvette close : section fermée")
    r = api_order("J16CHA", {"t": 1}, ""); check(r.status == 409 and "closes" in r.json()["error"], "buvette close : commande refusée")
    r = api_order("J16CHA", {"full": 1}, ""); check(r.ok, "billets toujours en vente")
    sql("update events set sales_end_at = now() - interval '1 hour' where id='J16CHA'")
    a.goto(BASE + "/acheter"); check(a.locator(".ev", has_text="Challans").count() == 0, "vente terminée : match retiré de la vente")
    r = api_order("J16CHA", {"full": 1}, ""); check(r.status == 409, "vente terminée : commande refusée")
    sql("update events set sales_end_at=null, shop_end_at=null where id='J16CHA'")
    a.goto(BASE + "/acheter"); a.click(".ev:has-text('Rennes')")
    check("12,00" in N(a.inner_text(".prod:has-text('Plein tarif')")) and a.locator(".prod", has_text="bonbons").count() == 0, "match Rennes : prix spécial affiché, bonbons absents")

    # 7. Scanner : boutique
    codes = sql(f"select order_id||'-'||idx||'-'||token||'|'||kind from passes where order_id='{oid}' order by idx").splitlines()
    shop = [c.split("|")[0] for c in codes if c.endswith("|shop")][0]
    a.goto(BASE + "/admin/scanner"); a.select_option("select", "J15FOU"); a.click(".mode button:has-text('Boutique')")
    inp = a.locator("input[placeholder^='K7P2']")
    with a.expect_response(lambda r: r.url.endswith("/api/scan")):
        inp.fill(shop); inp.press("Enter")
    a.wait_for_timeout(300); r = U(a.inner_text(".result"))
    check("COMMANDE À REMETTRE" in r and "TAILLE M" in r, f"boutique : t-shirt taille M à remettre ({r!r})")

    # 8. Bon de préparation, rapport de TVA
    a.goto(BASE + "/admin/commandes?match=J15FOU"); t = a.inner_text(".prep")
    check("Coca-Cola" in t and "T-shirt LSVB (Taille M)" in t, "bon de préparation (menus, boissons, boutique)")
    sql(f"update orders set is_demo=false where id='{oid}'")  # paiement simulé exclu du rapport : on le compte comme un vrai paiement ici
    a.goto(BASE + "/admin/rapports?match=J15FOU"); t = N(a.inner_text("main"))
    check("TVA COLLECTÉE" in U(t) and "5,5 %" in t and "20 %" in t, "rapport de TVA du match")
    a.screenshot(path=f"{SHOTS}/17-rapport-tva.png", full_page=True)
    with a.expect_download() as dl: a.click("a:has-text('Télécharger')")
    csv = open(dl.value.path(), encoding="utf-8-sig").read()
    check("TVA par taux" in csv and '"5,5";"17,06";"0,94";"18,00"' in csv, "rapport CSV : TVA 5,5 % sur la commande remisée")
    a.click("button:has-text('Envoyer par e-mail')"); a.wait_for_selector("text=Rapport envoyé")
    rq = urllib.request.Request("http://127.0.0.1:1080/email", headers={"Authorization": "Basic dGVzdDp0ZXN0"})
    ms = [m for m in json.load(urllib.request.urlopen(rq)) if "Rapport de TVA" in m["subject"]]
    check(bool(ms) and any(x["fileName"].endswith(".csv") for x in ms[-1].get("attachments") or []), "rapport envoyé par e-mail avec le fichier")
    # 9. Réglages : mentions du ticket de caisse
    a.goto(BASE + "/admin/reglages"); a.fill("label:has-text('SIRET') input", "12345678900012"); a.click("button:has-text('Enregistrer')"); a.wait_for_selector("text=Réglages enregistrés")
    a.goto(BASE + f"/recu/{tok}"); check("SIRET 12345678900012" in a.inner_text("main"), "SIRET sur le ticket de caisse")
    b.close()
print("RESUME:", fails)
