/**
 * Norwegian identifier validation (no external dependencies).
 *
 * - Fødselsnummer (personnummer): 11 digits, two mod-11 control digits.
 * - Organisasjonsnummer: 9 digits, one mod-11 control digit.
 *
 * These validate the CHECKSUM only — not that the number is actually issued.
 * Pure functions, exhaustively unit-tested.
 */

function toDigits(value: string): number[] | null {
  const trimmed = value.replace(/\s/g, '');
  if (!/^\d+$/.test(trimmed)) return null;
  return [...trimmed].map((c) => Number(c));
}

/**
 * Validate a Norwegian organisasjonsnummer (9 digits, mod-11).
 * Weights 3,2,7,6,5,4,3,2 over the first 8 digits; control = 11 - (sum % 11).
 */
export function isValidOrgNumber(value: string): boolean {
  const digits = toDigits(value);
  if (!digits || digits.length !== 9) return false;

  const weights = [3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 8; i += 1) {
    sum += digits[i]! * weights[i]!;
  }
  const remainder = sum % 11;
  const control = remainder === 0 ? 0 : 11 - remainder;
  // A remainder of 1 yields control 10 → invalid org number.
  if (control === 10) return false;
  return control === digits[8];
}

/**
 * Validate a Norwegian fødselsnummer (11 digits, two mod-11 control digits).
 */
export function isValidPersonalIdNumber(value: string): boolean {
  const digits = toDigits(value);
  if (!digits || digits.length !== 11) return false;

  const w1 = [3, 7, 6, 1, 8, 9, 4, 5, 2];
  const w2 = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

  let sum1 = 0;
  for (let i = 0; i < 9; i += 1) sum1 += digits[i]! * w1[i]!;
  const r1 = sum1 % 11;
  const c1 = r1 === 0 ? 0 : 11 - r1;
  if (c1 === 10 || c1 !== digits[9]) return false;

  let sum2 = 0;
  for (let i = 0; i < 10; i += 1) sum2 += digits[i]! * w2[i]!;
  const r2 = sum2 % 11;
  const c2 = r2 === 0 ? 0 : 11 - r2;
  if (c2 === 10 || c2 !== digits[10]) return false;

  return true;
}

/**
 * Validate an identifier for the given kind. `foreign_id` is not checksum-
 * validated (format varies); only presence is required.
 */
export function isValidIdentifier(
  kind: 'personal_id_no' | 'org_no_no' | 'foreign_id',
  value: string,
): boolean {
  switch (kind) {
    case 'personal_id_no':
      return isValidPersonalIdNumber(value);
    case 'org_no_no':
      return isValidOrgNumber(value);
    case 'foreign_id':
      return value.trim().length > 0;
  }
}
