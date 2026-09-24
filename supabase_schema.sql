-- =====================================================================
-- PROTOKOL — Supabase PostgreSQL Production Schema
-- Technical Product Document v2.4 (September 2026)
-- Run this script in Supabase Dashboard -> SQL Editor -> Click "Run"
-- =====================================================================

-- 1. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contract_number TEXT NOT NULL,
    entity TEXT NOT NULL,
    execution_mode TEXT NOT NULL,
    location TEXT,
    road_section TEXT,
    timezone TEXT NOT NULL DEFAULT 'America/Lima',
    timezone_offset TEXT NOT NULL DEFAULT '-05:00',
    whatsapp_recipients TEXT,
    sampling_basis TEXT NOT NULL DEFAULT 'PER_TRUCK',
    cylinders_per_truck INTEGER NOT NULL DEFAULT 4,
    default_design_fc NUMERIC NOT NULL DEFAULT 210,
    metadata JSONB,
    updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Technicians Table (Team Roster)
CREATE TABLE IF NOT EXISTS technicians (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    device_token TEXT NOT NULL,
    whatsapp TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL,
    cip_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_technicians_project ON technicians(project_id);
CREATE INDEX IF NOT EXISTS idx_technicians_device ON technicians(device_token);

-- 3. Criteria Table (Criteria as Data)
CREATE TABLE IF NOT EXISTS criteria (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    activity TEXT NOT NULL, -- CONCRETE | SURVEY | COMPACTION | STEEL | FORMWORK
    field TEXT NOT NULL,
    operator TEXT NOT NULL, -- BETWEEN | GTE | LTE | EQ | IN
    min_value NUMERIC,
    max_value NUMERIC,
    allowed_values JSONB, -- Discrete allowed values: ["3.5","4","4.5","5"]
    expected_value TEXT,
    unit TEXT,
    source_reference TEXT NOT NULL,
    hold_point BOOLEAN NOT NULL DEFAULT FALSE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_criteria_project_activity ON criteria(project_id, activity);

-- 3.1 Checklist Templates Table (F1 Paper Format Checklist as Data)
CREATE TABLE IF NOT EXISTS checklist_templates (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    activity TEXT NOT NULL, -- CONCRETE | SURVEY | COMPACTION | STEEL | FORMWORK
    section TEXT NOT NULL,
    item_text TEXT NOT NULL,
    item_order INTEGER NOT NULL,
    applicable_if TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklist_templates ON checklist_templates(project_id, activity, item_order);

-- 3.2 Protocol Checks Table (Answers per checklist item)
CREATE TABLE IF NOT EXISTS protocol_checks (
    id TEXT PRIMARY KEY,
    protocol_id TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
    template_item_id TEXT NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
    result TEXT NOT NULL, -- CUMPLE | NO_CUMPLE | NO_APLICA
    observation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_protocol_checks ON protocol_checks(protocol_id, template_item_id);

-- 4. Photos Metadata Table (Opaque Identifiers)
CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    protocol_id TEXT,
    storage_key TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256_hash TEXT NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL,
    latitude NUMERIC,
    longitude NUMERIC,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photos_protocol ON photos(protocol_id);

-- 5. Protocols Table (Strictly Immutable Inspection Records)
CREATE TABLE IF NOT EXISTS protocols (
    id TEXT PRIMARY KEY, -- PRT-YYYYMMDD-HHMM-NNN
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    activity TEXT NOT NULL, -- CONCRETE | SURVEY | COMPACTION | STEEL | FORMWORK
    chainage TEXT NOT NULL,
    panel TEXT NOT NULL,
    verdict TEXT NOT NULL, -- PASS | FAIL | PROVISIONAL_PASS
    measurements JSONB NOT NULL,
    technician_id TEXT NOT NULL REFERENCES technicians(id),
    device_token TEXT NOT NULL,
    gps_lat NUMERIC NOT NULL,
    gps_lng NUMERIC NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    integrity_hash TEXT NOT NULL,
    pdf_key TEXT,
    subcontractor_id TEXT,
    supersedes_protocol_id TEXT REFERENCES protocols(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_protocols_project ON protocols(project_id);
CREATE INDEX IF NOT EXISTS idx_protocols_activity ON protocols(activity);
CREATE INDEX IF NOT EXISTS idx_protocols_chainage ON protocols(chainage);
CREATE INDEX IF NOT EXISTS idx_protocols_verdict ON protocols(verdict);

-- 5.1 Signatures Table (F4, F6, F8, F9 Signature Grid per Protocol)
CREATE TABLE IF NOT EXISTS signatures (
    id TEXT PRIMARY KEY,
    protocol_id TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
    signatory_id TEXT REFERENCES technicians(id),
    signatory_name TEXT NOT NULL,
    role TEXT NOT NULL,
    sign_order INTEGER NOT NULL,
    cip_number TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | SIGNED | EXEMPT
    signed_at TIMESTAMPTZ,
    signature_key TEXT,
    stamp_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signatures_protocol ON signatures(protocol_id, sign_order);

-- 6. Concrete Ready-Mix Trucks Table (v2.4 Multi-Truck Pour Architecture)
CREATE TABLE IF NOT EXISTS concrete_trucks (
    id TEXT PRIMARY KEY, -- trk_...
    protocol_id TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
    truck_number INTEGER NOT NULL,
    mixer_id TEXT NOT NULL,
    delivery_note TEXT NOT NULL,
    slump TEXT, -- Discrete selector: "3.5" | "4" | "4.5" | "5"
    slump_cm NUMERIC,
    supplier TEXT DEFAULT 'Concreto Titán',
    cylinders_cast INTEGER NOT NULL DEFAULT 4,
    design_fc NUMERIC NOT NULL,
    slump_verdict TEXT NOT NULL, -- PASS | FAIL
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_concrete_trucks_protocol ON concrete_trucks(protocol_id);
CREATE INDEX IF NOT EXISTS idx_concrete_trucks_mixer ON concrete_trucks(mixer_id);

-- 7. Cylinders Table (Deferred Compressive Strength Lab Tests)
CREATE TABLE IF NOT EXISTS cylinders (
    id TEXT PRIMARY KEY,
    protocol_id TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
    truck_id TEXT REFERENCES concrete_trucks(id) ON DELETE CASCADE,
    truck_number INTEGER,
    specimen_number INTEGER,
    cylinder_code TEXT NOT NULL,
    cast_date DATE NOT NULL,
    test_date DATE,
    age_days INTEGER NOT NULL, -- 7 or 28
    strength_kgcm2 NUMERIC,
    design_fc NUMERIC NOT NULL,
    lab TEXT,
    report_photo_id TEXT REFERENCES photos(id),
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | TESTED
    verdict TEXT, -- PASS | FAIL
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cylinders_protocol ON cylinders(protocol_id);
CREATE INDEX IF NOT EXISTS idx_cylinders_truck ON cylinders(truck_id);
CREATE INDEX IF NOT EXISTS idx_cylinders_status ON cylinders(status);

-- 8. Non-Conformances Table
CREATE TABLE IF NOT EXISTS nonconformances (
    id TEXT PRIMARY KEY, -- NC-YYYYMMDD-...
    protocol_id TEXT NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
    truck_id TEXT REFERENCES concrete_trucks(id) ON DELETE CASCADE,
    criterion_id TEXT REFERENCES criteria(id),
    field TEXT NOT NULL,
    expected_value TEXT NOT NULL,
    actual_value TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN | CLOSED
    corrective_action TEXT,
    closed_at TIMESTAMPTZ,
    closed_by_technician_id TEXT REFERENCES technicians(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nc_protocol ON nonconformances(protocol_id);
CREATE INDEX IF NOT EXISTS idx_nc_truck ON nonconformances(truck_id);
CREATE INDEX IF NOT EXISTS idx_nc_status ON nonconformances(status);

-- 9. Notifications Audit Table
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    recipient TEXT NOT NULL,
    event_type TEXT NOT NULL, -- PROTOCOL_CREATED | NC_OPENED | CYLINDER_TESTED | OVERDUE
    payload JSONB NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL, -- SENT | PENDING | FAILED
    channel TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_project ON notifications(project_id);

-- 10. Protocol Schedules Table (Overdue Detection Rule)
CREATE TABLE IF NOT EXISTS protocol_schedules (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    activity TEXT NOT NULL,
    chainage TEXT NOT NULL,
    panel TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notified_overdue_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_schedules_overdue ON protocol_schedules(scheduled_at, notified_overdue_at);

-- =====================================================================
-- 11. Immutability Trigger in PL/pgSQL
-- Protects persisted protocol records from unauthorized tampering.
-- Only permits legitimate transition: PROVISIONAL_PASS -> PASS or FAIL.
-- =====================================================================
CREATE OR REPLACE FUNCTION check_protocol_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.activity != NEW.activity THEN
        RAISE EXCEPTION 'IMMUTABILITY_VIOLATION: Cannot modify activity';
    END IF;
    IF OLD.panel != NEW.panel OR OLD.chainage != NEW.chainage THEN
        RAISE EXCEPTION 'IMMUTABILITY_VIOLATION: Cannot modify panel or chainage';
    END IF;
    IF OLD.measurements::text != NEW.measurements::text THEN
        RAISE EXCEPTION 'IMMUTABILITY_VIOLATION: Cannot modify measurements. Submit a new revision record.';
    END IF;
    IF OLD.technician_id != NEW.technician_id THEN
        RAISE EXCEPTION 'IMMUTABILITY_VIOLATION: Cannot modify technician';
    END IF;
    IF OLD.integrity_hash != NEW.integrity_hash THEN
        RAISE EXCEPTION 'IMMUTABILITY_VIOLATION: Cannot modify integrity hash';
    END IF;
    IF OLD.verdict != 'PROVISIONAL_PASS' AND OLD.verdict != NEW.verdict THEN
        RAISE EXCEPTION 'IMMUTABILITY_VIOLATION: Cannot change finalized verdict';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protocols_immutability ON protocols;
CREATE TRIGGER trg_protocols_immutability
BEFORE UPDATE ON protocols
FOR EACH ROW
EXECUTE FUNCTION check_protocol_immutability();
