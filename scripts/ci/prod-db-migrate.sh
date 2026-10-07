#!/usr/bin/env bash
# Migraciones Prisma contra la base de producción. Lo usan cd.yml y db-schema-sync.yml.
#
# Por qué existe: el CD restaurado el 2026-09-17 no aplicaba schema (STARTERIA_CD_RESTORATION_REPORT.md
# §9). Del 2026-09-25 al 2026-10-07 se desplegó código que leía columnas que producción no tenía y el
# portafolio respondió 500. La política queda así: `prisma migrate deploy`, nunca `db push`.
#
# Uso:  prod-db-migrate.sh status|apply|verify
#   status  lista las migraciones pendientes. No escribe.
#   apply   si hay pendientes: rechaza las destructivas, hace pg_dump en el pod, `migrate deploy`
#           y verifica. Sin pendientes no hace nada (ni backup).
#   verify  falla si queda alguna migración pendiente o fallida.
#
# Requiere KUBECONFIG y NAMESPACE, y se corre desde la raíz del repo (lee front/prisma).
# Con LOCAL_TEST_DATABASE_URL no usa kubectl ni hace backup: sólo para probar el script en local.
#
# Salidas para Actions (si existe GITHUB_OUTPUT): pending=<n>, backup=<ruta en el pod>.
set -euo pipefail

mode="${1:-}"
case "$mode" in status|apply|verify) ;; *) echo "uso: $0 status|apply|verify" >&2; exit 2 ;; esac

repo_root=$(pwd)
[ -d "$repo_root/front/prisma/migrations" ] || { echo "::error::correr desde la raíz del repo" >&2; exit 2; }
work="${RUNNER_TEMP:-$(mktemp -d)}/prod-db-migrate"
pf_pid=""

cleanup() { [ -n "$pf_pid" ] && kill "$pf_pid" 2>/dev/null || true; }
trap cleanup EXIT

output() { [ -n "${GITHUB_OUTPUT:-}" ] && echo "$1" >> "$GITHUB_OUTPUT" || true; }

connect() {
  if [ -n "${LOCAL_TEST_DATABASE_URL:-}" ]; then
    export DATABASE_URL="$LOCAL_TEST_DATABASE_URL"
    return
  fi
  : "${NAMESPACE:?NAMESPACE requerido}"
  # La clave sale del secret que lee el statefulset (el CD lo sincroniza), no de un secret de GitHub.
  local pw
  pw=$(kubectl -n "$NAMESPACE" get secret starteria-db-secrets -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)
  [ -n "$pw" ] || { echo "::error::no se pudo leer POSTGRES_PASSWORD de starteria-db-secrets"; exit 1; }
  echo "::add-mask::$pw"
  export DATABASE_URL="postgresql://starteria:$(jq -nr --arg v "$pw" '$v|@uri')@127.0.0.1:15432/starteria_db"
  kubectl -n "$NAMESPACE" port-forward statefulset/starteria-db 15432:5432 > "$work.pf.log" 2>&1 &
  pf_pid=$!
  for _ in $(seq 30); do (echo > /dev/tcp/127.0.0.1/15432) 2>/dev/null && return; sleep 1; done
  echo "::error::port-forward a la base no levantó"; cat "$work.pf.log"; exit 1
}

install_prisma() {
  # Directorio aparte: front/prisma.config.ts importa dotenv/config y no hace falta todo el árbol de front.
  rm -rf "$work"; mkdir -p "$work"
  local prisma_v dotenv_v
  prisma_v=$(node -p "const p=require('$repo_root/front/package.json'); (p.devDependencies||{}).prisma || (p.dependencies||{}).prisma")
  dotenv_v=$(node -p "const p=require('$repo_root/front/package.json'); (p.dependencies||{}).dotenv || (p.devDependencies||{}).dotenv")
  npm install --prefix "$work" --no-audit --no-fund --loglevel=error "prisma@${prisma_v}" "dotenv@${dotenv_v}" > /dev/null
  cp -r "$repo_root/front/prisma" "$work/prisma"
  cp "$repo_root/front/prisma.config.ts" "$work/prisma.config.ts"
}

prisma() { (cd "$work" && "$work/node_modules/.bin/prisma" "$@" --schema prisma/schema.prisma); }

# Deja en $pending las migraciones sin aplicar. Corta si status falla por otra cosa (config,
# conexión, migración fallida).
pending=""
read_status() {
  local out code=0
  out=$(prisma migrate status 2>&1) || code=$?
  echo "$out"
  if [ $code -eq 0 ]; then pending=""; return; fi
  if ! grep -q 'have not yet been applied' <<<"$out"; then
    echo "::error::prisma migrate status falló por algo distinto a migraciones pendientes"; exit 1
  fi
  pending=$(awk '/have not yet been applied/{f=1;next} f&&/^[0-9]{14}_/{print $1} f&&/^$/{if(n++)exit}' <<<"$out")
  [ -n "$pending" ] || { echo "::error::hay pendientes pero no se pudo leer la lista"; exit 1; }
}

# Una migración destructiva no se aplica sola en un deploy: el código viejo sigue corriendo
# durante el rollout y la vuelta atrás de imágenes no deshace schema. Esas van por
# db-schema-sync.yml, con alguien mirando.
reject_destructive() {
  local bad="" m
  for m in $pending; do
    # ALTER INDEX ... RENAME TO es sólo metadata (Prisma acorta nombres a 63 caracteres).
    if sed 's/--.*$//' "$repo_root/front/prisma/migrations/$m/migration.sql" \
      | grep -Eiv '^[[:space:]]*ALTER[[:space:]]+INDEX[^;]*RENAME[[:space:]]+TO' \
      | grep -Eiq 'DROP[[:space:]]+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT)|RENAME|ALTER[[:space:]]+COLUMN[^;]*[[:space:]]TYPE[[:space:]]|SET[[:space:]]+NOT[[:space:]]+NULL|TRUNCATE|DELETE[[:space:]]+FROM|^[[:space:]]*UPDATE[[:space:]]'; then
      bad="$bad $m"
    fi
  done
  if [ -n "$bad" ]; then
    echo "::error::migraciones no aditivas pendientes:$bad. El CD no las aplica: correr db-schema-sync.yml (apply=true) con revisión."
    exit 1
  fi
}

backup() {
  [ -n "${LOCAL_TEST_DATABASE_URL:-}" ] && { echo "(prueba local: sin backup)"; return; }
  local file size
  file="/var/lib/postgresql/data/backup-pre-migrate-$(date -u +%Y%m%dT%H%M%SZ).dump"
  kubectl exec -n "$NAMESPACE" statefulset/starteria-db -- pg_dump -U starteria -d starteria_db -Fc -f "$file"
  size=$(kubectl exec -n "$NAMESPACE" statefulset/starteria-db -- stat -c %s "$file")
  echo "backup $file ($size bytes)"
  [ "$size" -ge 10000 ] || { echo "::error::backup sospechosamente chico; no se aplica nada"; exit 1; }
  output "backup=$file"
}

install_prisma
connect
echo "--- migrate status"
read_status
count=$(wc -w <<<"$pending")
output "pending=$count"

case "$mode" in
  status) ;;
  verify)
    [ "$count" -eq 0 ] || { echo "::error::quedan $count migraciones pendientes en producción"; exit 1; } ;;
  apply)
    if [ "$count" -eq 0 ]; then echo "schema al día: nada que aplicar"; exit 0; fi
    echo "--- pendientes ($count):"; echo "$pending"
    reject_destructive
    backup
    echo "--- migrate deploy"
    prisma migrate deploy
    echo "--- verificación"
    read_status
    [ -z "$pending" ] || { echo "::error::después de deploy siguen pendientes: $pending"; exit 1; } ;;
esac
