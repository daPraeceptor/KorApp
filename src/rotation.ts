/**
 * När telefonen får vridas.
 *
 * Två lägen drar åt olika håll. Under repetitionen håller körledaren
 * telefonen i handen och skruvar på tempo och toner — då är en skärm som
 * kastar om sig vid minsta lutning bara i vägen. I konsertläge ligger
 * telefonen på notstället, låst med hänglåset, och där kan liggande vara
 * precis vad man vill ha: hjulet och taktvisaren blir bredare och syns på
 * längre håll.
 *
 * Därför hänger inställningen ihop med låset i stället för att vara en
 * ensam av- och påknapp.
 *
 * Gäller bara telefonen. På webben bestämmer fönstret, och det finns ingen
 * vridning att låsa — se rotationslas.ts och rotationslas.native.ts, som
 * håller själva låset isär mellan plattformarna.
 */
/** Aldrig, bara när appen är låst för konsert, eller alltid. */
export type Rotation = 'aldrig' | 'konsert' | 'alltid';

export const ROTATION_VAL: { id: Rotation; label: string; beskrivning: string }[] = [
  {
    id: 'aldrig',
    label: 'Aldrig',
    beskrivning: 'Appen står upp hur du än håller telefonen.',
  },
  {
    id: 'konsert',
    label: 'I konsertläge',
    beskrivning:
      'Telefonen får läggas ner när appen är låst med hänglåset, men står upp medan du arbetar i den.',
  },
  {
    id: 'alltid',
    label: 'Alltid',
    beskrivning: 'Appen följer telefonens vridning hela tiden.',
  },
];

/** Sant när skärmen ska få vridas, givet inställningen och om appen är låst. */
export function fårVridas(rotation: Rotation, låst: boolean): boolean {
  switch (rotation) {
    case 'alltid':
      return true;
    case 'konsert':
      return låst;
    default:
      return false;
  }
}
