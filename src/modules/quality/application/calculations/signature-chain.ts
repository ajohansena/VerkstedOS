import { createHash } from 'node:crypto';

/**
 * Signature-chain cryptography (Single Source of Truth). Pure functions — the
 * ONE place signature hashes are computed and verified. A signing service and
 * the Dev verify tool both call these so the chain rule never diverges.
 *
 * The chain is tamper-evident: each signature's `chainHash` folds in the
 * previous signature's chain hash, so altering any earlier row invalidates
 * every later hash for that case.
 */

/** SHA-256 hex of arbitrary content (the signed payload). */
export function hashPayload(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export interface ChainLinkInput {
  previousChainHash: string | null;
  payloadHash: string;
  signedAtIso: string;
  signer: string;
}

/** chainHash = sha256(prev + payloadHash + signedAt + signer). */
export function computeChainHash(input: ChainLinkInput): string {
  const material = [
    input.previousChainHash ?? 'GENESIS',
    input.payloadHash,
    input.signedAtIso,
    input.signer,
  ].join('|');
  return createHash('sha256').update(material, 'utf8').digest('hex');
}

export interface ChainEntry {
  sequenceNo: number;
  payloadHash: string;
  chainHash: string;
  previousChainHash: string | null;
  signedAtIso: string;
  signer: string;
}

export interface VerifyResult {
  valid: boolean;
  /** sequenceNo of the first broken link, or null when the chain is intact. */
  brokenAt: number | null;
}

/**
 * Verify a case's signature chain. Entries must be ordered by sequenceNo. Each
 * link must recompute to its stored chainHash and reference the prior link's
 * chainHash. An empty chain is trivially valid.
 */
export function verifyChain(entries: readonly ChainEntry[]): VerifyResult {
  let previous: string | null = null;
  for (const entry of entries) {
    if ((entry.previousChainHash ?? null) !== previous) {
      return { valid: false, brokenAt: entry.sequenceNo };
    }
    const expected = computeChainHash({
      previousChainHash: previous,
      payloadHash: entry.payloadHash,
      signedAtIso: entry.signedAtIso,
      signer: entry.signer,
    });
    if (expected !== entry.chainHash) {
      return { valid: false, brokenAt: entry.sequenceNo };
    }
    previous = entry.chainHash;
  }
  return { valid: true, brokenAt: null };
}
