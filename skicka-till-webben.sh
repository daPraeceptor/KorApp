#!/usr/bin/env bash
#
# Skickar webbygget till korapp.huleteknik.se.
#
# Inloggningen läses av curl ur ~/_netrc och står aldrig i det här skriptet.
# Anslutningen är krypterad: --ssl-reqd vägrar fortsätta om servern inte
# erbjuder AUTH TLS, och värdnamnet ns2.inleed.net används för att det är det
# namn certifikatet är utfärdat för — korapp.huleteknik.se pekar på samma
# maskin men får certifikatkontrollen att fallera.
#
# Variabelnamnen är avsiktligt utan å ä ö. Bash tillåter bara ASCII i
# variabelnamn och tolkar annars tilldelningen som ett kommandonamn.
#
# Kör:  bash skicka-till-webben.sh
#
set -euo pipefail

VARD="ftp://ns2.inleed.net"
ROT="/public_html"

# Inloggningen ligger utanför projektet, så att den aldrig kan följa med in i
# ett bygge eller en incheckning: _netrc bredvid projektmappen, där varje sajt
# har sin egen fil. En annan kan pekas ut för en enskild körning med NETRC=...
# framför kommandot.
#
# Sökvägen gick tidigare till hemkatalogen, en nivå fel, och skriptet stannade
# därför direkt med "hittar inte".
NETRC="${NETRC:-$(cd "$(dirname "$0")/.." && pwd)/_netrc}"
DIST="$(cd "$(dirname "$0")" && pwd)/dist"

if [ ! -f "$NETRC" ]; then
  echo "Hittar inte $NETRC — inloggningsuppgifterna saknas." >&2
  exit 1
fi
if [ ! -f "$DIST/index.html" ]; then
  echo "Hittar inget bygge i $DIST. Kör först: npx expo export -p web" >&2
  exit 1
fi

ftp_kommando() {
  curl --silent --show-error --ssl-reqd --netrc-file "$NETRC" --max-time 60 \
    "$@" "$VARD$ROT/" --output /dev/null
}

finns() {
  curl --silent --ssl-reqd --netrc-file "$NETRC" --max-time 60 \
    "$VARD$ROT/" | awk '{print $NF}' | grep -qx "$1"
}

# 1. Stäng av Passenger.
#
# Node-appen på subdomänen äger hela adressrymden (PassengerBaseURI "/") och
# svarar "It works!" på varje anrop, även på JavaScript-bundlen. Filerna döps om
# i stället för att raderas, så att allt går att ångra med ett omvänt RNFR/RNTO.
for fil in .htaccess app.js; do
  if finns "$fil"; then
    echo "Döper om $fil -> $fil-passenger-av"
    ftp_kommando -Q "RNFR $ROT/$fil" -Q "RNTO $ROT/$fil-passenger-av"
  else
    echo "$fil finns inte längre — hoppar över"
  fi
done

# 2. Lägg upp bygget.
#
# --ftp-create-dirs skapar _expo/static/js/web om den saknas.
echo "Laddar upp bygget"
cd "$DIST"
find . -type f -print0 | while IFS= read -r -d '' fil; do
  mal="${fil#./}"
  echo "  $mal"
  curl --silent --show-error --ssl-reqd --netrc-file "$NETRC" --max-time 300 \
    --ftp-create-dirs -T "$fil" "$VARD$ROT/$mal"
done

# 3. Kontrollera att sidan faktiskt svarar med rätt sorts innehåll.
#
# Att sidan ger 200 räcker inte som bevis: det var precis vad Node-appen gjorde,
# med brödtext i stället för JavaScript. Därför granskas innehållet.
echo
echo "Kontrollerar https://korapp.huleteknik.se/"
bundle=$(grep -o '_expo/static/js/web/[^"]*\.js' index.html | head -1)
sidhuvud=$(curl -s --max-time 20 "https://korapp.huleteknik.se/" | head -c 200)
typ=$(curl -s -o /dev/null -w '%{content_type}' --max-time 30 \
  "https://korapp.huleteknik.se/$bundle")

case "$sidhuvud" in
  *"<!DOCTYPE html>"*) echo "  startsidan: HTML, ser rätt ut" ;;
  *"It works"*)        echo "  startsidan: fortfarande Node-appen — Passenger lever kvar" ;;
  *)                   echo "  startsidan: oväntat innehåll: ${sidhuvud:0:60}" ;;
esac
case "$typ" in
  *javascript*) echo "  bundlen: serveras som JavaScript ($typ)" ;;
  *)            echo "  bundlen: fel innehållstyp ($typ) — appen startar inte" ;;
esac
