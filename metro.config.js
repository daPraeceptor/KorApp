/**
 * Metro-konfiguration med en enda avvikelse från standard: relativa importer
 * med uttrycklig .ts-ändelse behandlas som ändelselösa.
 *
 * Ändelserna finns för Node: testerna körs med typavskalning, och då kräver
 * Node att varje import skriver ut sin fil. Men Metro väljer bara
 * plattformsfiler — context.native.ts framför context.ts — för importer utan
 * ändelse. Med ändelsen kvar buntades webbens ljudkontext in i iOS-appen,
 * som därmed var helt tyst: den kastade "Web Audio API saknas" vid varje
 * försök att spela.
 */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const standardUpplosning = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const namn =
    moduleName.startsWith('.') && /\.tsx?$/.test(moduleName)
      ? moduleName.replace(/\.tsx?$/, '')
      : moduleName;
  return standardUpplosning
    ? standardUpplosning(context, namn, platform)
    : context.resolveRequest(context, namn, platform);
};

module.exports = config;
