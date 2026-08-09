#!/usr/bin/env bash
#
# Bygger iOS-appen och skickar den till TestFlight i ett svep.
#
# --auto-submit gör att EAS lämnar bygget vidare till App Store Connect så
# fort det lyckats, med samma sparade Apple-uppgifter som ett manuellt
# "eas submit" använder. Misslyckas bygget skickas ingenting.
#
# Byggnumret räknas upp automatiskt (appVersionSource: remote i eas.json),
# så inget behöver ändras i projektet mellan två körningar.
#
# Kör:  bash bygg-ios.sh
#
set -euo pipefail
cd "$(dirname "$0")"

npx eas-cli build --platform ios --profile production --auto-submit "$@"

echo
echo "Bygget är uppe och inskickat. Apple behöver sedan 10–30 minuter på sig"
echo "innan den nya versionen syns i TestFlight."
