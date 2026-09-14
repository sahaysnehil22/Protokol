// PROTOKOL Phase 0 Domain Types
// Source: Technical Product Document v2.2 (September 2026)

export type ActivityType = 'CONCRETE' | 'SURVEY' | 'COMPACTION' | 'STEEL';

export type ProtocolVerdict = 'PASS' | 'PROVISIONAL_PASS' | 'FAIL';

export type CheckResult = 'PASS' | 'FAIL';

export type NonConformanceStatus = 'OPEN' | 'CLOSED';

export type CylinderStatus = 'PENDING' | 'TESTED';

export type NotificationStatus = 'SENT' | 'PENDING' | 'FAILED';

export type ExecutionRole = 
  | 'Site Resident'
  | 'Soils Specialist'
  | 'Quality Specialist'
  | 'Assistant'
  | 'Safety Specialist';

export type SupervisionRole = 
  | 'Supervisor'
  | 'Structures Specialist'
  | 'Quality Specialist'
  | 'Assistant';

export type TechnicianRole = ExecutionRole | SupervisionRole;

export interface GPSCoordinates {
  lat: number;
  lng: number;
}

export interface ValidationCheck {
  field: string;
  expected: string;
  actual: any;
  result: CheckResult;
  unit?: string;
  source_reference?: string;
}

export interface CriterionRecord {
  id: string;
  project_id: string;
  activity: ActivityType;
  field: string;
  operator: 'BETWEEN' | 'GTE' | 'LTE' | 'EQ';
  min_value?: number | null;
  max_value?: number | null;
  expected_value?: string | null;
  unit?: string | null;
  source_reference: string;
  is_active: number;
}

export interface ProtocolRecord {
  id: string;
  project_id: string;
  activity: ActivityType;
  recorded_at: string;
  server_received_at: string;
  timezone_offset: string;
  gps_lat: number;
  gps_lng: number;
  panel: string;
  chainage: string;
  measurements: Record<string, any>;
  verdict: ProtocolVerdict;
  technician_id: string;
  device_token: string;
  integrity_hash: string;
  notes?: string;
  supersedes_protocol_id?: string | null;
  idempotency_key?: string | null;
  created_at: string;
}

export interface ProtocolSubmissionRequest {
  project_id: string;
  device_token: string;
  technician_pin: string;
  activity: ActivityType;
  recorded_at: string;
  gps: GPSCoordinates;
  panel: string;
  chainage: string;
  measurements: Record<string, any>;
  photo_ids?: string[];
  notes?: string;
  idempotency_key?: string;
}

export interface ProtocolSubmissionResponse {
  protocol_id: string;
  verdict: ProtocolVerdict;
  checks: ValidationCheck[];
  nonconformance_id: string | null;
  pdf_url: string;
  pending: string[];
}

export interface CylinderResultRequest {
  age_days: number;
  cylinder_code: string;
  strength_kgcm2: number;
  lab: string;
  report_photo_id?: string;
}

export interface CylinderResultResponse {
  protocol_id: string;
  cylinder_code: string;
  age_days: number;
  strength_kgcm2: number;
  design_fc: number;
  verdict: 'PASS' | 'FAIL';
  protocol_verdict: ProtocolVerdict;
  nonconformance_id: string | null;
}

export interface ProjectStatusResponse {
  project_id: string;
  as_of: string;
  summary: {
    total_expected: number;
    passed: number;
    provisional: number;
    failed: number;
    missing: number;
    pending_cylinders?: number;
    open_nonconformances?: number;
  };
  protocols: Array<{
    id: string;
    activity: ActivityType;
    panel: string;
    chainage: string;
    verdict: ProtocolVerdict;
    recorded_at: string;
    checks_count: number;
    open_nc: boolean;
    pending: string[];
  }>;
}

export interface DossierResponse {
  dossier_url: string;
  generated_at: string;
  protocols_included: number;
  open_nonconformances: number;
  completeness_pct: number;
}
