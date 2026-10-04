/**
 * Statement names vary in case, accents and spacing ("Januario  da Silveira",
 * "JANUÁRIO DA SILVEIRA"); they are compared in this normalized form.
 */
export function normalizeStatementName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9*&./-]+/g, ' ')
    .trim()
    .toUpperCase();
}
