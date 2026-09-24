# SPEC_FOR_SNEHIL — Technical Build Specification

**Document:** Engineering specification and action plan for the PROTOKOL pilot (Phase 0)
**To:** Snehil Sahay — Engineering / CTO
**From:** Kenny Garamendi — Product
**Version:** 2.0 — September 2026
**Status:** Ready to build. This is the **unified final spec**: PROTOKOL Technical Product Document v2.4 +
resolved conflicts with CRASH v1 + post-audit corrections (Audits I–III). It supersedes
`CRASH_TECH_SPEC.md` where they conflict (see Section 2).

---

## 1. Executive Summary

### 1.1 Source document lineage

The engineering source of truth is `docs/originales/PROTOKOL_TECHNICAL_DOC_v2_4.docx/pdf`. Version history:

| Version | What it added |
|---|---|
| v2.0 | Base: three layers, findings, API contracts, irreversible decisions, acceptance criteria |
| v2.1 | In-person meeting findings (12-Sep): 5+4 team structure, PPI terminology, Acofile Q competitor, **4-activity Phase 0** (steel added), milestone disbursement structure |
| v2.2 | Section 12: future directions (single-role RAG assistant, multi-project data accumulation) + question 7 |
| v2.3 | Real validation thresholds (slump 8.9–12.7 cm, 4 cylinders per truck, f'c per partida), real signature roster with CIP numbers, evidence from 6 signed field protocols, **subcontractor scope**, correction: formwork/steel template codes are different element types, not competing versions |
| v2.4 | Post-audit fixes: API contract examples corrected to real values (slump 10, 4 cylinders, expected 8.9–12.7), questions 3 & 7 marked **answered by Snehil**, 3 more competitors confirmed (Calidad Cloud, ObraLink, Bildin) |

### 1.2 What we are leaving behind

All prior auditing work — the ADONIS n8n workflows, Railway deployments, Evolution API integrations and
their JSON exports — is archived in `docs/00_viejo_obsoleto/`. It was a WhatsApp-agent system built for a
different business (an academy lead-capture bot). It is **not** the foundation for this build. Its only
carry-over value is operational experience with n8n/Evolution/Supabase, which may inform the WhatsApp
notification integration later.

### 1.3 What we are building now

PROTOKOL is a **quality traceability system for public road construction**, piloted on a live,
S/ 41.9M project (2.38 km, AY-728 to AY-729, Ayacucho, Peru). The core domain insight: a concrete road is a
**state machine over physical slab panels (paños)**, not a CRUD app over forms. Each layer (subgrade →
sub-base → base → formwork → steel → pour → curing → cylinder break) must be released before the next
proceeds, and every release is legally binding documentation: it gates the contractor's monthly payment
certificate and shields the Quality Specialist (David Valdez Ochoa) from 7-year personal liability
(Peruvian Civil Code Art. 1784).

The pilot (Phase 0) must answer one question: **does the field crew record quality data through the system
without the quality manager chasing them?** Success: ≥80% of expected protocols completed unprompted in a
4-week pilot.

### 1.4 Product shape (three layers)

1. **Capture (field):** PWA, offline-first, guided forms, GPS + timestamped camera, 3–5 min per protocol.
2. **Intelligence (backend):** validation against project criteria loaded **as data**, automatic
   non-conformance opening, panel release-state tracking, deferred cylinder workflow (7/28 days),
   append-only evidence with integrity hashing.
3. **Output (office/state):** generated protocol PDFs, live status view (Google Sheets acceptable for
   Phase 0), quality dossier compilation, INFOBRAS-compatible export (design only, not built in Phase 0).

WhatsApp is a **notification/escalation channel only** — never the capture channel.

---

## 2. Resolution of the 6 Technical Conflicts (CRASH v1 vs PROTOKOL v2.4)

Two specs existed in parallel. These are the final rulings. Build to the "Resolution" column — it is
normative for the pilot.

### 2.1 Conflict 1 — Product identity

| | CRASH v1 | PROTOKOL v2.4 | **Resolution** |
|---|---|---|---|
| Name | CRASH | PROTOKOL | **CRASH is the pilot codename; PROTOKOL is the product name.** Use `crash.app/{obra_id}` style URLs internally, and PROTOKOL in generated documents. |

### 2.2 Conflict 2 — Slump tolerance

| | CRASH v1 | PROTOKOL v2.4 | **Resolution** |
|---|---|---|---|
| Slump range | 7.5 – 12.5 cm | 8.9 – 12.7 cm | **Superseded by F2 (~20-Sep):** slump is captured by **selecting one discrete value — 3.5", 4", 4.5", 5"** — per mixer, not by typing a number into a range. The 8.9–12.7 cm range (confirmed 16-Sep) corresponds to the 3.5"–5" band and remains the reference band; the UI and the `criteria` row use `operator='in'` + `allowed_values`. Applies **across all elements** (pavement, walls, culverts, curbs), not per partida. |

### 2.3 Conflict 3 — Cylinder sampling frequency

| | CRASH v1 | PROTOKOL v2.4 | **Resolution** |
|---|---|---|---|
| Sampling rule | Min. 2 cylinders per pour >4 m³ | 4 cylinders per mixer truck (carmix) | **Per-mixer/batch sampling.** 4 cylinders per carmix truck, confirmed 16-Sep-2026. One pour can involve 20+ truck loads, each with its own delivery note (guía de despacho), its own slump reading, and its own 4 cylinders. The concrete record therefore holds **a list of truck entries**, never a single slump/cylinder pair. |

### 2.4 Conflict 4 — Parameter storage

| | CRASH v1 | PROTOKOL v2.4 | **Resolution** |
|---|---|---|---|
| Criteria location | Constants in code | Data in database | **Dynamic parameter storage: criteria live in the `criteria` table, loaded per project.** This is Irreversible Decision #1 from v2.4 — non-negotiable. Hardcoding single-project assumptions would require touching everything when the product scales to project #2. Adenda changes (e.g., a new slump range via contract addendum) are data edits, not deploys. |

### 2.5 Conflict 5 — Activity chain

| | CRASH v1 | PROTOKOL v2.4 | **Resolution** |
|---|---|---|---|
| Phase 0 activities | 3: Concrete, Topography, Compaction | 4: Concrete, Survey, Compaction, Steel (formwork embedded in concrete pre-pour checklist) | **5 activities, each with its own full protocol, in site order: Compaction (`COMPACTION`) → Survey (`SURVEY`) → Steel (`STEEL`) → Formwork (`FORMWORK`) → Concrete (`CONCRETE`).** Post-MVP feedback from David (~20-Sep-2026): formwork is NOT embedded in the concrete checklist — it is its own protocol with its own paper-format checklist. **Field-test priority (David, ~20-Sep): Survey, Formwork, Concrete (pavement) first** — the project finishes Sep–Nov 2026; Compaction and Steel follow. |

**Related ruling (verdict model):** adopt v2.4's two-stage verdict — `PASS | PROVISIONAL_PASS | FAIL`.
A concrete pour cannot be finally certified until 28-day cylinder results arrive; `PROVISIONAL_PASS` models
that domain reality. CRASH v1's `CONFORME/NO_CONFORME/PENDIENTE` is dropped. Non-conformances remain a
linked record (`nonconformances` table) with status `ABIERTA | EN_PROCESO | CERRADA` (Spanish labels are
accepted by the domain).

**UI copy ruling (post-MVP feedback):** David did not understand the label "Aprobación Provisional"
("¿qué es eso?") nor the MVP's "PIN de conformidad". All user-facing labels must use plain construction
language — e.g. `PROVISIONAL_PASS` renders as **"Aprobado, pendiente resultado de laboratorio a 28 días"**.
Internal enum values stay in English; display text is a UI-layer concern with these exact strings.

### 2.6 Conflict 6 — Formwork/steel template codes (new ruling, v2.3)

The two formwork/steel template codes that looked like competing versions are **not a conflict to resolve**:
they are templates for **different element types** (structural vs. pavement), confirmed 16-Sep-2026. The
system selects the template by element type — no data migration, no version arbitration.

### 2.7 MVP feedback rulings (David, in-person MVP review ~20-Sep-2026)

David tested the MVP and the meeting recording changes the form model. These rulings are normative:

| # | Feedback | Ruling for this build |
|---|---|---|
| F1 | The digital protocol must BE the paper format — full checklist, item by item, with Cumple / No Cumple / No Aplica — not a 3–4 criterion summary | **Checklist templates as data** (Section 3.6): every activity renders its complete paper checklist. Only variable fields per instance: release date, partida, start/end chainage |
| F2 | Slump is a discrete selector, not a range input | `slump` is captured by **picking one of the allowed values** (3.5", 4", 4.5", 5" — union of WhatsApp 16-Sep and meeting 20-Sep). `criteria` stores `allowed_values` (list) instead of min/max for this field |
| F3 | Chainage and GPS are silent | Chainage lives inside the protocol format (start/end fields in the checklist header, prefilled from the schedule); GPS is captured automatically as photo/record metadata. Neither appears as a user-fillable field |
| F4 | Signatures: one box per signer, like the paper grid | Per-signatory signature boxes, each bound to a signer account (PIN). No single "Sign & Issue" button. Sign order: Quality (execution) → Quality (supervision) → Supervisor → Resident; Structures Specialist when applicable. Section 3.7 |
| F5 | "Información del Contrato" → "Información General del Proyecto"; technical criteria move out | Project setup screen shows only: obra name, contract number, entity, project type (road/building), tramo. f'c and slump live in the internal `criteria` config, never on that screen |
| F6 | Team section feeds the PDF signature boxes | `technicians` rows are rendered into the signature grid of the generated PDF by role |
| F7 | David did not understand "Aprobación Provisional" | UI copy ruling above (Section 2.5). Same for "PIN de conformidad" — replace with plain language |
| F8 | Stamps (sellos) — unresolved, our technical call | Proposal to evaluate with Snehil: store a stamp image per signer (same flow as signature image), rendered next to the signature box on the PDF. **Open decision — not blocking** |
| F9 | Accounts per signer | Each signer gets an account to validate from their phone ("una sola clave… para que tengan acceso y para que firmen"); execution-quality and supervision-quality validate in the same instant |
| F10 | NC is its own format with photos | Non-conformance form: description + photos + notification (already R2). David raised a possible standalone NC-only app — keep NC strong inside this MVP, do not split the product now |
| F11 | Dossier = complete legajo | Dossier compiles: all protocols + all NCs + all lab reports (cylinder breaks, field density tests). Already the `GET /projects/{id}/dossier` contract |
| F12 | Guía number per mixer per day | Every mixer load entering that day logs its guía de despacho — already modeled as `mixer_loads.delivery_note` (Section 2.3); now explicit per-day scope |

---

## 3. Backend & Data Schema (Supabase / PostgreSQL)

### 3.1 Guiding constraints

- All timestamps: **UTC with explicit offset**, never client-supplied without a server receipt timestamp
  alongside it (R6).
- Records are **append-only** with an `integrity_hash`. Corrections = new linked record, never overwrite
  (R7).
- Photo references: **opaque storage keys** resolved to URLs at read time. Never persist vendor URLs
  inside immutable records (Irreversible Decision #4).
- Identity: technician **PIN (hashed) + persistent device token** issued once per device. Store
  device + PIN + GPS + hash on every record (Irreversible Decision #3).
- Criteria are **data** (Irreversible Decision #1, Section 2.4).
- Multi-project: Phase 0 is single-project hardcoded, but every entity carries `project_id` so
  aggregation is not expensive later.
- **PPI semantics (domain rule):** every protocol is a PPI point — a **hold point** (requires external
  sign-off before work proceeds) or a **witness point** (internal check only). Model this as a flag on the
  protocol/criteria row; the release chain per element (e.g. column: Steel → Formwork → Concrete; wall adds
  Survey) is enforced by this flag.

### 3.2 Tables

```sql
-- Core entities
create table projects (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  contract_number   text,
  entity            text,          -- e.g. "Gobierno Regional de Ayacucho"
  execution_mode    text,          -- 'administracion_directa'
  created_at        timestamptz default now()
);

create table technicians (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references projects(id),
  name              text not null,
  pin_hash          text not null,
  device_token      text unique,   -- issued once per device
  whatsapp          text,
  role              text not null, -- TECNICO_CAMPO | ESPECIALISTA_CALIDAD | RESIDENTE | SUPERVISOR | ...
  active            boolean default true
);

create table criteria (            -- dynamic parameter storage (Section 2.4)
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references projects(id),
  activity          text not null, -- SURVEY | STEEL | FORMWORK | CONCRETE | COMPACTION
  field             text not null, -- e.g. 'slump', 'compaction_pct'
  operator          text not null, -- 'between' | 'gte' | 'lte' | 'eq' | 'in'
  min_value         numeric,
  max_value         numeric,
  allowed_values    jsonb,          -- for operator 'in': e.g. ["3.5","4","4.5","5"] (slump selector, F2)
  source_reference  text,          -- e.g. 'EG-2013', 'PAC EVEREST_PAC_01', 'Quality Specialist 16-Sep-2026'
  hold_point        boolean default false,  -- PPI: hold (external sign-off) vs witness (internal check)
  valid_from        timestamptz default now()
);

create table checklist_templates ( -- paper-format checklist per activity (F1, Section 3.6)
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references projects(id),
  activity          text not null, -- SURVEY | STEEL | FORMWORK | CONCRETE | COMPACTION
  section           text,          -- checklist section header, e.g. '1. Materiales' (fixed, from the paper format)
  item_text         text not null, -- e.g. 'El acero instalado presenta certificado de calidad'
  item_order        int not null,
  applicable_if     text,          -- optional rule (e.g. element type) — null = always
  version           int default 1, -- checklist template versioning (append-only edits)
  active            boolean default true
);

create table protocol_checks (     -- technician's answer per checklist item (F1)
  id                uuid primary key default gen_random_uuid(),
  protocol_id       uuid references protocols(id) not null,
  template_item_id  uuid references checklist_templates(id) not null,
  result            text not null,          -- CUMPLE | NO_CUMPLE | NO_APLICA
  observation       text,                   -- free text, esp. required when NO_CUMPLE
  created_at        timestamptz default now()
);

create table protocols (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references projects(id),
  activity          text not null, -- SURVEY | STEEL | FORMWORK | CONCRETE
  recorded_at       timestamptz not null,        -- field event, UTC with offset
  server_received_at timestamptz not null,       -- server receipt, always stored (R6)
  gps_lat           numeric,
  gps_lng           numeric,
  panel             text,          -- paño number
  chainage          text,          -- progresiva, e.g. '0+144'
  element           text,          -- structure, e.g. 'MURO C.A. 13-1' (from the cylinder template)
  subcontractor_id  uuid,          -- nullable; set when the protocol belongs to a subcontractor scope
  measurements      jsonb not null,            -- activity-specific payload (Section 3.3)
  verdict           text not null,             -- PASS | PROVISIONAL_PASS | FAIL
  technician_id     uuid references technicians(id),
  device_token      text,                       -- denormalized for audit
  integrity_hash    text not null,
  pdf_key           text,                       -- opaque storage key for generated PDF
  created_at        timestamptz default now(),
  -- append-only enforced by application layer + RLS
  unique (id)
);

create table mixer_loads (         -- per-mixer/batch sampling (Section 2.3)
  id                uuid primary key default gen_random_uuid(),
  protocol_id       uuid references protocols(id) not null,
  mixer_id          text not null,          -- truck plate/ID, e.g. '6D37'
  delivery_note     text,                   -- guía de despacho (legal document)
  slump             text,                   -- discrete selected value: "3.5" | "4" | "4.5" | "5" (inches, F2)
  supplier          text default 'Concreto Titan',
  created_at        timestamptz default now()
);

create table cylinders (
  id                uuid primary key default gen_random_uuid(),
  protocol_id       uuid references protocols(id),
  mixer_load_id     uuid references mixer_loads(id),
  cylinder_code     text not null,          -- e.g. 'P-2026-0847-A'
  cast_date         date,
  test_date         date,
  age_days          int,                    -- 7 | 28
  strength_kgcm2    numeric,
  lab               text,                   -- 'AKHISE'
  report_photo_key  text,
  created_at        timestamptz default now()
);

create table nonconformances (
  id                uuid primary key default gen_random_uuid(),
  protocol_id       uuid references protocols(id),
  description       text not null,
  status            text default 'ABIERTA', -- ABIERTA | EN_PROCESO | CERRADA
  corrective_action text,
  closed_at         timestamptz
);

create table photos (
  id                uuid primary key default gen_random_uuid(),
  protocol_id       uuid references protocols(id),
  storage_key       text not null,          -- opaque, resolves to URL at read time
  gps_lat           numeric,
  gps_lng           numeric,
  captured_at       timestamptz not null,   -- device capture time (UTC + offset)
  hash              text not null,          -- SHA-256 of file bytes
  content_type      text,
  created_at        timestamptz default now()
);

create table signatures (          -- signature storage: one box per signer (F4, Section 3.7)
  id                uuid primary key default gen_random_uuid(),
  protocol_id       uuid references protocols(id) not null,
  signatory_id      uuid references technicians(id), -- the account that signed (F9)
  signatory_name    text not null,
  role              text not null,          -- from the 5+4 team structure
  sign_order        int not null,           -- 1 Quality(exec) → 2 Quality(sup) → 3 Supervisor → 4 Resident → 5 Structures
  cip_number        text,                   -- Peruvian engineering license, e.g. 'CIP 302775'
  status            text default 'PENDING', -- PENDING | SIGNED | EXEMPT
  signed_at         timestamptz,
  signature_key     text,                   -- opaque key for signature image/PDF stamp
  stamp_key         text                    -- opaque key for sello (stamp) image (F8, open decision)
);

create table cement_log (          -- digitized handwritten cement tracking (Section 4.2)
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references projects(id),
  element           text not null,          -- 'MURO PANTALLA', 'ZAPATA', ...
  log_date          date not null,
  bags              numeric,
  source_photo_key  text,                   -- photo of the handwritten page
  entered_by        uuid references technicians(id),
  reviewed_by       uuid references technicians(id),  -- null = pending review
  created_at        timestamptz default now()
);

create table sync_queue (          -- offline protocol release (Section 3.5)
  id                uuid primary key default gen_random_uuid(),
  client_ref        text unique,            -- client-generated idempotency key
  device_token      text not null,
  payload           jsonb not null,         -- full protocol submission as captured offline
  status            text default 'PENDING', -- PENDING | PROCESSED | REJECTED | DUPLICATE
  attempts          int default 0,
  last_error        text,
  created_at        timestamptz default now(),
  processed_at      timestamptz
);

create table notifications (
  id                uuid primary key default gen_random_uuid(),
  recipient         text not null,          -- WhatsApp number
  event_type        text not null,          -- PROTOCOL_COMPLETED | NC_OPENED | OVERDUE | DAILY_SUMMARY
  payload           jsonb,
  status            text default 'QUEUED',  -- QUEUED | SENT | FAILED
  sent_at           timestamptz
);
```

### 3.3 JSONB payloads (activity-specific)

```jsonc
// protocols.measurements for activity=CONCRETE
{
  "design_fc": 210,                 // 140 | 175 | 210 | 245 | 280 kg/cm2 per partida (internal config, F5)
  "truck_count": 3,                 // mixer_loads rows follow (one guía + one slump per mixer, F12)
  "chainage_from": "0+144",         // prefilled from the schedule — silent, not user-typed (F3)
  "chainage_to":   "0+216"
}
// mixer_loads rows for CONCRETE (per truck, per day):
// { "mixer_id": "6D37", "delivery_note": "GR-00412", "slump": "4", "cylinders_cast": 4 }
//  → slump is a SELECTED discrete value, not a number in range (F2)

// protocols.measurements for activity=SURVEY
{ "elevation_deviation_cm": 0.8, "chainage_from": "0+144", "chainage_to": "0+216" }
// protocols.measurements for activity=STEEL
{ "bar_diameter_mm": 12, "bar_spacing_cm": 20, "concrete_cover_cm": 5 }
// protocols.measurements for activity=FORMWORK
{ "panel": "15", "chainage_from": "0+144", "chainage_to": "0+216" }
// protocols.measurements for activity=COMPACTION
{ "compaction_pct": 101.4, "moisture_deviation": 0.9, "thickness_cm": 22 }
```

`criteria` rows seed these validations as data (see `PROTOCOLOS.md` §5 for the thresholds):
slump as `operator='in'` with `allowed_values ["3.5","4","4.5","5"]` (discrete selector, F2 — supersedes
the 8.9–12.7 range); f'c per partida; 4 cylinders per mixer; compaction ≥100% Modified Proctor; moisture
±1.5%; sub-base ≥20 cm; base ≥25 cm; survey ≤1 cm; steel per structural drawing.

The checklist items themselves (paper-format, F1) live in `checklist_templates` / `protocol_checks`
(Section 3.6), NOT in `criteria`: `criteria` holds machine-checkable thresholds (slump values, compaction
%, tolerances); the checklist holds the human verification items with Cumple / No Cumple / No Aplica.

**Confirmed real f'c values (16-Sep-2026):** 280 kg/cm² for pavement, 210 kg/cm² for walls/culverts.
The general per-partida list is 140 / 175 / 210 / 245 / 280 — all loaded as `criteria` data rows keyed by
element/partida, never as code constants.

### 3.4 Signature storage

The pilot's real roster (confirmed 16-Sep-2026 from six signed field protocols) defines the signature
rows per protocol type:

- **Execution team:** Site Resident (Ing. Edison Cuadros García, CIP 302775), Quality Specialist
  (David Valdez Ochoa), plus Soil/Safety/Assistant roles as configured.
- **Supervision team:** Supervisor (Ing. Teodoro Manuel Huamancusi Quispe, CIP 53548), Structures
  Specialist (Ing. Roly Conocachi Huamaní, CIP 76843 — only for bridge/reinforced concrete elements),
  Quality Specialist — supervision side (Ing. Cristian Manuel Torres Salinas, CIP 260873).
- Protocols must support **subcontractor scope**: a protocol can be tied to a subcontractor (e.g.,
  sub-base supply) whose own Quality Specialist signs. Modeled via `protocols.subcontractor_id`.

Phase 0 stores signatory metadata and status; wet signatures remain on the generated PDF. No crypto
signing in Phase 0 — but every `signatures` row is append-only and referenced by the protocol's
integrity chain. **The per-signer box UI, sign order, and hold-point gating are specified in Section 3.7** —
this roster is the data that populates those boxes (F4/F6).

### 3.5 Offline protocol release & sync logic

Requirements (from the field behavior documented in `CHAT_GCALIDAD_RESUMEN.md`):

1. **Queue locally (PWA)** — submission is stored in IndexedDB with a client-generated `client_ref`
   (UUID) and full payload; UI confirms "queued" state.
2. **Sync when signal returns** — retry with exponential backoff; no user action required (R3).
3. **Idempotency** — `sync_queue.client_ref` unique: a replayed batch returns `DUPLICATE`, never a
   second protocol.
4. **Ordering** — the server orders by `recorded_at` (field event) with `server_received_at` as
   tiebreaker. Multiple technicians submitting offline the same day is the expected case; the release
   sequence per panel is enforced at validation time, not at insertion time.
5. **Validation on arrival** — every queued payload is validated against `criteria`; failures open
   `nonconformances` and notify (R2, ≤60 s after processing).
6. **Conflict policy** — two submissions for the same panel+activity+date: the first accepted wins;
   the second is flagged for the Quality Specialist, never silently overwritten (R7).
7. **Photos first** — evidence photos sync before the protocol batch that references them (Section
   4.3.3); a batch with unresolved `photo_ids` is rejected and retried after the photo uploads complete.

### 3.6 Protocol form model — the paper-format checklist (F1, F3)

The MVP was rejected because its form was a 3–4 criterion summary. The digital protocol must **be** the
paper format. Implementation model:

1. **`checklist_templates` = the paper checklist, loaded as data.** One row per item per activity
   (`section` + `item_text` + `item_order`), e.g. for STEEL: "El acero instalado presenta certificado de
   calidad", "Los diámetros de acero son los indicados en los planos", "Las intersecciones están aseguradas
   con alambre de amarra". Seeded from the real Excel/paper formats we already hold (GR-PROBETA plantilla,
   the signed protocols). Template rows are append-only with `version` — edits create a new version,
   never mutate a released checklist.
2. **`protocol_checks` = the technician's answer per item** — `CUMPLE | NO_CUMPLE | NO_APLICA` + optional
   observation. `NO_CUMPLE` without observation is allowed but flagged; any `NO_CUMPLE` opens the NC
   workflow (F10).
3. **Per-instance variable fields are only:** release date, partida, chainage from/to (F3). Chainage is
   prefilled from the pour schedule (the existing Cronograma_Progresivas data); the user does not type it.
   GPS is never a visible field — it rides along as photo/record metadata (R9).
4. **Rendering:** the PWA renders the template in the same visual order as the paper format (sections,
   numbered items, three-state answer buttons). The generated PDF mirrors the same layout — the protocol
   IS the paper, not a summary of it.
5. **Machine criteria vs. checklist:** `criteria` (thresholds like slump values, compaction %) run
   automatically and drive the verdict/NC. `protocol_checks` are the human verifications. Both are stored;
   the PDF shows the checklist; the API response `checks[]` reports the machine criteria.

### 3.7 Signature grid — one box per signer (F4, F6, F8, F9)

Replaces any single "sign & issue" action:

1. **Roster-driven boxes.** When a protocol is created, the server generates one `signatures` row per
   applicable signer from the configured team (Section 3.4 roster), in `sign_order`:
   Quality (execution) → Quality (supervision) → Supervisor → Resident → Structures Specialist (only for
   bridge/reinforced-concrete elements). Subcontractor scope substitutes the subcontractor's own Quality
   Specialist (Section 3.4).
2. **Each signer signs their own box** from their own account: the signer authenticates with their
   account/PIN, reviews the protocol (same checklist view), and taps their own box. The signature is bound
   to `technicians.id` + PIN + timestamp — never one person signing for another (F9: execution-quality and
   supervision-quality each validate "ese mismo instante").
3. **PDF output renders the grid** exactly like the paper: one rectangle per signer with name, CIP,
   signature image, and sello/stamp if configured (F8 — stamp upload is an open decision; model supports a
   `stamp_key`, the storage flow is the same as signature images).
4. **Release semantics (hold point).** The next layer/activity cannot proceed while required signature
   boxes remain `PENDING` — this is the digital equivalent of David's rule: "cuando no está conforme, yo
   no puedo firmar" and the inspection can stop the work until the NC is resolved.

---

## 4. Handwritten Note & Photo Module Specs

### 4.1 Photo upload metadata (mandatory per photo — R9)

Every photo captured in the PWA must store, **independently of the image file**:

| Field | Requirement |
|---|---|
| `gps_lat` / `gps_lng` | From device geolocation at capture time; null rejected for evidence photos |
| `captured_at` | Device capture timestamp, UTC with explicit offset (never assumed) |
| `hash` | SHA-256 of file bytes, computed client-side and re-verified server-side |
| `technician_id` + `device_token` | Identity chain (Irreversible Decision #3) |
| `protocol_id` (or null for orphan/standalone) | Linkage to the quality record |
| `content_type` + byte size | Server-side sanity checks (e.g., ≤10 MB, image/* only) |
| Board/context rule | For slump and cylinder photos the board (pizarra) with panel, chainage and date must be visible — this is a field convention, not a code check |

Server behavior: store blob under an **opaque key** (`ph_...`), resolve to signed URLs only at read time,
append `photos` row with the integrity hash, never allow mutation of a persisted photo row.

### 4.2 Handwritten note digitization (cement log and field notes)

The field currently keeps paper records that CRASH must absorb (`ANALISIS_VISUAL_OBRA.md`):
cement-consumption pages per element ("MURO PANTALLA", "ZAPATA"), wall elevation sketches, and
miscellaneous notes.

Phase 0 scope — a **digitization capture form**, not OCR:

1. Technician photographs the page (photo module metadata applies).
2. Enters structured fields: `element`, `log_date`, `bags` (numeric), optional free-text `notes`.
3. The photo + row land in `cement_log` with `reviewed_by = null`.
4. The Quality Specialist reviews pending rows (status view) and confirms/corrects — reviewed rows are
   excluded from edit, corrections append a new row.
5. Rationale: OCR of handwritten Quechua/Spanish field notes is unreliable; the human-review gate keeps
   the table trustworthy (same principle as the escalation gate).

This directly supports the cement-tracking evidence David already demands (muro 8-9 f'c 175 kg/cm²
incident, unlabeled cylinders) and matches the `INGRESO DE CONCRETO PREMEZCLADO TITAN.xlsx` fields
(plate, order, volume) for supplier reconciliation.

### 4.3 Storage pipeline — Supabase Storage buckets and image lifecycle

#### 4.3.1 Bucket configuration (Supabase Storage)

| Bucket | Content | Visibility | Access path |
|---|---|---|---|
| `evidence` | Evidence photos (`ph_...` keys), lab report scans | **Private** (never public) | Backend resolves opaque key → signed URL, short TTL (e.g., 15 min) at read time |
| `outputs` | Generated artifacts: protocol PDFs (`pdf_key`), dossier packages | **Private** | Same signed-URL resolution |

Configuration rules:

1. **No public buckets, ever.** Evidence is legally sensitive; a public bucket would leak photo URLs into
   the field by accident. Row-Level Security on Storage is enforced at the bucket level; the PWA never
   receives Supabase Storage credentials — it only ever gets **pre-signed upload URLs** or posts through
   the backend.
2. **Opaque keys = storage object paths.** The `storage_key` stored in the database IS the object path
   inside the bucket (`evidence/ph_a91c…/original.jpg`). Do not store provider URLs, bucket names, or
   signed URLs in any record (Irreversible Decision #4). Resolve to a URL only at read time.
3. **Immutable objects.** Objects are write-once: no overwrite endpoint. A correction uploads a new object
   with a new key, linked to the old one in the database (R7).
4. **Retention is 7+ years** (legal requirement, Civil Code Art. 1784). Enable bucket versioning/lifecycle
   lock where the provider allows; backup the storage layer with the database in the same restore plan.

#### 4.3.2 Upload paths (two supported, one chosen per deploy)

- **Path A — backend proxy (`POST /photos`, multipart):** the PWA posts image bytes + metadata JSON to the
  backend; the backend validates metadata, re-computes SHA-256, stores the blob under an opaque key, and
  inserts the `photos` row. Simplest; acceptable for pilot volumes (photos compressed to ≤1 MB).
- **Path B — pre-signed upload (chosen for weak-signal sites):** `POST /photos/upload-url` returns a
  one-shot pre-signed URL for a key derived server-side; the PWA PUTs the bytes directly to Storage, then
  calls `POST /photos/confirm` with `{storage_key, gps, captured_at, hash, device_token, client_ref}`.
  The `confirm` step is mandatory — an unconfirmed object is not evidence and is garbage-collected
  (orphan sweep, daily job).

Phase 0 default: **Path A** unless field testing shows upload timeouts on site; the `client_ref`
idempotency contract is identical in both paths.

#### 4.3.3 Offline upload strategy (photos captured with no signal)

Photos are captured on the device and must survive offline exactly like protocol submissions:

1. **Local queue (IndexedDB):** each photo is stored as a blob + pending metadata with a client-generated
   `client_ref` (UUID) and its SHA-256 hash, **compressed to ≤1 MB before queueing** (field uplinks are
   slow; 5 MB originals are resized client-side; original dimensions/resolution noted in metadata).
2. **Sync order — photos first, then the protocol batch:** when connectivity returns, the PWA uploads all
   pending photos (`POST /photos` or Path B) and only then submits the `POST /sync/batch` payload. The
   batch references photos by `photo_id`/`storage_key`; the server **rejects a batch that references an
   unknown photo key** (`REJECTED` with `last_error = "unknown_photo_ref"`), which the client retries
   after completing photo uploads. This guarantees a protocol can never be persisted without its evidence.
3. **Idempotency for photos:** the `client_ref` is unique; a replayed upload returns the existing
   `photo_id` instead of duplicating the object. As a second guard, the server dedupes on `hash` within
   the same protocol scope.
4. **Failure handling:** photos that fail to upload stay queued and are retried with exponential backoff
   before the protocol batch is attempted; the PWA shows a per-item sync indicator (queued / uploading /
   synced / rejected).

#### 4.3.4 Image ↔ record relationships (who references what)

| Reference | From | To | Meaning |
|---|---|---|---|
| `photos.protocol_id` | `photos` | `protocols` | Evidence photo of a specific protocol (slump photo, poured panel, steel placement) |
| `protocols.photo_ids` (request payload) | `protocols` | `photos` | The list of evidence photos submitted with the protocol — must all exist server-side before the protocol persists |
| `cylinders.report_photo_key` | `cylinders` | `evidence` object | Photo/scan of the lab break report (7/28-day result) |
| `cement_log.source_photo_key` | `cement_log` | `evidence` object | Photo of the handwritten notebook page being digitized |
| `protocols.pdf_key` | `protocols` | `outputs` object | Generated protocol PDF |
| Dossier package | `GET /projects/{id}/dossier` | `outputs` object | Compiled dossier PDF; references every protocol PDF + evidence photo by key, not by URL |

Server-side integrity rule: every persisted `photos` row must have a resolvable object in `evidence`, and
every `report_photo_key` / `source_photo_key` / `pdf_key` must resolve in its bucket. The status view can
surface "missing object" as a data-health flag; the dossier endpoint refuses to compile with unresolved
keys (returns the list of missing keys).

#### 4.3.5 API surface (image endpoints)

```jsonc
// POST /photos  (Path A; metadata as multipart form fields)
// → 201 { "photo_id": "ph_a91c…", "storage_key": "evidence/ph_a91c…/original.jpg" }
// → 409 on duplicate client_ref, returning the existing photo_id

// POST /photos/upload-url  (Path B)
// Request:  { "content_type": "image/jpeg", "byte_size": 850_000, "client_ref": "ph-q-8f3a…" }
// Response: { "storage_key": "evidence/ph_a91c…/original.jpg", "upload_url": "https://…", "expires_in": 300 }

// POST /photos/confirm  (Path B, after PUT to upload_url)
// Request:  { "storage_key": "evidence/ph_a91c…/original.jpg", "client_ref": "ph-q-8f3a…",
//             "gps": {"lat":-13.1588,"lng":-74.2236}, "captured_at": "2026-09-11T08:45:00-05:00",
//             "hash": "sha256:…", "device_token": "dvc_8f3a…" }
// Response: { "photo_id": "ph_a91c…" }

// GET /photos/{id}  → 302 to a signed URL (15 min TTL) — the only way to read an evidence photo
```

`POST /protocols` and `POST /sync/batch` validate `photo_ids` against the `photos` table before
persisting; `POST /protocols/{id}/cylinder-result` validates `report_photo_id` the same way.

---

## 5. Snehil's Action Plan & Prioritized Task List

Build order below. Each item is a Definition-of-Done unit: deployed, reachable by link, meets its
acceptance criterion, tested by Kenny on a real phone, decision recorded in the repo.

### Phase A — Foundation (Week 1)

1. [ ] **Provision Supabase project** — PostgreSQL, Row-Level Security off for pilot simplicity
       (single trusted backend), backups on.
2. [ ] **Migration 001** — create all tables in Section 3.2 (projects → notifications), including
       `checklist_templates`, `protocol_checks`, `criteria.allowed_values`, `signatures.sign_order` /
       `signatory_id` / `stamp_key`, and `subcontractor_id`.
3. [ ] **Migration 002** — seed `projects` (AY-728-001), seed `criteria` (slump as `operator='in'`
       with `allowed_values ["3.5","4","4.5","5"]`, f'c 280/210 included), and seed
       **`checklist_templates` from the real paper formats** (GR-PROBETA plantilla + the six signed
       protocols) for the 5 activities. Never seed these in application code.
4. [ ] **`POST /protocols`** — validate against `criteria`, create `protocol_checks` rows, compute
       `integrity_hash`, insert `protocols`, open `nonconformances` on failure, return verdict + checks
       array (v2.4 contract §8.1; adapt fields to the 5-activity chain).
5. [ ] **Photo pipeline (§4.3)** — provision buckets `evidence` + `outputs` (private, write-once, 7-year
       retention), implement `POST /photos` (Path A), enforce Section 4.1 metadata; opaque keys resolved
       via signed URLs at read time.
6. [ ] **PWA shell (React + Vite + Tailwind)** — installable, Service Worker for offline shell, PIN
       entry, silent GPS capture (F3), home screen with the 5 activities in site order
       (COMPACTACIÓN / TOPOGRAFÍA / ACERO / ENCOFRADO / CONCRETO).

### Phase B — Field-priority protocols: Survey, Formwork, Concrete (Week 2)

> David's priority (~20-Sep): the project is starting pavement and ends Sep–Nov 2026 — these three must be
> testable first; Compaction and Steel follow.

7. [ ] **Checklist renderer (F1, R11)** — render `checklist_templates` in paper order with
       Cumple / No Cumple / No Aplica buttons + observation field; per-instance header shows only release
       date, partida, chainage from/to (prefilled, silent). This is the core of the redesign.
8. [ ] **Concrete form** — truck-list UX (one guía + one slump selector + 4 cylinders per mixer row, F2/F12),
       photo capture with board rule, offline queue (IndexedDB + `client_ref`).
9. [ ] **Formwork form + Survey form** — each with its own full paper-format checklist (F1).
10. [ ] **`POST /protocols/{id}/cylinder-result`** — deferred 7/28-day flow; converts
        `PROVISIONAL_PASS` → `PASS` or opens NC when strength < design f'c (R4, R5).
11. [ ] **Sync service** — `POST /sync/batch` consuming `sync_queue`; idempotency, backoff, ordering,
        conflict policy (Section 3.5); enforces **photos-first** ordering (Section 4.3.3) and rejects
        batches with unresolved `photo_ids`.
12. [ ] **PDF generation (R8, R11)** — protocol PDF that mirrors the paper layout: full checklist with
        answers, values, photos, chainage, and the **signature grid** (Section 3.7). Use the GR-PROBETA /
        signed-protocol structure as the reference layout.
13. [ ] **WhatsApp notifications** — protocol completed, NC opened, overdue >4 h, daily 19:00 summary
        (R2, R10). WhatsApp Business API; capture channel remains the PWA.

### Phase C — Signature grid, remaining activities + status view (Week 3)

14. [ ] **Signature grid + signer accounts (F4, F6, F9, R13)** — auto-create `signatures` rows per
        protocol in `sign_order`; per-signer account login (PIN), tap-your-own-box signing, hold-point
        release gating (Section 3.7). Evaluate the sello/stamp upload decision (F8) and record it as an ADR.
15. [ ] **UI copy pass (F7)** — replace "Aprobación Provisional" with "Aprobado, pendiente resultado de
        laboratorio a 28 días"; plain-language labels everywhere (no "PIN de conformidad").
16. [ ] **Compaction + Steel forms** — with their own paper-format checklists (F1) and criteria
        validations (compaction ≥100%, spacing/cover per drawing).
17. [ ] **`GET /projects/{id}/status`** — release state per panel across the 5-activity chain;
        aggregate summary (passed/provisional/failed/missing).
18. [ ] **Google Sheets sync** — Apps Script or scheduled backend job writing the status view David
        already uses.
19. [ ] **Cement log module** — digitization form + review gate (Section 4.2).
20. [ ] **`GET /projects/{id}/dossier`** — compile protocols, checklist answers, photos, cylinders, NCs,
        lab reports into the dossier package (F11: the complete legajo). Design the export structure
        INFOBRAS-compatible; do not build the INFOBRAS integration.

### Phase D — Field trial and hardening (Week 4)

21. [ ] **Acceptance criteria sweep** — R1–R14, with emphasis on R11 (paper-format checklist), R12
        (slump selector), R13 (signature grid), R14 (silent GPS/progresiva).
22. [ ] **Field test with the real crew** (Totora-Yanamilla) — Kenny on site; David presents the
        corrected version ("entre hoy y mañana" cadence); capture adoption data before the project closes.
23. [ ] **Pilot metrics** — adoption ≥80%, ≤5 min/protocol, ≤10% invalid records, ≥1 real NC detected.
24. [ ] **Second-project probe** — check fit with the Juan Caulica project (pistas y veredas) and building
        works (edificación); confirm the checklist-template-as-data model adapts (F1 standardizes per
        project, per David: "cada proyecto es diferente").

---

## 6. Decision Gates and Kill Criteria (from Audits I–III)

Not build scope — these govern whether the build starts, continues, or stops.

### 6.1 Pre-build gates (must be cleared before Week 1)

1. Equity conversation with Snehil (percentage, vesting, code ownership) — before this spec is considered sent.
2. Interview 3 field technicians on why they do NOT fill protocols today. If the answer is time/incentive
   rather than tool friction, the capture-first Phase 0 is wrong → switch to the compilation-first
   alternative (Section 6.3).
3. Confirm the pilot project's real closure date with David (53% physical progress). If <3 months remain,
   cut Phase 0 scope in half.
4. Written confirmation from David that this project is independent of his employer IADATA PERÚ
   (which runs its own "Digitalización de Protocolos de Calidad" project).
5. Data-protection compliance already enforceable in Peru: privacy notice in the PWA before first use,
   technician consent for location/image processing, documented retention policy, ANPDP database
   registration (Ley 29733 + D.S. 016-2024-JUS; fines up to 100 UIT. If AI is used for validation:
   Ley 31814 + D.S. 115-2025-PCM).

### 6.2 Kill criteria (written in advance — Audit III §5)

| When | If this happens… | …then |
|---|---|---|
| Pre-build | The 3 technicians say the problem is time/incentive, not tooling | Switch to compilation-first Phase 0 or re-scope the product |
| Pre-build | David cannot confirm written independence from his employer | Pause. Do not build on an ambiguous legal base |
| Week 2 | Snehil has not deployed anything reachable by link | Reassess his real availability |
| Week 4 | <40% of expected protocols are filled through the tool | The channel was not the problem → pivot to compilation or kill |
| Week 6 | Nobody made a purchase gesture or introduced PROTOKOL to another project | There is no business, there is a favor. Decide to continue or stop |
| Month 3 | The pilot project closed with no second customer identified | PROTOKOL was a project, not a company. Close it cleanly |

### 6.3 Compilation-first alternative (Audit III §4)

A Phase 0 alternative: take what **already arrives via WhatsApp** (photos, slumps, densities) and compile
it into structured protocols + dossier for David. One user, 1–2 weeks, zero field behavior change,
immediate verifiable value. The capture-first route (this spec) is valid **only if** the technician
interviews confirm they would fill protocols with a better tool. This is Kenny's decision with David —
not yours to build both.

---

## 7. Open questions to answer before Week 2 ends (blockers)

- Hours per week available (determines whether Phase 0 is 4 or 10 weeks).
- Meta Business account status for WhatsApp API (verified account vs. tramitarla).
- Backend stack choice: Python/FastAPI or Java/Spring Boot (contracts are stack-agnostic).
- Railway/Render preference and estimated monthly cost (for the budget line).
- **Sello/stamp handling (F8)** — your call: stamp image uploaded per signer (same flow as signature
  image), rendered next to the signature box on the PDF, or deferred. Record the decision as an ADR.
- Confirm the schema and Section 2 rulings as written, or flag objections in the repo as decision records.

**To verify with David (Kenny, non-blocking):** the slump selector values — meeting said 3.5"/4"/4.5",
earlier WhatsApp included 5". Seed all four now (F2); confirm with David that 5" is valid or drop it.

**Already answered by you (16-Sep-2026):** the four irreversible decisions — agreed as written.
Future directions (Q7): the RAG assistant does not change Phase 0 architecture; the multi-project
direction only influences the relational model through project-scoped entities, no multi-project
functionality now.

---

*References: PRD_PROTOKOL.md, TECH_SPEC.md (PROTOKOL v2.4), CRASH_TECH_SPEC.md, PROTOCOLOS.md,
FEEDBACK_DAVID.md, CHAT_GCALIDAD_RESUMEN.md, EXPEDIENTE_CALIDAD.md, ANALISIS_VISUAL_OBRA.md,
docs/originales/CRASH_AUDITORIA_v1, PROTOKOL_AUDITORIA_II, PROTOKOL_AUDITORIA_III.*
