# ADR-004: Opaque Photo Identifiers & Decoupled Storage Reference

## Context
Photos form the primary visual evidence backing quality sign-offs (slump cone measurements, steel layout, compaction tests, concrete cylinders). Embedding direct third-party cloud storage URLs (e.g., AWS S3 pre-signed or public URLs, Cloudinary, Firebase) inside immutable database protocol records creates fragile dependencies. If cloud vendors, storage buckets, or access policies change over the 7-year retention period, immutable records containing dead links cannot be updated.

## Decision
1. Issue an opaque internal photo identifier (`ph_<uuid>`) upon upload.
2. Store binary media under internal storage keys (`storage_key`), alongside independent GPS coordinates, capture timestamp, and SHA-256 file hash.
3. Decouple storage from protocol records: immutable protocol rows reference only `photo_ids`.
4. Resolve storage URLs dynamically at read time via an API endpoint (`/api/photos/:id`).

## Consequences
- Storage backends can be migrated (e.g., local disk $\rightarrow$ MinIO $\rightarrow$ AWS S3 $\rightarrow$ Cloudflare R2) without modifying historical protocol records.
- Preserves byte-level evidence verification via the stored SHA-256 file hash.

## Reversibility
**Irreversible**. Once vendor URLs are burned into immutable protocol rows, data migration requires either rewriting historical records (violating immutability) or maintaining legacy redirect infrastructure indefinitely.
