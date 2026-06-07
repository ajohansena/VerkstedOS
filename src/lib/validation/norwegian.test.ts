import { describe, expect, it } from 'vitest';

import {
  isValidIdentifier,
  isValidOrgNumber,
  isValidPersonalIdNumber,
} from './norwegian';

describe('isValidOrgNumber', () => {
  it('accepts valid Norwegian org numbers', () => {
    // Real, valid organisasjonsnummer (mod-11 control digit correct).
    expect(isValidOrgNumber('914782007')).toBe(true); // Fremtind
    expect(isValidOrgNumber('981290666')).toBe(true); // If
    expect(isValidOrgNumber('995568217')).toBe(true); // Gjensidige
  });

  it('accepts spaced input', () => {
    expect(isValidOrgNumber('914 782 007')).toBe(true);
  });

  it('rejects a wrong control digit', () => {
    expect(isValidOrgNumber('914782008')).toBe(false);
  });

  it('rejects wrong length and non-numeric', () => {
    expect(isValidOrgNumber('12345678')).toBe(false);
    expect(isValidOrgNumber('1234567890')).toBe(false);
    expect(isValidOrgNumber('91478200X')).toBe(false);
  });
});

describe('isValidPersonalIdNumber', () => {
  it('accepts valid fødselsnummer', () => {
    // Synthetic-but-checksum-valid fødselsnummer (correct mod-11 control pair).
    expect(isValidPersonalIdNumber('01010150074')).toBe(true);
    expect(isValidPersonalIdNumber('15065012364')).toBe(true);
    expect(isValidPersonalIdNumber('31129945020')).toBe(true);
  });

  it('rejects a tampered control digit', () => {
    expect(isValidPersonalIdNumber('01010150075')).toBe(false);
  });

  it('rejects wrong length and non-numeric', () => {
    expect(isValidPersonalIdNumber('0101015007')).toBe(false);
    expect(isValidPersonalIdNumber('0101015007X')).toBe(false);
  });
});

describe('isValidIdentifier', () => {
  it('dispatches by kind', () => {
    expect(isValidIdentifier('org_no_no', '914782007')).toBe(true);
    expect(isValidIdentifier('personal_id_no', '01010150074')).toBe(true);
  });

  it('treats any non-empty value as a valid foreign id', () => {
    expect(isValidIdentifier('foreign_id', 'X-99')).toBe(true);
    expect(isValidIdentifier('foreign_id', '   ')).toBe(false);
  });
});
