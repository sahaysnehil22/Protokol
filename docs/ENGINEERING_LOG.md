# PROTOKOL — Engineering Log

Implementation decisions made under Kenny's 2026-10-03 authorization
("use your engineering judgment to correct it ... document the reason").
The decision brief (`DECISION_BRIEF_V1.md` in the review workspace) remains
the product baseline; this file records where implementation deviated from
or refined the original documents, and why.

## 2026-10-03 — Production-readiness implementation (branch `feat/prod-readiness`)

### Auth model (S-1)
- **Decision:** HttpOnly cookie sessions (`protokol_session`, SameSite=Strict),
  not Bearer tokens in localStorage.
- **Reason:** the PWA is same-origin, so cookies are sent automatically (zero
  changes to every fetch call site) and an HttpOnly cookie cannot be stolen
  by XSS, unlike a localStorage token. 12h expiry; no refresh rotation in the
  pilot (documented future hardening).
- **Deviation note:** the brief said "session-token auth" without specifying
  transport. Cookie was the safer engineering call.

### PIN salt fail-fast (C-03, refined)
- **Decision:** fail-fast in production only for `HMAC_SECRET`. A missing
  `PIN_SALT` logs a loud warning but does NOT crash.
- **Reason:** rotating the PIN salt invalidates every existing PIN hash, and
  the product has no PIN-recovery flow by explicit product decision
  (centralized PIN, no change-password). Crashing on a missing PIN_SALT
  would brick all field logins with no recovery path. Failing fast on
  HMAC_SECRET is safe because integrity hashes are seal-time artifacts.

### Legacy project compatibility
- **Decision:** projects created before the centralized PIN (`access_pin_hash
  IS NULL`) accept any technician PIN at `/verify-access`, and a new
  `POST /projects/:id/access-pin` endpoint lets the holder of the current PIN
  set the centralized PIN (which also kills all sessions).
- **Reason:** the pilot already has live projects (David's crew). A hard
  cutover would lock the field team out. Migration path is explicit and
  one-way.

### Project listing vs. hiding (interim multi-user)
- **Decision:** `GET /api/projects` stays public but returns a MINIMAL column
  set (no PIN hashes, no WhatsApp numbers, no lockout state). A
  `project_members` table records which devices verified the PIN; the portal
  defaults to `scope=mine`. Every data endpoint enforces session→project
  match (IDOR protection).
- **Reason:** true hiding needs user accounts (Part-4). The real security
  boundary is data access, not name listing — and that boundary is now
  enforced. Documented as a known interim tradeoff.

### Transactions (R-1)
- **Decision:** `BEGIN IMMEDIATE` + `COMMIT`/`ROLLBACK` around the DB-write
  sections of `submitProtocol` and `recordCylinderResult`. Notifications, PDF
  generation and cloud mirror moved AFTER commit. NC notifications are
  collected and drained post-commit.
- **Reason:** the original code `await`ed notifications INSIDE the write
  flow — holding no lock but interleaving network I/O with DB writes, and a
  mid-flow failure left half-written records. `BEGIN IMMEDIATE` (not DEFERRED)
  takes the write lock up-front so a concurrent submit blocks instead of
  racing the check-then-insert.

### Idempotency (R-2) + duplicate status code
- **Decision:** the idempotency key is generated once per form draft
  (client), not per submit click. The route pre-checks the key and returns
  **200** for duplicates (was: always 201).
- **Reason:** per-click keys made double-clicks/timeout-retries create true
  duplicates — defeating the entire mechanism. 200-vs-201 lets the client
  distinguish "created" from "replayed".

### Supabase pull (R-4/H-04)
- **Decision:** pull uses `INSERT OR IGNORE` for projects, technicians,
  protocols, trucks, cylinders (was `INSERT OR REPLACE`). REPLACE is kept
  only for pure config tables (criteria, checklist_templates, schedules).
  Pull column lists were aligned with NOT NULL local columns
  (server_received_at, timezone_offset, gps_source).
- **Reason:** `REPLACE` = DELETE+INSERT: it silently rewrote sealed legal
  records and bypassed the immutability trigger. The local instance is the
  writer; the cloud is the backup. IGNORE preserves local truth on existing
  instances while still hydrating fresh ones.

### IN-operator strictness (H-06)
- **Decision:** removed the hardcoded pass-bands (8.5–13.0, 3.25–5.25).
  `allowed_values` now evaluates strictly; the legitimate cm/inch dual is
  handled by converting the actual value before comparing.
- **Reason:** the bands let out-of-spec values pass validation — exactly the
  failure the criterion system exists to prevent.

### Offline PIN check (D-10)
- **Decision:** on online login the client caches `SHA-256(device_token:pin)`
  in IndexedDB; offline login compares against it. Salted per-device (not a
  global salt).
- **Reason:** true offline auth without a server round-trip. Tradeoff is
  documented: a device with the cached hash is inside the trust boundary
  (it's the crew's shared tablet); the online path keeps server-side
  rate-limit + lockout.

### Dead-letter queue (M-04)
- **Decision:** 4xx payload errors (except 401/403) park the item as
  REJECTED immediately; 5xx/network errors retry up to 10 times, then park.
  401/403 never dead-letters (session expiry is not a payload defect).
- **Reason:** the old queue retried poison payloads forever, silently.

### Signatures
- **Decision:** added the missing per-box signing UI (verdict view). Kept the
  server rule "only box 1 auto-signs for the submitter".
- **Reason:** the API existed but no UI could sign boxes 2–5 (H-03/D-04).

### Deploy (H-11)
- **Decision:** added `render.yaml` (with `healthCheckPath: /api/health`),
  `Dockerfile` (non-root, HEALTHCHECK), `.dockerignore`. Documented the
  ephemeral-disk reality of the free plan and the mitigations (Storage for
  photos, Postgres mirror for protocols, regenerable PDFs).
- **Reason:** deploys were not reproducible and data-loss-on-redeploy was
  undocumented.

### Out of scope (explicitly deferred, per brief)
Part-4 multi-tenancy (companies, RLS, billing), MetaCloud, cement_log,
full legal dossier (legajo), D-07 supersedes write path, CSP
`unsafe-inline` removal (needs a style-attribute refactor first).
