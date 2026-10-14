#!/usr/bin/env bash
# deploy-github.sh — install the PSRI workflow API straight from GitHub.
#
# One line, run on the server, no file upload needed:
#
#   curl -fsSL https://raw.githubusercontent.com/inder20216/psri-hospital-crm/main/PSRI/Workflows/php/deploy/deploy-github.sh \
#     | sudo bash -s -- https://43.204.141.221.nip.io/psri-api
#
# Add --check first if you just want to see the current state and change nothing:
#
#   curl -fsSL <same url> | sudo bash -s -- --check
#
# Safe to re-run. config.php is never overwritten, and a timestamped backup is
# taken before anything is replaced. Override the folder with PHP_DIR=…
set -euo pipefail

REPO="https://raw.githubusercontent.com/inder20216/psri-hospital-crm/main/PSRI/Workflows/php"
BASE=""
CHECK_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --check) CHECK_ONLY=1 ;;
    http*)   BASE="$arg" ;;
  esac
done

say()  { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
ok()   { printf '   \033[1;32mok\033[0m    %s\n' "$*"; }
warn() { printf '   \033[1;33m!!\033[0m    %s\n' "$*"; }
bad()  { printf '   \033[1;31mxx\033[0m    %s\n' "$*"; }
die()  { printf '\n\033[1;31mABORTED: %s\033[0m\n' "$*" >&2; exit 1; }

command -v curl >/dev/null || die "curl is not installed"

# ── Find the live php/ folder ────────────────────────────────────────────────
find_app() {
  if [ -n "${PHP_DIR:-}" ]; then echo "$PHP_DIR"; return; fi
  for d in /opt/psri-workflow /var/www/psri-workflow /srv/psri-workflow /usr/share/psri-workflow; do
    [ -f "$d/api.php" ] && { echo "$d"; return; }
  done
  # Otherwise: look for a config.php next to an api.php, a few levels down.
  for root in /opt /var/www /srv /home; do
    [ -d "$root" ] || continue
    hit="$(find "$root" -maxdepth 4 -name api.php -type f 2>/dev/null | head -n 20 | while read -r f; do
             [ -f "$(dirname "$f")/db.php" ] && { echo "$(dirname "$f")"; break; }
           done)"
    [ -n "$hit" ] && { echo "$hit"; return; }
  done
  echo ""
}

APP="$(find_app)"
[ -n "$APP" ] || die "could not find the live php/ folder (set PHP_DIR=…)"
say "Live folder: $APP"

# ── Status only? ─────────────────────────────────────────────────────────────
if [ "$CHECK_ONLY" = "1" ]; then
  if [ -f "$APP/config.php" ]; then
    if grep -q "'teams'" "$APP/config.php" && grep -q "webhook_url" "$APP/config.php"; then
      ok "config.php present, Teams webhook set"
    else
      warn "config.php present, but no teams.webhook_url yet"
    fi
  else
    bad "no config.php"
  fi
  if grep -q "wf_teams_payload" "$APP/runner.php" 2>/dev/null; then
    ok "runner.php already has the Teams channel"
  else
    warn "runner.php is the old version — Teams support not installed"
  fi
  [ -n "$BASE" ] && for r in psri-cases?limit=1 psri-wa-threads?limit=1; do
    b="$(curl -s -m 20 "$BASE/$r" || true)"
    printf '%s' "$b" | grep -q '"Not found"' && bad "${r%%\?*} 404" || ok "${r%%\?*} responding"
  done
  exit 0
fi

# ── Back up ──────────────────────────────────────────────────────────────────
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$APP.backup-$STAMP"
say "Backup: $APP -> $BACKUP"
cp -a "$APP" "$BACKUP" || die "backup failed — stopping, nothing changed"
ok "backup kept"

# ── Pull the current code from GitHub ────────────────────────────────────────
say "Fetching code from GitHub"
FILES="api.php cases.php contacts.php db.php picklist_suggestions.php prospects.php reports.php runner.php support_ai.php support_kb.md wa.php config.example.php deploy/server-setup.sh graphs/new-case.json graphs/new-contact.json graphs/payload-case.json graphs/payload-contact.json"
FETCHED=0
for rel in $FILES; do
  mkdir -p "$APP/$(dirname "$rel")"
  if curl -fsSL "$REPO/$rel" -o "$APP/$rel.tmp"; then
    mv "$APP/$rel.tmp" "$APP/$rel"
    FETCHED=$((FETCHED + 1))
    printf '   ok    %s\n' "$rel"
  else
    rm -f "$APP/$rel.tmp"
    warn "could not fetch $rel — left the existing file in place"
  fi
done
ok "$FETCHED files installed"
[ -f "$APP/config.php" ] && ok "config.php untouched" || warn "config.php is missing — see config.example.php"

# ── Lint before running anything ─────────────────────────────────────────────
say "Linting"
if command -v php >/dev/null; then
  for f in api.php runner.php wa.php cases.php contacts.php db.php picklist_suggestions.php prospects.php reports.php support_ai.php; do
    [ -f "$APP/$f" ] || continue
    php -l "$APP/$f" >/dev/null 2>&1 || die "syntax error in $f — restore: rm -rf '$APP' && cp -a '$BACKUP' '$APP'"
    printf '   ok    %s\n' "$f"
  done
else
  warn "php not on PATH — skipping the lint"
fi

# ── Teams config reminder ────────────────────────────────────────────────────
if [ -f "$APP/config.php" ] && grep -q "'teams'" "$APP/config.php"; then
  ok "Teams webhook is configured"
else
  warn "Teams webhook NOT set. Add to config.php:"
  cat <<'EOF'

        'teams' => [
            'webhook_url' => '<the Teams / Power Automate webhook URL>',
        ],

     Until then, Send Notification -> Teams is skipped (same as an empty number).
EOF
fi

# ── Migrate ──────────────────────────────────────────────────────────────────
say "Migrating"
if [ "$(id -u)" = "0" ] && id www-data >/dev/null 2>&1; then
  sudo -u www-data php "$APP/api.php" migrate 2>&1 | sed 's/^/   /' || warn "migrate reported a problem"
else
  php "$APP/api.php" migrate 2>&1 | sed 's/^/   /' || warn "migrate reported a problem"
fi

# ── Smoke test ───────────────────────────────────────────────────────────────
if [ -n "$BASE" ]; then
  say "Smoke test against $BASE"
  for r in "psri-cases?limit=1" "psri-workflow-get?key=test" "psri-wa-threads?limit=1"; do
    b="$(curl -s -m 20 "$BASE/$r" || true)"
    printf '%s' "$b" | grep -q '"Not found"' && bad "${r%%\?*} -> 404" || ok "${r%%\?*} -> responding"
  done
fi

cat <<EOF

$(say "Installed")

Next, in the CRM:
  Settings -> Workflows -> "+ Repeated query -> Teams"
  leave "Teams webhook URL" blank (it reads config.php), Save, set Active.

Then re-save one of the repeated cases to see a card in Teams.

Rollback:  rm -rf '$APP' && cp -a '$BACKUP' '$APP'
EOF