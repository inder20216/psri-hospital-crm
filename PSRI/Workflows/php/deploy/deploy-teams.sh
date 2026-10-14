#!/usr/bin/env bash
# deploy-teams.sh — install the PSRI workflow API update (WhatsApp + Teams)
# on the server, from a deploy bundle, in one step.
#
# Run as root (or with sudo):
#   sudo bash deploy-teams.sh /root/psri-php-YYYYMMDD-HHMM.zip
#
# Safe to re-run. It never deletes config.php and it takes a timestamped
# backup before touching anything.
#
# What it does:
#   1. finds the live php/ folder (override with PHP_DIR=…)
#   2. backs it up to php.backup-<timestamp>/
#   3. unpacks the bundle over it, keeping config.php
#   4. checks config.php has the Teams webhook (tells you if not — see below)
#   5. runs the migration as www-data
#   6. smoke-tests the routes that were previously 404ing
#
# Optional env:
#   PHP_DIR   live folder, default /opt/psri-workflow
#   BASE_URL  public base, default https://43.204.141.221.nip.io/psri-api
set -euo pipefail

BUNDLE="${1:-}"
APP="${PHP_DIR:-/opt/psri-workflow}"
BASE="${BASE_URL:-https://43.204.141.221.nip.io/psri-api}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$APP.backup-$STAMP"

say()  { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31mxx %s\033[0m\n' "$*" >&2; exit 1; }

[ -n "$BUNDLE" ] || die "usage: sudo bash deploy-teams.sh <path-to-bundle.zip>"
[ -f "$BUNDLE" ] || die "bundle not found: $BUNDLE"
[ -d "$APP" ]    || die "live folder not found: $APP (set PHP_DIR=…)"
command -v unzip >/dev/null || die "unzip is not installed (apt-get install -y unzip)"

# ── 1. back up ───────────────────────────────────────────────────────────────
say "Backing up $APP -> $BACKUP"
cp -a "$APP" "$BACKUP"
echo "backup kept at $BACKUP"

# ── 2. unpack, never clobbering config.php ───────────────────────────────────
say "Unpacking $BUNDLE"
KEEP_CONFIG=""
if [ -f "$APP/config.php" ]; then
  KEEP_CONFIG="$(mktemp)"
  cp "$APP/config.php" "$KEEP_CONFIG"
  echo "config.php preserved"
fi
unzip -oq "$BUNDLE" -d "$APP"
[ -n "$KEEP_CONFIG" ] && cp "$KEEP_CONFIG" "$APP/config.php" && rm -f "$KEEP_CONFIG"
echo "files now in $APP: $(find "$APP" -maxdepth 1 -name '*.php' | wc -l) php files"

# ── 3. syntax check before anything runs ─────────────────────────────────────
say "Linting the deployed code"
if command -v php >/dev/null; then
  for f in "$APP"/api.php "$APP"/runner.php "$APP"/wa.php "$APP"/cases.php; do
    [ -f "$f" ] || continue
    php -l "$f" >/dev/null || die "syntax error in $f — restore from $BACKUP"
    echo "  ok $(basename "$f")"
  done
else
  warn "php not on PATH — skipping the lint"
fi

# ── 4. Teams webhook check ───────────────────────────────────────────────────
say "Checking config.php"
if [ ! -f "$APP/config.php" ]; then
  warn "no config.php — copy config.example.php and fill in the DB + WhatsApp values"
elif grep -q "webhook_url" "$APP/config.php" && grep -q "'teams'" "$APP/config.php"; then
  echo "  teams.webhook_url is present"
else
  warn "the Teams webhook is NOT set yet."
  cat <<'EOF'

     Add this to config.php (do not commit it):

         'teams' => [
             'webhook_url' => '<the Teams / Power Automate webhook URL>',
         ],

     Until then, Send Notification -> Teams is skipped like an empty WhatsApp number.
     Workflow runs are fine either way.
EOF
fi

# ── 5. migrate ───────────────────────────────────────────────────────────────
say "Running the migration"
MIGRATE_USER="${MIGRATE_USER:-www-data}"
if [ "$(id -u)" = "0" ] && id "$MIGRATE_USER" >/dev/null 2>&1; then
  sudo -u "$MIGRATE_USER" php "$APP/api.php" migrate || warn "migrate reported a problem — read the output above"
else
  php "$APP/api.php" migrate || warn "migrate reported a problem — read the output above"
fi

# ── 6. smoke test ────────────────────────────────────────────────────────────
say "Smoke test against $BASE"
for route in psri-cases?limit=1 psri-workflow-get?key=test psri-wa-threads?limit=1; do
  body="$(curl -s -m 20 "$BASE/$route" || true)"
  if printf '%s' "$body" | grep -q '"Not found"'; then
    printf '  %-34s 404 (not deployed)\n' "${route%%\?*}"
  else
    printf '  %-34s ok\n' "${route%%\?*}"
  fi
done

cat <<EOF

$(say "Done")

Next:
  * Settings -> Workflows -> "+ Repeated query -> Teams", leave the URL blank
    (it reads config), save, and set it Active.
  * Re-save one of the repeated cases to see a card arrive in Teams.

If anything 404s, restore with:
  sudo rm -rf $APP && sudo cp -a $BACKUP $APP

Errors:  sudo tail -50 /var/log/nginx/error.log
EOF