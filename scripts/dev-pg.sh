#!/usr/bin/env bash
# Vaqtinchalik lokal PostgreSQL (bir buyruq): initdb + pg_ctl, 127.0.0.1 da trust auth (parolsiz), payroll_test_* va crm_demo bazalari.
# Ishlatish:
#   scripts/dev-pg.sh start      # bazani ko'taradi va export qatorlarini chiqaradi:  eval "$(scripts/dev-pg.sh start)"
#   scripts/dev-pg.sh all        # start + Postgres testlari + seed + server + smoke (google-chrome kerak)
#   scripts/dev-pg.sh stop       # to'xtatadi va papkani o'chiradi
# Sozlash: PGBIN (initdb/pg_ctl papkasi), PGPORT_DEV (default 5544), PGDIR (default /tmp/myhw-pg), APP_PORT (default 3999).
# root ostida ishga tushirilsa, postgres foydalanuvchisi nomidan ishlaydi (initdb root'da ishlamaydi).
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN=${PGBIN:-$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb 2>/dev/null | sort -V | tail -1)")}
PORT=${PGPORT_DEV:-5544}; DIR=${PGDIR:-/tmp/myhw-pg}; APP_PORT=${APP_PORT:-3999}; DATA=${DATA_DIR_DEV:-/tmp/myhw-data}
[ -x "$PGBIN/initdb" ] || { echo "initdb topilmadi — PGBIN=/usr/lib/postgresql/<ver>/bin bering" >&2; exit 1; }
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
PSQL="psql -h 127.0.0.1 -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
TEST_DB=payroll_test_dev
URL_TEST=postgres://postgres@127.0.0.1:$PORT/$TEST_DB
URL_APP=postgres://postgres@127.0.0.1:$PORT/crm_demo

start() {
    if ! pg_isready -q -h 127.0.0.1 -p "$PORT" 2>/dev/null; then
        if [ ! -f "$DIR/PG_VERSION" ]; then
            mkdir -p "$DIR"; [ "$(id -u)" = 0 ] && chown postgres "$DIR"
            as_pg "'$PGBIN/initdb' -D '$DIR' -U postgres -A trust >/dev/null"
        fi
        as_pg "'$PGBIN/pg_ctl' -D '$DIR' -l '$DIR/log' -w -o \"-k /tmp -p $PORT -c listen_addresses=127.0.0.1\" start >/dev/null"
    fi
    for db in $TEST_DB crm_demo; do $PSQL -tc "select 1 from pg_database where datname='$db'" | grep -q 1 || $PSQL -c "create database $db"; done
    echo "export PAYROLL_TEST_DATABASE_URL=$URL_TEST"
    echo "export DATABASE_URL=$URL_APP DATABASE_SSL=false JWT_SECRET=dev-secret-123 DATA_DIR=$DATA PORT=$APP_PORT ALLOWED_ORIGINS=http://localhost:$APP_PORT"
}
stop() { as_pg "'$PGBIN/pg_ctl' -D '$DIR' -m fast stop" || true; rm -rf "$DIR"; }

all() {
    eval "$(start)"
    PAYROLL_TEST_DATABASE_URL=$URL_TEST node --test scripts/finance-postgres.test.cjs scripts/finance-integrity-postgres.test.cjs
    $PSQL -c "drop database if exists crm_demo" -c "create database crm_demo"; rm -rf "$DATA"; mkdir -p "$DATA"
    node server/index.js > "$DATA/server.log" 2>&1 & SRV=$!; trap 'kill $SRV 2>/dev/null' EXIT
    for _ in $(seq 60); do curl -fs "http://localhost:$APP_PORT/login.html" >/dev/null && break; sleep 1; done
    node server/reset-admin.js adminpass >/dev/null   # jadvallarni server yaratadi, shuning uchun undan keyin
    node scripts/seed-moliya-demo.js
    BASE_URL=http://localhost:$APP_PORT ADMIN_PASSWORD=adminpass TSV="$DATA/jadval-namuna.tsv" OUT=${OUT:-/tmp/moliya-smoke} node scripts/moliya-smoke.cjs
}
case "${1:-start}" in start) start ;; stop) stop ;; all) all ;; *) echo "start|stop|all" >&2; exit 2 ;; esac
