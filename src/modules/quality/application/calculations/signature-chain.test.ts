import { describe, expect, it } from 'vitest';

import {
  computeChainHash,
  hashPayload,
  verifyChain,
  type ChainEntry,
} from './signature-chain';

function build(
  entries: Array<{ payload: string; signer: string; at: string }>,
) {
  const out: ChainEntry[] = [];
  let previous: string | null = null;
  entries.forEach((e, i) => {
    const payloadHash = hashPayload(e.payload);
    const chainHash = computeChainHash({
      previousChainHash: previous,
      payloadHash,
      signedAtIso: e.at,
      signer: e.signer,
    });
    out.push({
      sequenceNo: i,
      payloadHash,
      chainHash,
      previousChainHash: previous,
      signedAtIso: e.at,
      signer: e.signer,
    });
    previous = chainHash;
  });
  return out;
}

describe('signature-chain', () => {
  it('hashPayload is deterministic SHA-256 hex', () => {
    const a = hashPayload('hello');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashPayload('hello')).toBe(a);
    expect(hashPayload('world')).not.toBe(a);
  });

  it('an intact chain verifies', () => {
    const chain = build([
      { payload: 'accept', signer: 'Ola', at: '2026-06-08T10:00:00.000Z' },
      { payload: 'handover', signer: 'Ola', at: '2026-06-08T12:00:00.000Z' },
    ]);
    const result = verifyChain(chain);
    expect(result.valid).toBe(true);
    expect(result.brokenAt).toBeNull();
  });

  it('an empty chain is trivially valid', () => {
    expect(verifyChain([]).valid).toBe(true);
  });

  it('detects tampering with an earlier payload', () => {
    const chain = build([
      { payload: 'accept', signer: 'Ola', at: '2026-06-08T10:00:00.000Z' },
      { payload: 'handover', signer: 'Ola', at: '2026-06-08T12:00:00.000Z' },
    ]);
    // Tamper with the first entry's payload hash (its chainHash now mismatches).
    const tampered = [...chain];
    tampered[0] = { ...tampered[0]!, payloadHash: hashPayload('forged') };
    const result = verifyChain(tampered);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(0);
  });

  it('detects a broken previous-hash link', () => {
    const chain = build([
      { payload: 'a', signer: 's', at: '2026-06-08T10:00:00.000Z' },
      { payload: 'b', signer: 's', at: '2026-06-08T11:00:00.000Z' },
    ]);
    const tampered = [...chain];
    tampered[1] = { ...tampered[1]!, previousChainHash: 'deadbeef' };
    const result = verifyChain(tampered);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });
});
