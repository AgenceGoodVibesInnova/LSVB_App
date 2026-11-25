"""Exigences des stores et corrections de la version application (site lancé avec le faux SumUp, voir README).
Relance d'un paiement expiré sans survente, commande annulée, politique de confidentialité,
enregistrement d'un appareil, suppression du compte client."""
import json, os, re, subprocess, urllib.request, time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"; S = "http://127.0.0.1:4010"
fails = []
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
            l = [x for x in re.findall(r'href="([^"]+)"', ms[-1]["html"]) if contains in x]
            if l: return l[0].replace("&amp;", "&")
        time.sleep(0.5)
    return None
def call(url, data=None, method="POST"):
    req = urllib.request.Request(url, data=json.dumps(data or {}).encode(), headers={"content-type": "application/json"}, method=method)
    try: r = urllib.request.urlopen(req); return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"{}")

stamp = str(int(time.time()))[-6:]
CLIENT = f"app{stamp}@test.local"
sql("update settings set account_required=false, contact_email='contact@lsvb.test'")
EV = sql("select id from events where on_sale order by starts_at limit 1")
order = lambda n, email: call(BASE + "/api/orders", {"eventId": EV, "lastName": "Test", "firstName": "App", "postal": "85100", "email": email, "items": {"full": n}})

# 1. Relance d'un paiement dont la réservation a expiré, alors que le match est devenu complet
cap0 = sql(f"select capacity from events where id='{EV}'")
st, r1 = order(1, f"expire{stamp}@test.local")
check(st == 200, "commande créée")
sql(f"update orders set created_at = now() - interval '2 hours' where id='{r1['id']}'")
order(1, f"autre{stamp}@test.local")  # une autre réservation en cours : au moins une place occupée
sold = int(sql(f"select count(*) from passes p join orders o on o.id=p.order_id where o.event_id='{EV}' and p.kind='ticket' and (o.status='paid' or (o.status='pending' and o.created_at > now() - interval '30 minutes'))"))
sql(f"update events set capacity={sold} where id='{EV}'")
st, j = call(f"{BASE}/api/orders/{r1['token']}/retry")
check(st == 409 and "places" in j.get("error", ""), f"réservation expirée + match complet : relance refusée ({st})")
sql(f"update events set capacity={sold + 1} where id='{EV}'")
st, j = call(f"{BASE}/api/orders/{r1['token']}/retry")
check(st == 200 and j.get("status") == "pending", f"place libre : relance acceptée et réservation renouvelée ({st})")
check(sql(f"select created_at > now() - interval '1 minute' from orders where id='{r1['id']}'") == "t", "heure de réservation remise à zéro")
sql(f"update events set capacity={cap0} where id='{EV}'")

# 2. Commande annulée par le club : plus de relance possible
sql(f"update orders set status='cancelled' where id='{r1['id']}'")
st, j = call(f"{BASE}/api/orders/{r1['token']}/retry")
check(st == 409 and "annulée" in j.get("error", ""), "commande annulée : relance refusée")
check(sql(f"select status from orders where id='{r1['id']}'") == "cancelled", "commande annulée : reste annulée")

# 3. Appareil sans connexion refusé
st, _ = call(BASE + "/api/devices", {"token": "x" * 64, "platform": "ios"})
check(st == 401, "enregistrement d'appareil réservé aux clients connectés")
st, _ = call(BASE + "/api/me", {"confirm": "SUPPRIMER"}, method="DELETE")
check(st == 401, "suppression de compte impossible sans connexion")

with sync_playwright() as p:
    b = p.chromium.launch()
    # 4. Politique de confidentialité
    g = b.new_page(); g.goto(BASE + "/confidentialite")
    t = g.inner_text("main")
    check("Politique de confidentialité" in t and "contact@lsvb.test" in t and "supprimer votre compte" in t, "page de confidentialité avec contact du club")
    g.goto(BASE + "/"); check(g.locator("a[href='/confidentialite']").count() == 1, "lien Confidentialité sur l'accueil")

    # 5. Client : inscription, achat payé, appareil, puis suppression du compte
    c = b.new_page(viewport={"width": 390, "height": 844})
    c.goto(BASE + "/connexion"); c.click("button[role=tab]:has-text('Créer mon profil')")
    c.fill("input[autocomplete=given-name]", "Zoé"); c.fill("input[autocomplete=family-name]", "Martin"); c.fill("input[autocomplete=postal-code]", "85340")
    c.fill("input[autocomplete=email]", CLIENT); c.fill("input[autocomplete=new-password]", "MotDePasse-Zoe1")
    c.click("button:has-text('Créer mon profil') >> nth=-1"); c.wait_for_selector(".okbox")
    c.goto(last_link(CLIENT)); c.wait_for_url(re.compile("/compte"))
    uid = sql(f"select id from auth.users where email='{CLIENT}'")
    # achat rattaché au compte (session du navigateur)
    st = c.evaluate("""async (ev) => { const r = await fetch('/api/orders', {method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({eventId: ev, lastName:'Martin', firstName:'Zoé', postal:'85340', items:{full:1}})}); return [r.status, await r.json()]; }""", EV)
    tok = st[1].get("token"); cid = sql(f"select sumup_checkout_id from orders where access_token='{tok}'")
    call(f"{S}/_set/{cid}/PAID", {}); call(f"{BASE}/api/orders/{tok}/verify")
    check(sql(f"select status from orders where access_token='{tok}'") == "paid", "achat du client payé et rattaché")
    st = c.evaluate("""async () => (await fetch('/api/devices', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({token:'apns-'+'a'.repeat(60), platform:'ios'})})).status""")
    check(st == 200 and sql(f"select count(*) from devices where user_id='{uid}'") == "1", "appareil enregistré pour les notifications")
    st = c.evaluate("""async () => (await fetch('/api/devices', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({token:'court', platform:'ios'})})).status""")
    check(st == 400, "jeton d'appareil invalide refusé")

    c.goto(BASE + "/compte"); c.wait_for_load_state("networkidle")
    c.click("button:has-text('Supprimer mon compte')")
    btn = c.locator("button:has-text('Supprimer définitivement')")
    check(btn.is_disabled(), "suppression bloquée tant que SUPPRIMER n'est pas tapé")
    c.fill(".danger-box input", "supprimer"); check(btn.is_enabled(), "confirmation acceptée")
    btn.click(); c.wait_for_url(re.compile(r"/\?compte=supprime"))
    check("compte a bien été supprimé" in c.inner_text("main"), "retour à l'accueil avec confirmation")
    check(sql(f"select count(*) from auth.users where email='{CLIENT}'") == "0", "compte effacé")
    check(sql(f"select count(*) from profiles where id='{uid}'") == "0", "profil effacé")
    check(sql(f"select count(*) from devices where user_id='{uid}'") == "0", "appareils effacés")
    check(sql(f"select status || '/' || coalesce(user_id::text, 'aucun') || '/' || (receipt_no is not null) from orders where access_token='{tok}'") == "paid/aucun/true",
          "commande et ticket de caisse conservés, sans lien avec un compte")
    c.goto(BASE + "/compte"); c.wait_for_url(re.compile("/connexion")); check(True, "déconnecté après suppression")
    c.goto(f"{BASE}/billets/{tok}"); check(c.locator("svg").count() >= 1, "billet toujours valable avec le lien de l'e-mail")

    # 6. Un membre de l'équipe ne peut pas supprimer son compte lui-même
    a = b.new_page(); PW = open(os.path.join(os.path.dirname(__file__), "..", ".local", "admin_pw")).read().strip()
    ADMIN = "admin@test.local"
    a.goto(BASE + "/admin/connexion"); a.fill("input[type=email]", ADMIN); a.fill("input[type=password]", PW); a.click("button:has-text('Se connecter')")
    a.wait_for_url(re.compile(r"/admin($|/(?!connexion))")); a.goto(BASE + "/compte"); a.wait_for_load_state("networkidle")
    check(a.locator("button:has-text('Supprimer mon compte')").count() == 0, "pas de bouton de suppression pour l'équipe")
    st = a.evaluate("""async () => (await fetch('/api/me', {method:'DELETE', headers:{'content-type':'application/json'}, body: JSON.stringify({confirm:'SUPPRIMER'})})).status""")
    check(st == 409 and sql(f"select count(*) from auth.users where email='{ADMIN}'") == "1", f"compte de l'équipe protégé ({st}, {a.url})")
    b.close()

print("RESUME:", fails)
