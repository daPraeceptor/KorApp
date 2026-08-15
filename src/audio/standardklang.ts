/**
 * Klangen appen börjar i — på webben.
 *
 * Här är det körtonen, och skälet är laddningen. Flygeln spelar inspelade
 * prov, och webbsidan måste hämta hem dem över nätet: tre megabyte innan
 * första tonen kan ljuda. Vore flygeln förvald skulle varje besökare betala
 * den hämtningen direkt vid start, också den som bara ville se efter något i
 * låtlistan. Körtonen räknas fram ur oscillatorer och kostar ingenting.
 *
 * Flygeln finns ett tryck bort i inställningarna, och då hämtas proven.
 * Mobilappen har dem redan i sig och börjar därför i flygeln — se
 * standardklang.native.ts.
 */
import type { TimbreId } from './timbres.ts';

export const STANDARDKLANG: TimbreId = 'choir';
