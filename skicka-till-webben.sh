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
# ett bygge eller en incheckning: _netrc_kormetronom bredvid projektmappen,
# där varje sajt har sin egen fil uppkallad efter sig. En annan kan pekas ut
# för en enskild körning med NETRC=... framför kommandot.
#
# Sökvägen gick tidigare till hemkatalogen, en nivå fel, och skriptet stannade
# därför direkt med "hittar inte".
NETRC="${NETRC:-$(cd "$(dirname "$0")/.." && pwd)/_netrc_kormetronom}"
# Sökvägen till projektmappen tas ut här, innan steg 2 byter katalog till
# dist/. Efteråt pekar $0 fel och steg 4 hittade inte städskriptet.
HAR="$(cd "$(dirname "$0")" && pwd)"
DIST="$HAR/dist"

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

# 1. Sopa bort Passengers kvarlevor.
#
# Node-appen på subdomänen ägde en gång hela adressrymden (PassengerBaseURI
# "/") och svarade "It works!" på varje anrop, även på JavaScript-bundlen. Den
# stängdes av genom att .htaccess och app.js döptes om till *-passenger-av.
# Nu kommer en egen .htaccess med bygget (public/.htaccess), och den får inte
# döpas om. app.js-passenger-av gick att ladda ner som vanlig text och tas
# bort; .htaccess-passenger-av får ligga kvar som minne av konfigurationen —
# Apache vägrar lämna ut filer som börjar på .ht.
#
# En bundle i rotkatalogen är en rest från den första deployen, innan den
# hamnade under _expo/. Ingen sida pekar på den.
rester=$(curl --silent --ssl-reqd --netrc-file "$NETRC" --max-time 60 \
  "$VARD$ROT/" | awk '{print $NF}' \
  | grep -xE 'app\.js-passenger-av|index-[0-9a-f]+\.js' || true)
for fil in $rester; do
  echo "Tar bort $fil"
  ftp_kommando -Q "DELE $ROT/$fil"
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
# Säkerhetshuvudena kommer från public/.htaccess. Saknas de har Apache inte
# läst filen, och då gäller inte omdirigeringen till https heller.
huvuden=$(curl -sI --max-time 20 "https://korapp.huleteknik.se/")
for huvud in Strict-Transport-Security Content-Security-Policy X-Content-Type-Options; do
  if printf '%s' "$huvuden" | grep -qi "^$huvud:"; then
    echo "  $huvud: finns"
  else
    echo "  $huvud: SAKNAS — .htaccess verkar inte läsas"
  fi
done
omdirigering=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 20 \
  "http://korapp.huleteknik.se/")
echo "  http:// svarar: $omdirigering"
case "$typ" in
  *javascript*) echo "  bundlen: serveras som JavaScript ($typ)" ;;
  *)            echo "  bundlen: fel innehållstyp ($typ) — appen startar inte" ;;
esac

# 4. Sopa efter uppladdningen.
#
# Varje bygge får ett nytt filnamn med innehållets summa i sig, och steg 2
# lägger bara till. Utan det här steget blev det ett åttiotal bundlar och ett
# fyrtiotal megabyte på servern, av vilka en användes. Städningen kör sist,
# efter kontrollen ovan: går uppladdningen i stäv ska den gamla bundlen ligga
# kvar att falla tillbaka på.
echo
bash "$HAR/stada-webben.sh"
