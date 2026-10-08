#!/bin/sh
# Replace the launch placeholders across the whole site in one go.
#
# Usage:
#   sh scripts/set-config.sh --domain www.example.co.uk --phone "020 8123 4567" --form xyzabcde [--brand "Name"]
#
# --domain  your domain, no https:// (replaces www.YOURDOMAIN.com)
# --phone   display number, UK format. The tel: link is derived from it.
# --form    the ID part of your Formspree URL, e.g. xyzabcde from https://formspree.io/f/xyzabcde
# --brand   optional: replaces the brand name "Croydon Tree Surgeon" everywhere
#
# Works on macOS and Linux. Re-running with new values is safe only if you pass the
# CURRENT values with --old-domain / --old-phone / --old-form (see README).
set -e
OLD_DOMAIN="www.YOURDOMAIN.com"; OLD_PHONE="020 7946 0142"; OLD_FORM="YOURFORMID"; OLD_BRAND="Croydon Tree Surgeon"
DOMAIN=""; PHONE=""; FORM=""; BRAND=""
while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2;;
    --phone) PHONE="$2"; shift 2;;
    --form) FORM="$2"; shift 2;;
    --brand) BRAND="$2"; shift 2;;
    --old-domain) OLD_DOMAIN="$2"; shift 2;;
    --old-phone) OLD_PHONE="$2"; shift 2;;
    --old-form) OLD_FORM="$2"; shift 2;;
    --old-brand) OLD_BRAND="$2"; shift 2;;
    *) echo "Unknown option: $1" >&2; exit 1;;
  esac
done
DIR="$(cd "$(dirname "$0")/../public" && pwd)"
PARTIALS="$(cd "$(dirname "$0")/partials" && pwd)"
CONTENT="$(cd "$(dirname "$0")/../content" && pwd)"
tel_href() { printf '+44%s' "$(printf '%s' "$1" | tr -d ' ()-' | sed 's/^0//')"; }
rep() { # file-wide literal replace using perl for portability
  OLDV="$1" NEWV="$2" find "$DIR" "$PARTIALS" "$CONTENT" -type f \( -name '*.html' -o -name '*.js' -o -name '*.xml' -o -name '*.txt' -o -name '*.json' -o -name '*.md' \) -exec perl -pi -e 'BEGIN{$o=$ENV{OLDV};$n=$ENV{NEWV}} s/\Q$o\E/$n/g' {} +
}
[ -n "$DOMAIN" ] && rep "$OLD_DOMAIN" "$DOMAIN"
if [ -n "$PHONE" ]; then
  rep "$(tel_href "$OLD_PHONE")" "$(tel_href "$PHONE")"
  rep "$OLD_PHONE" "$PHONE"
fi
[ -n "$FORM" ] && rep "$OLD_FORM" "$FORM"
[ -n "$BRAND" ] && rep "$OLD_BRAND" "$BRAND"
echo "Done. Now run: npm run build && npm run sitemap && npm run verify"
