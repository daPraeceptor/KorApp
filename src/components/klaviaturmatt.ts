/**
 * Klaviaturens mått.
 *
 * Ligger skild från komponenten av samma skäl som klaviaturSpann: det är ren
 * geometri, och geometri går att pröva utan att rita något. Här avgörs hur en
 * tangent ser ut på en skärm som ligger ner.
 */

export const WHITE_KEY_WIDTH = 52;
export const WHITE_KEY_HEIGHT = 184;
export const BLACK_KEY_WIDTH = 34;
export const BLACK_KEY_HEIGHT = 116;

/**
 * Så stor del av skärmhöjden klaviaturen får ta. I liggande läge är höjden
 * det som tar slut först; då krymper hela klaviaturen i stället för att
 * tangenterna blir låga och breda.
 */
const HÖJDANDEL = 0.42;

/**
 * Hur mycket bredare än sin egen proportion en tangent får sträckas.
 *
 * Kant-till-kant-läget breddar tangenterna tills klaviaturen fyller ytan, och
 * utan tak blir de nästan kvadratiska när tonspannet är litet och ytan bred —
 * det ser ut som allt annat än ett piano. En halv gång extra är så långt
 * formen bär.
 */
const MAX_STRÄCKNING = 1.5;

export interface Klaviaturmått {
  tangentbredd: number;
  tangenthöjd: number;
  svartbredd: number;
  svarthöjd: number;
}

/**
 * Tangenternas mått, givet ytan de ska ligga på och skärmens höjd.
 *
 * Två krav ska mötas samtidigt. Klaviaturen ska fylla sin yta när tonspannet
 * är litet, och den ska fortfarande se ut som ett piano. Höjden sätts därför
 * först — den begränsas av skärmen — och bredden får röra sig inom ett band
 * omkring den proportion höjden ger.
 */
export function klaviaturmått(
  ytansBredd: number,
  antalVita: number,
  fönsterhöjd: number,
  fyllBredd: boolean,
): Klaviaturmått {
  const tangenthöjd = Math.min(WHITE_KEY_HEIGHT, Math.max(90, fönsterhöjd * HÖJDANDEL));
  // Bredden som hör ihop med den höjden, och det bredaste formen bär.
  const proportionell = WHITE_KEY_WIDTH * (tangenthöjd / WHITE_KEY_HEIGHT);
  const bredast = proportionell * MAX_STRÄCKNING;

  const önskad =
    fyllBredd && ytansBredd > 0 && antalVita > 0 ? ytansBredd / antalVita : proportionell;
  const tangentbredd = Math.min(bredast, Math.max(proportionell, önskad));

  return {
    tangentbredd,
    tangenthöjd,
    svartbredd: (BLACK_KEY_WIDTH / WHITE_KEY_WIDTH) * tangentbredd,
    svarthöjd: (BLACK_KEY_HEIGHT / WHITE_KEY_HEIGHT) * tangenthöjd,
  };
}
