# 04 — Document Architecture

In collision repair, documents (photos, estimates, invoices, signed agreements) are often as important as structured data. This document defines how VerkstedOS handles them.

The Documents module is **cross-cutting** — it has its own ownership but is consumed by virtually every other module.

## Document categories

| Category | Source | Typical formats | Sensitivity | Versioned? |
|---|---|---|---|---|
| **Photo** | Mobile / tablet upload | JPEG, HEIC, PNG | Low-Medium | No (multiple unique) |
| **Estimate file** | DBS import / manual upload | XML, PDF, proprietary | Medium | **Immutable** (new version = new file) |
| **Supplier invoice** | Email, manual upload, API | PDF, structured XML | High (financial) | **Immutable** |
| **Credit note** | Email, manual upload | PDF, XML | High (financial) | **Immutable** |
| **Insurance document** | Email, customer upload | PDF | High (PII) | Immutable per upload |
| **Customer attachment** | Customer portal, email | PDF, image, doc | Medium | No |
| **Email attachment** | Inbound email integration | Any | Variable | No |
| **Internal document** | Manual upload | Any | Variable | Optional |
| **Generated invoice** | System (invoice basis → PDF) | PDF | High (financial) | **Immutable per version**; new version on regenerate |
| **Signed agreement** | Digital signature flow | PDF | Highest | Immutable + cryptographic chain |
| **Quality report** | Generated from checklist run | PDF | Medium | Immutable per version |

## Storage strategy

**Storage layer**: Supabase Storage, organized into buckets by **sensitivity class** (not by document kind).

| Bucket | Sensitivity | Signed URL TTL | Virus scan |
|---|---|---|---|
| `docs-public` | None (logos, public assets) | Long (CDN-friendly) | Yes |
| `docs-internal` | Standard (photos, internal notes) | 15 min | Yes |
| `docs-confidential` | High (financial, insurance, PII) | 5 min | Yes |
| `docs-restricted` | Highest (signed agreements, GDPR-sensitive) | 2 min, IP-bound | Yes |

Sensitivity-class buckets allow uniform Storage RLS policies and lifecycle rules without per-kind enumeration. The `documents.kind` discriminator handles per-kind logic in application code.

### Path convention

Tenant-prefixed, hierarchical:

```
<bucket>/org_<org_id>/<linked_entity_type>/<linked_entity_id>/<document_id>/<filename>
```

Example:
```
docs-confidential/org_5f3a.../case/8a12.../doc_4ef9.../estimate-v2.pdf
docs-internal/org_5f3a.../case/8a12.../doc_8b22.../photos/IMG_2451-1920.jpg
docs-internal/org_5f3a.../case/8a12.../doc_8b22.../photos/IMG_2451-480.jpg
docs-internal/org_5f3a.../case/8a12.../doc_8b22.../photos/IMG_2451-original.heic
```

A single conceptual document can have multiple physical files (original + sized variants). One `documents` row with a `variants` JSONB field describes the rendered sizes.

## Metadata model

### `documents`

```
documents
 ├── id (uuid PK)
 ├── organization_id (RLS scope)
 ├── kind                ('photo' | 'estimate_file' | 'supplier_invoice' |
 │                        'credit_note' | 'insurance_document' | 'customer_attachment' |
 │                        'email_attachment' | 'internal' | 'generated_invoice' |
 │                        'signed_agreement' | 'quality_report' | 'other')
 ├── source              ('upload' | 'email' | 'dbs_import' | 'api' | 'webhook' |
 │                        'generated' | 'scan' | 'system')
 ├── sensitivity         ('public' | 'internal' | 'confidential' | 'restricted')
 │
 ├── storage_bucket
 ├── storage_path
 ├── original_filename
 ├── content_type        (MIME)
 ├── byte_size
 ├── checksum_sha256
 ├── variants            (jsonb: {1920: path, 480: path, thumb: path})
 │
 ├── version_number      (default 1)
 ├── supersedes_id       (FK documents, nullable)
 ├── is_current_version  (bool, computed)
 │
 ├── uploaded_by_user_id (nullable)
 ├── uploaded_by_kind    ('user' | 'system' | 'integration' | 'customer_portal')
 ├── uploaded_at
 │
 ├── is_signed           (bool)
 ├── signature_chain_id  (FK signature artifact, nullable)
 │
 ├── is_processed        (bool — false until image pipeline / virus scan complete)
 │
 ├── retention_class     (computed from kind)
 ├── retention_until     (timestamp)
 │
 ├── metadata            (jsonb — kind-specific: EXIF, OCR text, parsed structured data)
 │
 ├── deleted_at
 ├── deleted_reason
 └── audit timestamps (light tier; full audit via audit_events on deletion / versioning)
```

### `document_links` (polymorphic many-to-many)

```
document_links
 ├── id (uuid PK)
 ├── organization_id
 ├── document_id (FK documents)
 ├── linked_entity_type  ('case' | 'claim' | 'customer' | 'vehicle' |
 │                        'supplier_invoice' | 'purchase_order' | 'communication' |
 │                        'work_segment' | 'checklist_run' | 'invoice_basis' |
 │                        'rental_agreement' | ...)
 ├── linked_entity_id (uuid)
 ├── role                ('primary' | 'attachment' | 'before_photo' | 'during_photo' |
 │                        'after_photo' | 'estimate_source' | 'invoice_source' |
 │                        'credit_source' | 'signed_copy' | 'generated_output' |
 │                        'reference' | ...)
 ├── linked_by_user_id
 ├── linked_at
 └── deleted_at
```

**One document, many links.** A single insurance approval PDF can be linked to a case, a claim, and a communication (the email it arrived in). Three rows in `document_links`, one row in `documents`.

**Lifecycle independence.** Unlinking a document from a case does not delete the document. Deleting a case soft-deletes the links but the documents remain until retention rules say otherwise.

### `document_access_events` (download tracking)

Append-only, partitioned by month:

```
document_access_events
 ├── id (uuid)
 ├── occurred_at
 ├── organization_id
 ├── document_id
 ├── accessed_by_user_id
 ├── access_kind         ('view' | 'download' | 'thumbnail' | 'export')
 ├── ip_address
 ├── user_agent
 └── correlation_id
```

Used for GDPR access logs, investigations, and Dev Control Plane "who downloaded this" queries.

## Versioning

Two patterns:

| Pattern | Used for | Mechanism |
|---|---|---|
| **Immutable-with-new-version** | Estimates, generated invoices, quality reports | New `documents` row, `supersedes_id` → prior version, `is_current_version` recomputed |
| **No versioning (each unique)** | Photos, customer attachments, supplier invoices | Each upload is its own document |

Versioned documents always preserve the full chain. Old versions stay readable until retention. The "current" version is `WHERE is_current_version = true`.

## Retention policies

Per-kind defaults (configurable per organization):

| Kind | Default retention | Compliance basis |
|---|---|---|
| Generated invoices, accounting docs | 10 years from creation | Bokføringsloven |
| Estimate files | 10 years from case closure | Insurance / legal |
| Supplier invoices, credit notes | 10 years | Bokføringsloven |
| Signed agreements | Permanent | Legal |
| Insurance documents | 10 years from case closure | Insurer expectations |
| Photos (case-linked) | 5 years from case closure | Quality / dispute |
| Customer attachments | 5 years from case closure | Operational |
| Email attachments | 3 years (tied to communication) | Operational |
| Internal documents | 3 years from upload | Operational |
| Quality reports | 5 years | Operational |

### Lifecycle automation

A nightly Inngest job:
1. Scans for `documents.retention_until < now() - 30 days`
2. Moves objects to cold storage first (90-day recovery window)
3. Hard-deletes after the cold-storage window
4. Audits each step

### GDPR erasure

When a customer requests erasure:
- All their PII-bearing documents are anonymized where structurally possible (names redacted, faces blurred in photos via a queued job)
- Or marked for accelerated deletion
- `documents.metadata` tracks erasure operations applied
- Full audit on every anonymization / deletion action

## Security model

| Layer | Mechanism |
|---|---|
| **Auth for download** | Fresh signed URL with short TTL on every download request |
| **Authorization** | `requirePermission(ctx, 'document:view', { documentId })` — checks based on linked entities |
| **RLS** | Defense-in-depth on `documents` and `document_links` — `organization_id` filtering |
| **Storage RLS** | Supabase Storage policies mirror DB RLS via path prefix `org_<id>/` |
| **Virus scan** | ClamAV invoked on upload before document becomes accessible (Inngest function) |
| **MIME validation** | Server-side libmagic detection, not client-declared MIME |
| **EXIF stripping** | Sized variants strip EXIF (location data); originals preserve it for forensics |
| **Watermarking** | Generated invoices and quality reports include watermarks identifying the org |
| **IP restriction** | `docs-restricted` bucket URLs bound to requesting client IP |

## Audit requirements

| Action | Audit tier | Notes |
|---|---|---|
| Document uploaded | Event | Captured on row creation |
| Document linked to entity | Event | Per `document_links` row |
| Document viewed (download) | Event (confidential/restricted only) | `document_access_events` |
| Document version superseded | Full | Before/after on version chain |
| Document deleted | Full | Reason required |
| Document anonymized (GDPR) | Full | Before/after on metadata |
| Bulk operations | Full | Aggregated record per batch |

## Image-specific pipeline

```
1. Upload arrives (server action or REST API)
2. Server-side MIME validation (libmagic)
3. Direct upload to docs-internal/.../original.heic (or jpeg)
4. Inngest job enqueued: process_image
5. process_image:
   a. Download original
   b. Virus scan (ClamAV)
   c. Decode (heic-decode for iPhone, sharp for others)
   d. Generate variants: 1920px (max), 480px (default), 128px (thumb)
   e. Strip EXIF from variants
   f. Upload variants to same path with size suffix
   g. Update documents.variants JSONB
   h. Set documents.is_processed = true
   i. Emit quality.image.processed event
6. UI subscribes via Realtime; placeholder replaced with thumbnail when ready
```

Images that fail processing emit `quality.image.processing_failed` and remain accessible as originals only, with a UI flag indicating processing failure.

## Documents module structure

```
src/modules/documents/
   domain/
      entities/document.ts
      entities/document-link.ts
      value-objects/sensitivity.ts
      value-objects/retention-class.ts
   application/
      services/upload-document.ts
      services/link-document.ts
      services/version-document.ts
      services/anonymize-document.ts
      services/issue-signed-url.ts
      calculations/retention-deadline.ts
   infrastructure/
      repositories/document-repo.ts
      adapters/supabase-storage.ts
      adapters/virus-scan-clamav.ts
      processors/image-pipeline.ts
   ports/
      document-port.ts                (exposed to other modules)
   public/
      document-types.ts
      document-events.ts
```

Other modules never write to `documents` or Supabase Storage directly. They call `DocumentPort.upload(...)`, `DocumentPort.link(...)`, etc.

## Three surfaces of the document module

Per the Dev Panel Coverage Rule (see [07-governance.md](./07-governance.md)).

### User Surface
- Upload photo / file from case detail
- View document gallery for a case
- Download a document (signed URL)
- Replace a document (for versioned kinds)
- E-sign a document (signed agreement flow)
- Routes: `/cases/:id/documents`, `/documents/:id/download`
- Permissions: `quality:edit` (upload images), `case:view` (view), kind-specific for finance docs

### Admin Surface
- Configure retention overrides per kind (per org)
- View storage usage per workshop
- Bulk-export documents for a case (zip)
- Configure custom document kinds and roles
- Routes: `/admin/documents/retention`, `/admin/documents/storage-usage`
- Permissions: `admin:config`

### Dev Surface
- Search documents across all orgs (by checksum, filename, kind, uploader, date)
- Inspect a document: full metadata, all links, version chain, access history
- View `document_access_events` (who downloaded what)
- Reprocess image pipeline (if processing failed)
- Force re-scan (virus or MIME re-validation)
- Move documents between buckets (sensitivity reclassification)
- View virus-scan failures
- View processing queue health
- Routes: `/dev/documents`, `/dev/documents/:id`
- Permissions: `platform:data:repair`, `platform:org:view`
