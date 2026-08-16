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

/**
 * Flygelns prov är Ogg Vorbis, och Metro känner bara igen aac, caf, m4a, mp3
 * och wav som ljudtillgångar. Utan tillägget försöker den läsa en .ogg som
 * JavaScript, och hela mobilbygget faller i buntningen — vilket den också
 * gjorde, eftersom webben aldrig går den vägen: där hämtas proven över nätet
 * och require() körs aldrig.
 *
 * Formatet valdes för att ljudmotorn bär libvorbis på båda plattformarna, se
 * samplade.ts.
 */
config.resolver.assetExts = [...config.resolver.assetExts, 'ogg'];

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
