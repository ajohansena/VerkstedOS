-- ============================================================================
-- 0055 — Cross-tenant FK reference hole closure (CLAUDE.md §4.2 P0).
-- ============================================================================
--
-- BUG
-- ---
-- Vehicles, cases, communication threads, invoice basis rows, etc. can be
-- created in Organisation A while referencing a customer that belongs to
-- Organisation B. The existing single-column FKs (e.g. `vehicles.owner_customer_id
-- → customers.id`) enforce only that the customer EXISTS — they do not enforce
-- that it lives in the SAME organisation. Postgres FK validation runs with
-- system privileges and BYPASSES Row-Level Security (documented behaviour), so
-- the RLS policies on `customers` do not catch this either. Service code did
-- not have a defensive same-org check on customer-id inputs. Net effect: a
-- working cross-tenant data leak path on every dependent table.
--
-- FIX (CLAUDE.md §4.2 — schema-level enforcement, no service-code dependency)
-- -------------------------------------------------------------------------
-- This migration adds, for every table that references a customer, an
-- ADDITIONAL composite FK on (organization_id, customer_id) →
-- customers(organization_id, id). Both FKs coexist:
--   • single-column FK: ensures the customer exists at all
--   • composite FK:    ensures it belongs to the same organisation
-- A vehicle in Org A with owner_customer_id pointing to a customer in Org B
-- is now rejected by Postgres before the row is written, regardless of which
-- DB role inserts it. RLS is no longer the only line of defence.
--
-- Nullability: every customer-FK column is nullable. Postgres FK MATCH SIMPLE
-- (the default) treats a row with ANY NULL key column as not subject to FK
-- enforcement. So when owner_customer_id is NULL, the composite check passes
-- trivially. The composite FK does not change behaviour when the FK column is
-- already NULL — only when it points to a customer in a different org.
--
-- ON DELETE: the composite FK uses NO ACTION (the default). The pre-existing
-- single-column FKs with ON DELETE SET NULL continue to handle customer
-- deletion. Because hard customer deletion is gated on RLS + soft-delete in
-- practice, this combination is correct: a real hard delete that would orphan
-- the composite reference is also blocked by the single-column FK's ON DELETE
-- NO ACTION behaviour for the rare hard-delete case (any reference, single
-- or composite, blocks).
--
-- TARGET REQUIREMENT
-- ------------------
-- A composite FK requires a matching UNIQUE constraint on the target columns.
-- The customers table needs `UNIQUE (organization_id, id)`. The primary key is
-- already `UNIQUE(id)` so this constraint is redundant from a uniqueness POV,
-- but Postgres requires the composite uniqueness explicitly for the FK target.
-- ============================================================================

ALTER TABLE customers
  ADD CONSTRAINT customers_org_id_unique UNIQUE (organization_id, id);
--> statement-breakpoint

-- ─── vehicles ──────────────────────────────────────────────────────────────
ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_owner_customer_same_org_fk
  FOREIGN KEY (organization_id, owner_customer_id)
  REFERENCES customers (organization_id, id)
  ON DELETE NO ACTION;
--> statement-breakpoint

ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_user_customer_same_org_fk
  FOREIGN KEY (organization_id, user_customer_id)
  REFERENCES customers (organization_id, id)
  ON DELETE NO ACTION;
--> statement-breakpoint

-- ─── vehicle_ownership_history ────────────────────────────────────────────
ALTER TABLE vehicle_ownership_history
  ADD CONSTRAINT voh_owner_customer_same_org_fk
  FOREIGN KEY (organization_id, owner_customer_id)
  REFERENCES customers (organization_id, id)
  ON DELETE NO ACTION;
--> statement-breakpoint

ALTER TABLE vehicle_ownership_history
  ADD CONSTRAINT voh_user_customer_same_org_fk
  FOREIGN KEY (organization_id, user_customer_id)
  REFERENCES customers (organization_id, id)
  ON DELETE NO ACTION;
--> statement-breakpoint

-- ─── cases ────────────────────────────────────────────────────────────────
ALTER TABLE cases
  ADD CONSTRAINT cases_primary_customer_same_org_fk
  FOREIGN KEY (organization_id, primary_customer_id)
  REFERENCES customers (organization_id, id)
  ON DELETE NO ACTION;
--> statement-breakpoint

-- ─── case_parties ─────────────────────────────────────────────────────────
ALTER TABLE case_parties
  ADD CONSTRAINT case_parties_customer_same_org_fk
  FOREIGN KEY (organization_id, customer_id)
  REFERENCES customers (organization_id, id)
  ON DELETE NO ACTION;
--> statement-breakpoint

-- ─── case_funding_sources (two customer-FK columns) ───────────────────────
ALTER TABLE case_funding_sources
  ADD CONSTRAINT cfs_payer_customer_same_org_fk
  FOREIGN KEY (organization_id, payer_customer_id)
  REFERENCES customers (organization_id, id)
  ON DELETE NO ACTION;
--> statement-breakpoint

ALTER TABLE case_funding_sources
  ADD CONSTRAINT cfs_deductible_payer_customer_same_org_fk
  FOREIGN KEY (organization_id, deductible_payer_customer_id)
  REFERENCES customers (organization_id, id)
  ON DELETE NO ACTION;
--> statement-breakpoint

-- ─── case_acceptances ─────────────────────────────────────────────────────
ALTER TABLE case_acceptances
  ADD CONSTRAINT case_acceptances_customer_same_org_fk
  FOREIGN KEY (organization_id, customer_id)
  REFERENCES customers (organization_id, id)
  ON DELETE NO ACTION;
--> statement-breakpoint

-- ─── communication_threads ────────────────────────────────────────────────
ALTER TABLE communication_threads
  ADD CONSTRAINT comm_threads_customer_same_org_fk
  FOREIGN KEY (organization_id, customer_id)
  REFERENCES customers (organization_id, id)
  ON DELETE NO ACTION;
--> statement-breakpoint

-- ─── invoice_basis ────────────────────────────────────────────────────────
ALTER TABLE invoice_basis
  ADD CONSTRAINT invoice_basis_payer_customer_same_org_fk
  FOREIGN KEY (organization_id, payer_customer_id)
  REFERENCES customers (organization_id, id)
  ON DELETE NO ACTION;
--> statement-breakpoint

-- ─── rental_reservations ──────────────────────────────────────────────────
ALTER TABLE rental_reservations
  ADD CONSTRAINT rental_reservations_customer_same_org_fk
  FOREIGN KEY (organization_id, customer_id)
  REFERENCES customers (organization_id, id)
  ON DELETE NO ACTION;
