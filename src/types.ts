// PROTOKOL Phase 0 Domain Types
// Source: Technical Product Document v2.4 (September 2026) & SPEC_FOR_SNEHIL.md

export type ActivityType = 'COMPACTION' | 'SURVEY' | 'STEEL' | 'FORMWORK' | 'CONCRETE';

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
  operator: 'BETWEEN' | 'GTE' | 'LTE' | 'EQ' | 'IN';
  min_value?: number | null;
  max_value?: number | null;
  allowed_values?: string[] | null;
  expected_value?: string | null;
  unit?: string | null;
  source_reference: string;
  hold_point?: boolean;
  is_active: number;
}

export interface ChecklistTemplateItem {
  id: string;
  project_id: string;
  activity: ActivityType;
  section: string;
  item_text: string;
  item_order: number;
  applicable_if?: string | null;
  version: number;
  active: number;
}

export interface ProtocolCheckItem {
  id: string;
  protocol_id: string;
  template_item_id: string;
  result: 'CUMPLE' | 'NO_CUMPLE' | 'NO_APLICA';
  observation?: string;
  created_at?: string;
}

export interface ProtocolSignatureRecord {
  id: string;
  protocol_id: string;
  signatory_id?: string | null;
  signatory_name: string;
  role: string;
  sign_order: number;
  cip_number?: string | null;
  status: 'PENDING' | 'SIGNED' | 'EXEMPT';
  signed_at?: string | null;
  signature_key?: string | null;
  stamp_key?: string | null;
}

export interface SignProtocolRequest {
  signatory_id: string;
  pin: string;
  signature_data?: string;
  stamp_data?: string;
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
  checks?: Array<{
    template_item_id: string;
    result: 'CUMPLE' | 'NO_CUMPLE' | 'NO_APLICA';
    observation?: string;
  }>;
  signatures?: Array<{
    role: string;
    signatory_name: string;
    cip_number?: string;
    status?: 'PENDING' | 'SIGNED' | 'EXEMPT';
    signature_key?: string;
    stamp_key?: string;
  }>;
  photo_ids?: string[];
  notes?: string;
  idempotency_key?: string;
}

export interface ProtocolSubmissionResponse {
  protocol_id: string;
  verdict: ProtocolVerdict;
  checks: ValidationCheck[];
  checks_items?: ProtocolCheckItem[];
  signatures?: ProtocolSignatureRecord[];
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

export type SupportedLanguage = 'es' | 'en';

export interface ProjectRecord {
  id: string;
  name: string;
  contract_number: string;
  entity: string;
  execution_mode: string;
  location?: string;
  road_section?: string;
  timezone: string;
  timezone_offset: string;
  whatsapp_recipients?: string;
  sampling_basis: 'PER_TRUCK';
  cylinders_per_truck: number;
  default_design_fc: number;
  metadata?: string;
  created_at: string;
  updated_at?: string;
}

export interface ProjectCreateRequest {
  id: string;
  name: string;
  contract_number: string;
  entity: string;
  execution_mode: string;
  location?: string;
  road_section?: string;
  timezone?: string;
  timezone_offset?: string;
  whatsapp_recipients?: string;
  sampling_basis?: 'PER_TRUCK';
  cylinders_per_truck?: number;
  default_design_fc?: number;
  criteria?: Array<{
    activity: ActivityType;
    field: string;
    operator: 'BETWEEN' | 'GTE' | 'LTE' | 'EQ';
    min_value?: number | null;
    max_value?: number | null;
    expected_value?: string | null;
    unit?: string | null;
    source_reference: string;
    is_active?: number;
  }>;
  technicians?: Array<{
    id?: string;
    name: string;
    role: string;
    pin: string;
    device_token?: string;
    whatsapp?: string;
    cip_number?: string;
  }>;
}

export interface ConcreteTruckInput {
  truck_number: number;
  mixer_id: string;
  delivery_note: string;
  slump?: string; // Discrete selector: "3.5" | "4" | "4.5" | "5" (inches, F2)
  slump_cm?: number; // Kept for backwards compatibility
  supplier?: string;
  cylinders_cast?: number;
  design_fc?: number;
  notes?: string;
}

export interface ConcreteTruckRecord {
  id: string;
  protocol_id: string;
  truck_number: number;
  mixer_id: string;
  delivery_note: string;
  slump?: string;
  slump_cm?: number;
  supplier?: string;
  cylinders_cast: number;
  design_fc: number;
  slump_verdict: CheckResult;
  notes?: string;
  created_at: string;
}

export interface CylinderRecord {
  id: string;
  protocol_id: string;
  truck_id?: string | null;
  truck_number?: number | null;
  specimen_number?: number | null;
  cylinder_code: string;
  cast_date: string;
  test_date?: string | null;
  age_days: number;
  strength_kgcm2?: number | null;
  design_fc: number;
  lab?: string | null;
  report_photo_id?: string | null;
  status: CylinderStatus;
  verdict?: CheckResult | null;
  created_at: string;
}

export interface TechnicianRecord {
  id: string;
  project_id: string;
  name: string;
  pin_hash: string;
  device_token: string;
  whatsapp: string;
  role: string;
  cip_number?: string | null;
  created_at: string;
}
