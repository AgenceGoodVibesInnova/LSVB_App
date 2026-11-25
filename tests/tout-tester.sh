#!/usr/bin/env bash
# Lance toutes les vérifications sur une copie locale neuve (Linux) :
# types, règles de code, puis les 5 parcours de test (paiement simulé, puis faux SumUp).
set -uo pipefail
ROOT=$(pwd); L=$ROOT/tests/.local
npx tsc --noEmit && npx eslint . || exit 1
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $L/pgdata stop" >/dev/null 2>&1
pkill -f "postgrest|maildev|gateway.js|faux-sumup" ; fuser -k 3000/tcp 3001/tcp 4010/tcp 9999/tcp 54321/tcp 1080/tcp 1025/tcp >/dev/null 2>&1; sleep 2
rm -rf $L/pgdata
bash tests/local/demarrer.sh >/dev/null 2>&1 || { echo "Démarrage impossible"; exit 1; }
FAILS=0
run() { echo "== $1"; out=$(timeout 900 python3 tests/e2e/$1.py 2>&1); echo "$out" | grep -E "^ÉCHEC|RESUME|Error"; echo "$out" | grep -q "RESUME: \[\]" || FAILS=$((FAILS+1)); }
run parcours; run catalogue
fuser -k 3000/tcp >/dev/null 2>&1; sleep 2
(nohup python3 tests/local/faux-sumup.py > $L/sumup.log 2>&1 &)
(set -a; . $L/site.env; set +a; SUMUP_API_KEY=sk_test_local SUMUP_MERCHANT_CODE=MTEST SUMUP_API_BASE=http://127.0.0.1:4010 nohup npx next start -p 3000 > $L/next.log 2>&1 &)
sleep 6
run sumup; run comptes; run app
echo "Suites en échec : $FAILS"; exit $FAILS
