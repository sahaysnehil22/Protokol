import { DatabaseSync } from 'node:sqlite';

export function initializeSchema(db: DatabaseSync): void {
  db.exec(`
    -- 1. Projects Table
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contract_number TEXT NOT NULL,
      entity TEXT NOT NULL,
      execution_mode TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 2. Technicians Table
    CREATE TABLE IF NOT EXISTS technicians (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      device_token TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE INDEX IF NOT EXISTS idx_technicians_project ON technicians(project_id);
    CREATE INDEX IF NOT EXISTS idx_technicians_device ON technicians(device_token);

    -- 3. Criteria Table (Criteria as Data)
    CREATE TABLE IF NOT EXISTS criteria (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      activity TEXT NOT NULL, -- CONCRETE | SURVEY | COMPACTION | STEEL
      field TEXT NOT NULL,
      operator TEXT NOT NULL, -- BETWEEN | GTE | LTE | EQ
      min_value REAL,
      max_value REAL,
      expected_value TEXT,
      unit TEXT,
      source_reference TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE INDEX IF NOT EXISTS idx_criteria_lookup ON criteria(project_id, activity, field, is_active);

    -- 4. Photos Table (Decoupled Opaque Photo Storage)
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY, -- ph_...
      protocol_id TEXT,    -- Linked upon protocol submission
      storage_key TEXT NOT NULL,
      gps_lat REAL,
      gps_lng REAL,
      captured_at TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (protocol_id) REFERENCES protocols(id)
    );

    CREATE INDEX IF NOT EXISTS idx_photos_protocol ON photos(protocol_id);

    -- 5. Protocols Table (Central Immutable Artifact)
    CREATE TABLE IF NOT EXISTS protocols (
      id TEXT PRIMARY KEY, -- PRT-YYYYMMDD-HHMM-PANEL
      project_id TEXT NOT NULL,
      activity TEXT NOT NULL,
      recorded_at TEXT NOT NULL,       -- Client timestamp with explicit offset
      server_received_at TEXT NOT NULL, -- Server UTC timestamp
      timezone_offset TEXT NOT NULL,
      gps_lat REAL NOT NULL,
      gps_lng REAL NOT NULL,
      panel TEXT NOT NULL,
      chainage TEXT NOT NULL,
      measurements TEXT NOT NULL,      -- Deterministic JSON
      verdict TEXT NOT NULL,           -- PASS | PROVISIONAL_PASS | FAIL
      technician_id TEXT NOT NULL,
      device_token TEXT NOT NULL,
      integrity_hash TEXT NOT NULL,
      notes TEXT,
      supersedes_protocol_id TEXT,     -- Linked revision chain
      idempotency_key TEXT UNIQUE,     -- Offline sync duplicate prevention
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (technician_id) REFERENCES technicians(id),
      FOREIGN KEY (supersedes_protocol_id) REFERENCES protocols(id)
    );

    CREATE INDEX IF NOT EXISTS idx_protocols_project ON protocols(project_id);
    CREATE INDEX IF NOT EXISTS idx_protocols_activity ON protocols(activity);
    CREATE INDEX IF NOT EXISTS idx_protocols_chainage ON protocols(chainage, panel);

    -- Protocol Immutability Trigger: Prohibit modification of core data fields
    CREATE TRIGGER IF NOT EXISTS trg_protocols_immutability
    BEFORE UPDATE ON protocols
    FOR EACH ROW
    BEGIN
      -- Prevent alteration of core measurements, timestamps, GPS, or identity
      SELECT CASE
        WHEN OLD.id != NEW.id THEN
          RAISE(ABORT, 'IMMUTABILITY_VIOLATION: Cannot modify protocol ID')
        WHEN OLD.project_id != NEW.project_id THEN
          RAISE(ABORT, 'IMMUTABILITY_VIOLATION: Cannot modify project ID')
        WHEN OLD.activity != NEW.activity THEN
          RAISE(ABORT, 'IMMUTABILITY_VIOLATION: Cannot modify activity')
        WHEN OLD.recorded_at != NEW.recorded_at THEN
          RAISE(ABORT, 'IMMUTABILITY_VIOLATION: Cannot modify recorded_at timestamp')
        WHEN OLD.server_received_at != NEW.server_received_at THEN
          RAISE(ABORT, 'IMMUTABILITY_VIOLATION: Cannot modify server_received_at timestamp')
        WHEN OLD.gps_lat != NEW.gps_lat OR OLD.gps_lng != NEW.gps_lng THEN
          RAISE(ABORT, 'IMMUTABILITY_VIOLATION: Cannot modify GPS coordinates')
        WHEN OLD.panel != NEW.panel OR OLD.chainage != NEW.chainage THEN
          RAISE(ABORT, 'IMMUTABILITY_VIOLATION: Cannot modify panel or chainage')
        WHEN OLD.measurements != NEW.measurements THEN
          RAISE(ABORT, 'IMMUTABILITY_VIOLATION: Cannot modify measurements. Submit a new revision record.')
        WHEN OLD.technician_id != NEW.technician_id THEN
          RAISE(ABORT, 'IMMUTABILITY_VIOLATION: Cannot modify technician')
        WHEN OLD.integrity_hash != NEW.integrity_hash THEN
          RAISE(ABORT, 'IMMUTABILITY_VIOLATION: Cannot modify integrity hash')
        -- Only permit verdict change from PROVISIONAL_PASS to PASS or FAIL
        WHEN OLD.verdict != 'PROVISIONAL_PASS' AND OLD.verdict != NEW.verdict THEN
          RAISE(ABORT, 'IMMUTABILITY_VIOLATION: Cannot change finalized verdict')
      END;
    END;

    -- 6. Cylinders Table (Deferred Concrete Laboratory Tests)
    CREATE TABLE IF NOT EXISTS cylinders (
      id TEXT PRIMARY KEY,
      protocol_id TEXT NOT NULL,
      cylinder_code TEXT NOT NULL,
      cast_date TEXT NOT NULL,
      test_date TEXT,
      age_days INTEGER NOT NULL, -- 7 or 28
      strength_kgcm2 REAL,
      design_fc REAL NOT NULL,
      lab TEXT,
      report_photo_id TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | TESTED
      verdict TEXT, -- PASS | FAIL
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (protocol_id) REFERENCES protocols(id),
      FOREIGN KEY (report_photo_id) REFERENCES photos(id)
    );

    CREATE INDEX IF NOT EXISTS idx_cylinders_protocol ON cylinders(protocol_id);
    CREATE INDEX IF NOT EXISTS idx_cylinders_status ON cylinders(status);

    -- 7. Non-Conformances Table
    CREATE TABLE IF NOT EXISTS nonconformances (
      id TEXT PRIMARY KEY, -- NC-YYYYMMDD-...
      protocol_id TEXT NOT NULL,
      criterion_id TEXT,
      field TEXT NOT NULL,
      expected_value TEXT NOT NULL,
      actual_value TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN | CLOSED
      corrective_action TEXT,
      closed_at TEXT,
      closed_by_technician_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (protocol_id) REFERENCES protocols(id),
      FOREIGN KEY (criterion_id) REFERENCES criteria(id),
      FOREIGN KEY (closed_by_technician_id) REFERENCES technicians(id)
    );

    CREATE INDEX IF NOT EXISTS idx_nc_protocol ON nonconformances(protocol_id);
    CREATE INDEX IF NOT EXISTS idx_nc_status ON nonconformances(status);

    -- 8. Notifications Table
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      recipient TEXT NOT NULL,
      event_type TEXT NOT NULL, -- PROTOCOL_CREATED | NC_OPENED | CYLINDER_TESTED | OVERDUE
      payload TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL, -- SENT | PENDING | FAILED
      channel TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_project ON notifications(project_id);

    -- 9. Protocol Schedules Table (R10 Overdue Rule)
    CREATE TABLE IF NOT EXISTS protocol_schedules (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      activity TEXT NOT NULL,
      panel TEXT NOT NULL,
      chainage TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      notified_overdue_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE INDEX IF NOT EXISTS idx_schedules_overdue ON protocol_schedules(scheduled_at, notified_overdue_at);
  `);
}
