/**
 * Klangen appen börjar i — på iOS och Android.
 *
 * Här är det flygeln. Proven är inbuntade i appen och kostar ingen hämtning,
 * så det finns inget skäl att börja i något annat än det instrument en kör
 * känner igen som "tonen". Webbens motsvarighet börjar i körtonen, eftersom
 * den måste hämta sina prov över nätet — se standardklang.ts.
 */
import type { TimbreId } from './timbres.ts';

export const STANDARDKLANG: TimbreId = 'salamander';
