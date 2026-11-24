"""Chemin SumUp réel contre le faux serveur (tests/local/faux-sumup.py, port 4010).
Le site doit tourner avec SUMUP_API_KEY=sk_test_local SUMUP_MERCHANT_CODE=MTEST SUMUP_API_BASE=http://127.0.0.1:4010"""
import json, re, subprocess, urllib.request
from playwright.sync_api import sync_playwright
BASE = "http://localhost:3000"; S = "http://127.0.0.1:4010"
fails = []
def check(c, l):
    print(("OK  " if c else "ÉCHEC ") + l)
    if not c: fails.append(l)
def call(url, data=None, method=None):
    req = urllib.request.Request(url, data=None if data is None else json.dumps(data).encode(), method=method or ("POST" if data is not None else "GET"), headers={"content-type": "application/json"})
    try:
        r = urllib.request.urlopen(req); return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")
sql = lambda q: subprocess.run(["psql", "-qtA", "-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-c", q], capture_output=True, text=True).stdout.strip()

# 1. Un visiteur (non connecté) peut acheter quand SumUp est branché
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.goto(BASE); pg.wait_for_load_state("networkidle")
    check("ouvre très bientôt" not in pg.content() and "Paiement simulé" not in pg.content(), "vente ouverte au public")
    pg.locator(".prod", has_text="Tarif réduit").locator("button[aria-label^='Ajouter']").click()
    pg.locator(".prod", has_text="Boisson").last.locator("button[aria-label^='Ajouter']").click(); pg.click(".drink:has-text('Pepsi')")
    pg.fill("input[autocomplete=name]", "Paul Durand"); pg.fill("input[autocomplete=email]", "paul@test.local")
    pg.click("button:has-text('Payer ma commande')"); pg.wait_for_url(re.compile("/paiement/"))
    token = pg.url.rsplit("/", 1)[1]
    check(pg.locator("#sumup-card").count() == 1 and "SumUp" in pg.content(), "page de paiement avec le formulaire SumUp")
    b.close()

oid, cid = sql(f"select id||'|'||sumup_checkout_id from orders where access_token='{token}'").split("|")
_, co = call(f"{S}/checkouts/{cid}")
check(co["amount"] == 9.5 and co["currency"] == "EUR" and co["merchant_code"] == "MTEST" and co["checkout_reference"] == oid, f"paiement SumUp créé : 9,50 € réf. {oid}")
check(co.get("return_url", "").endswith("/api/sumup/webhook"), "adresse de notification transmise à SumUp")

# 2. Pas payé → la vérification refuse
st, d = call(f"{BASE}/api/orders/{token}/verify", {})
check(d.get("status") == "pending", "non payé : commande toujours en attente")
# 3. Montant modifié chez SumUp → refusé
call(f"{S}/_set/{cid}/PAID", {}); call(f"{S}/_amount/{cid}/1", {})
st, d = call(f"{BASE}/api/orders/{token}/verify", {})
check(d.get("status") != "paid", "montant incohérent : paiement refusé")
call(f"{S}/_amount/{cid}/9.5", {})
# 4. Notification SumUp (client parti avant la fin) → commande payée
call(f"{BASE}/api/sumup/webhook", {"event_type": "CHECKOUT_STATUS_CHANGED", "id": cid})
check(sql(f"select status from orders where id='{oid}'") == "paid", "notification SumUp : commande payée")
st, d = call(f"{BASE}/api/orders/{token}/verify", {})
check(d.get("status") == "paid", "vérification : payée")

# 5. Refus de carte → nouvelle tentative
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.goto(BASE); pg.wait_for_load_state("networkidle")
    pg.locator(".prod", has_text="Plein tarif").locator("button[aria-label^='Ajouter']").click()
    pg.fill("input[autocomplete=name]", "Zoé Refus"); pg.fill("input[autocomplete=email]", "zoe@test.local")
    pg.click("button:has-text('Payer ma commande')"); pg.wait_for_url(re.compile("/paiement/")); t2 = pg.url.rsplit("/", 1)[1]
    b.close()
c2 = sql(f"select sumup_checkout_id from orders where access_token='{t2}'")
call(f"{S}/_set/{c2}/FAILED", {})
st, d = call(f"{BASE}/api/orders/{t2}/verify", {}); check(d.get("status") == "failed", "carte refusée détectée")
st, d = call(f"{BASE}/api/orders/{t2}/retry", {}); c3 = sql(f"select sumup_checkout_id from orders where access_token='{t2}'")
check(st == 200 and c3 != c2, "nouveau paiement préparé après refus")
call(f"{S}/_set/{c3}/PAID", {}); st, d = call(f"{BASE}/api/orders/{t2}/verify", {}); check(d.get("status") == "paid", "2e tentative payée")

# 6. Jauge : pas de survente
already = int(sql("select count(*) from passes p join orders o on o.id=p.order_id where o.event_id='J16CHA' and p.kind='ticket' and (o.status='paid' or (o.status='pending' and o.created_at > now() - interval '30 minutes'))"))
sql(f"update events set capacity={already + 3} where id='J16CHA'")
def order(n):
    return call(f"{BASE}/api/orders", {"eventId": "J16CHA", "name": "Groupe", "email": "g@test.local", "items": {"full": n}})
s1, d1 = order(2); s2, d2 = order(2); s3, d3 = order(1)
check(s1 == 200 and s2 == 409 and "places" in d2.get("error", "") and s3 == 200, f"jauge 3 places : 2 OK, 2 refusées, 1 OK ({s1},{s2},{s3})")
sql("update events set capacity=0 where id='J16CHA'")
# 7. Prix falsifié / produit inconnu
s, d = call(f"{BASE}/api/orders", {"eventId": "J16CHA", "name": "X", "email": "x@test.local", "items": {"bt|Whisky": 1}})
check(s == 409, "boisson hors carte refusée")
s, d = call(f"{BASE}/api/orders", {"eventId": "J16CHA", "name": "X", "email": "x@test.local", "items": {"full": 1}, "total": 1})
_, co = call(f"{S}/checkouts/" + sql(f"select sumup_checkout_id from orders where id='{d['id']}'"))
check(co["amount"] == 10.0, "prix toujours calculé par le serveur")
# 8. Scan sans connexion refusé
s, _ = call(f"{BASE}/api/scan", {"code": "AAAAAAAA-0-AAAA", "eventId": "J15FOU"})
check(s == 401, "scan réservé à l'équipe connectée")
s, _ = call(f"{BASE}/api/admin/events", {"name": "Pirate", "date": "2027-01-01T20:00"})
check(s == 403, "gestion réservée aux administrateurs")
print("RESUME:", fails)
