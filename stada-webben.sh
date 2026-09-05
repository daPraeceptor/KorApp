#!/usr/bin/env bash
#
# Tar bort gamla JavaScript-bundlar på korapp.huleteknik.se.
#
# Varje bygge får ett nytt filnamn med innehållets summa i sig, och
# uppladdningen lägger bara till — den städar inte. Efter ett åttiotal
# deployer låg lika många bundlar kvar på servern, ett fyrtiotal megabyte,
# och bara en av dem används.
#
# Den som index.html pekar på sparas. Alla andra tas bort. Ett bygge måste
# därför finnas i dist/, annars vet skriptet inte vilken som är den skarpa —
# och utan det svaret raderas ingenting alls.
#
# Inloggningen läses av curl ur samma _netrc-fil som uppladdningen, se
# skicka-till-webben.sh. Variabelnamnen är utan å ä ö: bash tillåter bara
# ASCII i variabelnamn.
#
# Kör:  bash stada-webben.sh
#
set -euo pipefail

VARD="ftp://ns2.inleed.net"
KAT="/public_html/_expo/static/js/web"
NETRC="${NETRC:-$(cd "$(dirname "$0")/.." && pwd)/_netrc_kormetronom}"
DIST="$(cd "$(dirname "$0")" && pwd)/dist"

if [ ! -f "$NETRC" ]; then
  echo "Hittar inte $NETRC — inloggningsuppgifterna saknas." >&2
  exit 1
fi
if [ ! -f "$DIST/index.html" ]; then
  echo "Hittar inget bygge i $DIST. Kör först: npm run bygg:webb" >&2
  exit 1
fi

LIVE=$(grep -o 'index-[0-9a-f]*\.js' "$DIST/index.html" | head -1)
if [ -z "$LIVE" ]; then
  echo "Hittar ingen bundle i index.html — vågar inte radera något." >&2
  exit 1
fi

ftp_kommando() {
  curl --silent --show-error --ssl-reqd --netrc-file "$NETRC" --max-time 300 "$@"
}

GAMLA=$(ftp_kommando "$VARD$KAT/" | awk '{print $NF}' \
  | grep -E '^index-[0-9a-f]+\.js$' | grep -vx "$LIVE" || true)

if [ -z "$GAMLA" ]; then
  echo "Inget att städa: bara $LIVE ligger uppe."
  exit 0
fi

echo "Behåller $LIVE"
echo "Tar bort $(printf '%s\n' "$GAMLA" | wc -l | tr -d ' ') gamla bundlar"

# Kommandona skickas i klumpar. En enda curl med åttio -Q blir en väl lång
# rad, och en klump i taget gör det synligt var det tar stopp om det gör det.
klump=()
skicka() {
  if [ ${#klump[@]} -gt 0 ]; then
    ftp_kommando "${klump[@]}" "$VARD$KAT/" --output /dev/null
    klump=()
  fi
}

while IFS= read -r fil; do
  echo "  $fil"
  klump+=(-Q "DELE $KAT/$fil")
  if [ ${#klump[@]} -ge 20 ]; then
    skicka
  fi
done <<< "$GAMLA"
skicka

echo
echo "Kvar på servern:"
ftp_kommando "$VARD$KAT/" | awk '{print "  " $NF}' | grep -E 'index-[0-9a-f]+\.js$'
