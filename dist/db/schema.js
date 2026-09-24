/**
 * Initializes the database schema and performs safe migrations for existing tables.
 */
export function initializeSchema(db) {
    // First, run safe migrations for any preexisting tables so new columns exist
    runSafeMigrations(db);
    // Execute base tables creation
    db.exec(`
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
      default_design_fc REAL NOT NULL DEFAULT 210,
      metadata TEXT,
      updated_at TEXT,
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
      cip_number TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE INDEX IF NOT EXISTS idx_technicians_project ON technicians(project_id);
    CREATE INDEX IF NOT EXISTS idx_technicians_device ON technicians(device_token);

    -- 3. Criteria Table (Criteria as Data)
    CREATE TABLE IF NOT EXISTS criteria (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      activity TEXT NOT NULL, -- CONCRETE | SURVEY | COMPACTION | STEEL | FORMWORK
      field TEXT NOT NULL,
      operator TEXT NOT NULL, -- BETWEEN | GTE | LTE | EQ | IN
      min_value REAL,
      max_value REAL,
      allowed_values TEXT, -- JSON array of allowed discrete values, e.g. ["3.5","4","4.5","5"]
      expected_value TEXT,
      unit TEXT,
      source_reference TEXT NOT NULL,
      hold_point INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE INDEX IF NOT EXISTS idx_criteria_lookup ON criteria(project_id, activity, field, is_active);

    -- 3.1 Checklist Templates Table (F1 Paper Format Checklist as Data)
    CREATE TABLE IF NOT EXISTS checklist_templates (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      activity TEXT NOT NULL, -- CONCRETE | SURVEY | COMPACTION | STEEL | FORMWORK
      section TEXT NOT NULL,
      item_text TEXT NOT NULL,
      item_order INTEGER NOT NULL,
      applicable_if TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE INDEX IF NOT EXISTS idx_checklist_templates ON checklist_templates(project_id, activity, item_order);

    -- 3.2 Protocol Checks Table (Answers per checklist item)
    CREATE TABLE IF NOT EXISTS protocol_checks (
      id TEXT PRIMARY KEY,
      protocol_id TEXT NOT NULL,
      template_item_id TEXT NOT NULL,
      result TEXT NOT NULL, -- CUMPLE | NO_CUMPLE | NO_APLICA
      observation TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (protocol_id) REFERENCES protocols(id),
      FOREIGN KEY (template_item_id) REFERENCES checklist_templates(id)
    );

    CREATE INDEX IF NOT EXISTS idx_protocol_checks ON protocol_checks(protocol_id, template_item_id);

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
      pdf_key TEXT,
      subcontractor_id TEXT,
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

    -- 5.1 Signatures Table (F4, F6, F8, F9 Signature Grid per Protocol)
    CREATE TABLE IF NOT EXISTS signatures (
      id TEXT PRIMARY KEY,
      protocol_id TEXT NOT NULL,
      signatory_id TEXT,
      signatory_name TEXT NOT NULL,
      role TEXT NOT NULL,
      sign_order INTEGER NOT NULL,
      cip_number TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | SIGNED | EXEMPT
      signed_at TEXT,
      signature_key TEXT,
      stamp_key TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (protocol_id) REFERENCES protocols(id),
      FOREIGN KEY (signatory_id) REFERENCES technicians(id)
    );

    CREATE INDEX IF NOT EXISTS idx_signatures_protocol ON signatures(protocol_id, sign_order);

    -- 6. Concrete Trucks Table (v2.4 Multi-Truck Pour Architecture)
    CREATE TABLE IF NOT EXISTS concrete_trucks (
      id TEXT PRIMARY KEY, -- trk_...
      protocol_id TEXT NOT NULL,
      truck_number INTEGER NOT NULL,
      mixer_id TEXT NOT NULL,
      delivery_note TEXT NOT NULL,
      slump TEXT, -- discrete: "3.5" | "4" | "4.5" | "5"
      slump_cm REAL,
      supplier TEXT DEFAULT 'Concreto Titán',
      cylinders_cast INTEGER NOT NULL DEFAULT 4,
      design_fc REAL NOT NULL,
      slump_verdict TEXT NOT NULL, -- PASS | FAIL
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (protocol_id) REFERENCES protocols(id)
    );

    CREATE INDEX IF NOT EXISTS idx_concrete_trucks_protocol ON concrete_trucks(protocol_id);
    CREATE INDEX IF NOT EXISTS idx_concrete_trucks_mixer ON concrete_trucks(mixer_id);

    -- 7. Cylinders Table (Deferred Concrete Laboratory Tests)
    CREATE TABLE IF NOT EXISTS cylinders (
      id TEXT PRIMARY KEY,
      protocol_id TEXT NOT NULL,
      truck_id TEXT, -- References concrete_trucks(id)
      truck_number INTEGER,
      specimen_number INTEGER,
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
      FOREIGN KEY (truck_id) REFERENCES concrete_trucks(id),
      FOREIGN KEY (report_photo_id) REFERENCES photos(id)
    );

    CREATE INDEX IF NOT EXISTS idx_cylinders_protocol ON cylinders(protocol_id);
    CREATE INDEX IF NOT EXISTS idx_cylinders_truck ON cylinders(truck_id);
    CREATE INDEX IF NOT EXISTS idx_cylinders_status ON cylinders(status);

    -- 8. Non-Conformances Table
    CREATE TABLE IF NOT EXISTS nonconformances (
      id TEXT PRIMARY KEY, -- NC-YYYYMMDD-...
      protocol_id TEXT NOT NULL,
      truck_id TEXT,
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
      FOREIGN KEY (truck_id) REFERENCES concrete_trucks(id),
      FOREIGN KEY (criterion_id) REFERENCES criteria(id),
      FOREIGN KEY (closed_by_technician_id) REFERENCES technicians(id)
    );

    CREATE INDEX IF NOT EXISTS idx_nc_protocol ON nonconformances(protocol_id);
    CREATE INDEX IF NOT EXISTS idx_nc_truck ON nonconformances(truck_id);
    CREATE INDEX IF NOT EXISTS idx_nc_status ON nonconformances(status);

    -- 9. Notifications Table
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

    -- 10. Protocol Schedules Table (R10 Overdue Rule)
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
    // Safe migrations for preexisting databases
    runSafeMigrations(db);
}
/**
 * Safely adds new columns if they do not already exist in historical SQLite databases.
 */
function runSafeMigrations(db) {
    const getTableColumns = (table) => {
        try {
            const rows = db.prepare(`PRAGMA table_info(${table})`).all();
            return new Set(rows.map(r => r.name));
        }
        catch {
            return new Set();
        }
    };
    // Projects table migrations
    const projectCols = getTableColumns('projects');
    if (projectCols.size > 0) {
        if (!projectCols.has('location'))
            db.exec(`ALTER TABLE projects ADD COLUMN location TEXT;`);
        if (!projectCols.has('road_section'))
            db.exec(`ALTER TABLE projects ADD COLUMN road_section TEXT;`);
        if (!projectCols.has('timezone'))
            db.exec(`ALTER TABLE projects ADD COLUMN timezone TEXT NOT NULL DEFAULT 'America/Lima';`);
        if (!projectCols.has('timezone_offset'))
            db.exec(`ALTER TABLE projects ADD COLUMN timezone_offset TEXT NOT NULL DEFAULT '-05:00';`);
        if (!projectCols.has('whatsapp_recipients'))
            db.exec(`ALTER TABLE projects ADD COLUMN whatsapp_recipients TEXT;`);
        if (!projectCols.has('sampling_basis'))
            db.exec(`ALTER TABLE projects ADD COLUMN sampling_basis TEXT NOT NULL DEFAULT 'PER_TRUCK';`);
        if (!projectCols.has('cylinders_per_truck'))
            db.exec(`ALTER TABLE projects ADD COLUMN cylinders_per_truck INTEGER NOT NULL DEFAULT 4;`);
        if (!projectCols.has('default_design_fc'))
            db.exec(`ALTER TABLE projects ADD COLUMN default_design_fc REAL NOT NULL DEFAULT 210;`);
        if (!projectCols.has('metadata'))
            db.exec(`ALTER TABLE projects ADD COLUMN metadata TEXT;`);
        if (!projectCols.has('updated_at'))
            db.exec(`ALTER TABLE projects ADD COLUMN updated_at TEXT;`);
    }
    // Technicians table migrations
    const techCols = getTableColumns('technicians');
    if (techCols.size > 0) {
        if (!techCols.has('cip_number'))
            db.exec(`ALTER TABLE technicians ADD COLUMN cip_number TEXT;`);
    }
    // Cylinders table migrations
    const cylCols = getTableColumns('cylinders');
    if (cylCols.size > 0) {
        if (!cylCols.has('truck_id'))
            db.exec(`ALTER TABLE cylinders ADD COLUMN truck_id TEXT;`);
        if (!cylCols.has('truck_number'))
            db.exec(`ALTER TABLE cylinders ADD COLUMN truck_number INTEGER;`);
        if (!cylCols.has('specimen_number'))
            db.exec(`ALTER TABLE cylinders ADD COLUMN specimen_number INTEGER;`);
    }
    // Criteria table migrations
    const critCols = getTableColumns('criteria');
    if (critCols.size > 0) {
        if (!critCols.has('allowed_values'))
            db.exec(`ALTER TABLE criteria ADD COLUMN allowed_values TEXT;`);
        if (!critCols.has('hold_point'))
            db.exec(`ALTER TABLE criteria ADD COLUMN hold_point INTEGER NOT NULL DEFAULT 0;`);
    }
    // Protocols table migrations
    const protCols = getTableColumns('protocols');
    if (protCols.size > 0) {
        if (!protCols.has('pdf_key'))
            db.exec(`ALTER TABLE protocols ADD COLUMN pdf_key TEXT;`);
        if (!protCols.has('subcontractor_id'))
            db.exec(`ALTER TABLE protocols ADD COLUMN subcontractor_id TEXT;`);
    }
    // Concrete trucks table migrations
    const truckCols = getTableColumns('concrete_trucks');
    if (truckCols.size > 0) {
        if (!truckCols.has('slump'))
            db.exec(`ALTER TABLE concrete_trucks ADD COLUMN slump TEXT;`);
        if (!truckCols.has('supplier'))
            db.exec(`ALTER TABLE concrete_trucks ADD COLUMN supplier TEXT DEFAULT 'Concreto Titán';`);
    }
    // Nonconformances table migrations
    const ncCols = getTableColumns('nonconformances');
    if (ncCols.size > 0) {
        if (!ncCols.has('truck_id'))
            db.exec(`ALTER TABLE nonconformances ADD COLUMN truck_id TEXT;`);
    }
}
