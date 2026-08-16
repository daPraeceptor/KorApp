/**
 * Rotationslåset på webben: det finns inget att låsa.
 *
 * Webbläsarfönstret avgör riktningen, och en sida kan inte tvinga telefonen
 * att stå upp. Funktionen finns ändå, så att appen slipper fråga vilken
 * plattform den kör på — motsvarigheten för iOS och Android ligger i
 * rotationslas.native.ts.
 */

export async function ställRotation(_tillåt: boolean): Promise<void> {
  // Med flit tomt.
}
