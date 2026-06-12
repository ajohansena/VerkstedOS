import { z } from 'zod';

/**
 * Customer domain types & input validation (docs/03-data-model.md, ADR-015).
 *
 * Pure — no I/O. The Zod schemas are the validation boundary used by services
 * and server actions. Identifier checksum validation lives in
 * `@/lib/validation/norwegian` and is applied in the service layer where the
 * `kind`/`identifierKind` pairing is known.
 */

export const customerKindSchema = z.enum([
  'individual',
  'company',
  'leasing_company',
  'fleet_operator',
]);

export const identifierKindSchema = z.enum([
  'personal_id_no',
  'org_no_no',
  'foreign_id',
]);

/**
 * Canonical billing-address shape persisted in `customers.billing_address`
 * (JSONB column). Kept intentionally narrow — Norwegian postal format only
 * at MVP; non-Norwegian addresses are accepted by leaving `countryCode`
 * empty or 'NO'. Wider international support is a post-MVP concern.
 *
 * SSoT: every consumer (intake wizard, customer admin, invoice rendering,
 * future PDF export) reads/writes via this schema. No ad-hoc address shapes
 * in service or presentation code.
 */
export const billingAddressSchema = z
  .object({
    street: z.string().trim().max(256).optional(),
    postalCode: z.string().trim().max(16).optional(),
    city: z.string().trim().max(128).optional(),
    countryCode: z
      .string()
      .trim()
      .length(2)
      .transform((v) => v.toUpperCase())
      .optional(),
  })
  .strict();

export type BillingAddress = z.infer<typeof billingAddressSchema>;

export const createCustomerSchema = z.object({
  kind: customerKindSchema,
  name: z.string().trim().min(1, 'Name is required').max(256),
  identifier: z.string().trim().max(32).optional(),
  identifierKind: identifierKindSchema.optional(),
  primaryEmail: z.string().trim().email().max(256).optional().or(z.literal('')),
  primaryPhone: z.string().trim().max(32).optional(),
  billingAddress: billingAddressSchema.optional(),
  notes: z.string().trim().max(4000).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
