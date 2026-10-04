/**
 * All monetary values are integer cents. Never use floats for money:
 * integer arithmetic guarantees that 60,00 + 60,00 === 120,00 exactly.
 */
export type Cents = number;

export function isValidCents(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function assertValidCents(value: number, label = 'valor'): void {
  if (!isValidCents(value)) {
    throw new RangeError(`${label} inválido: ${value}`);
  }
}

export function reaisToCents(reais: number): Cents {
  return Math.round(reais * 100);
}

export function sumCents(values: readonly Cents[]): Cents {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * Parses what the user typed in a money field. Digits fill from the right,
 * like banking apps: "1", "12", "120" -> R$ 0,01, R$ 0,12, R$ 1,20.
 */
export function parseMoneyInput(text: string): Cents {
  const digits = text.replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return 0;
  return Number(digits.slice(0, 13));
}

function groupThousands(integer: string): string {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatBRL(cents: Cents, options: { symbol?: boolean } = {}): string {
  const { symbol = true } = options;
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(Math.trunc(cents));
  const integer = groupThousands(String(Math.floor(absolute / 100)));
  const decimals = String(absolute % 100).padStart(2, '0');
  return `${sign}${symbol ? 'R$ ' : ''}${integer},${decimals}`;
}

/**
 * Splits a total into `parts` integer amounts whose sum is exactly the total.
 * The leftover cents go to the first parts: 100,00 / 3 -> 33,34 + 33,33 + 33,33.
 */
export function splitEvenly(total: Cents, parts: number): Cents[] {
  assertValidCents(total);
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new RangeError(`Quantidade de partes inválida: ${parts}`);
  }
  const base = Math.floor(total / parts);
  const remainder = total - base * parts;
  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0));
}

/**
 * Allocates `total` proportionally to `weights` (largest remainder method).
 * The result always sums exactly to `total`, and no part exceeds its exact
 * proportional value rounded up.
 */
export function allocateProportionally(total: Cents, weights: readonly number[]): Cents[] {
  assertValidCents(total);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weights.length === 0 || weightSum <= 0 || weights.some((weight) => weight < 0)) {
    throw new RangeError('Pesos inválidos para divisão proporcional');
  }

  const exact = weights.map((weight) => (total * weight) / weightSum);
  const floors = exact.map(Math.floor);
  let leftover = total - sumCents(floors);

  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - floors[index] }))
    .filter(({ remainder }) => remainder > 0)
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  const result = [...floors];
  for (const { index } of byRemainder) {
    if (leftover === 0) break;
    result[index] += 1;
    leftover -= 1;
  }
  return result;
}
