import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { hashPin } from '../services/integrity.service.js';

export function seedDatabase(db: DatabaseSync): void {
  // 1. Seed Pilot Project
  const insertProject = db.prepare(`
    INSERT OR REPLACE INTO projects (id, name, contract_number, entity, execution_mode)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertProject.run(
    config.pilotProjectId,
    config.pilotProjectName,
    config.pilotContractNumber,
    config.pilotEntity,
    config.pilotExecutionMode
  );

  // 2. Seed Technicians (Execution & Supervision Teams from Document v2.2)
  const insertTech = db.prepare(`
    INSERT OR REPLACE INTO technicians (id, project_id, name, pin_hash, device_token, whatsapp, role)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const defaultPinHash = hashPin('1234');

  const teamMembers = [
    // Execution Team
    { id: 'tech_david_valdez', name: 'Ing. David Valdez Ochoa', role: 'Quality Specialist', phone: '+51966000001', device: 'dvc_pilot_david_01' },
    { id: 'tech_resident', name: 'Ing. Carlos Mendoza (Residente)', role: 'Site Resident', phone: '+51966000002', device: 'dvc_pilot_res_02' },
    { id: 'tech_soils', name: 'Ing. Marco Quispe (Suelos)', role: 'Soils Specialist', phone: '+51966000003', device: 'dvc_pilot_soils_03' },
    { id: 'tech_assistant_exec', name: 'Tec. Jorge Huamán (Asistente)', role: 'Assistant', phone: '+51966000004', device: 'dvc_pilot_asst_04' },
    { id: 'tech_safety', name: 'Ing. Patricia Flores (Seguridad)', role: 'Safety Specialist', phone: '+51966000005', device: 'dvc_pilot_safe_05' },
    // Supervision Team
    { id: 'tech_supervisor', name: 'Ing. Roberto Alarcón (Supervisor)', role: 'Supervisor', phone: '+51966000006', device: 'dvc_pilot_sup_06' },
    { id: 'tech_structures', name: 'Ing. Luis Fernando Morales (Estructuras)', role: 'Structures Specialist', phone: '+51966000007', device: 'dvc_pilot_struct_07' },
    { id: 'tech_assistant_sup', name: 'Tec. Juan Ramos (Asistente Supervisión)', role: 'Assistant', phone: '+51966000008', device: 'dvc_pilot_asst_08' }
  ];

  for (const m of teamMembers) {
    insertTech.run(m.id, config.pilotProjectId, m.name, defaultPinHash, m.device, m.phone, m.role);
  }

  // 3. Seed Pilot Validation Criteria (Criteria as Data)
  // Sourced strictly from Document v2.2 Section 9.3
  const insertCriterion = db.prepare(`
    INSERT OR REPLACE INTO criteria (id, project_id, activity, field, operator, min_value, max_value, expected_value, unit, source_reference, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const criteriaList = [
    // CONCRETE
    {
      id: 'crit_conc_formwork',
      activity: 'CONCRETE',
      field: 'formwork_approved',
      operator: 'EQ',
      min_value: null,
      max_value: null,
      expected_value: 'true',
      unit: 'checklist',
      source: 'EG-2013 / Pre-pour Checklist (Encofrado)'
    },
    {
      id: 'crit_conc_slump',
      activity: 'CONCRETE',
      field: 'slump_cm',
      operator: 'BETWEEN',
      min_value: 7.6,  // 3 inches
      max_value: 10.2, // 4 inches
      expected_value: null,
      unit: 'cm',
      source: 'Accredited Lab Mix Design Report (Plastic Consistency)'
    },
    {
      id: 'crit_conc_cylinders',
      activity: 'CONCRETE',
      field: 'cylinders_cast',
      operator: 'GTE',
      min_value: 2.0,
      max_value: null,
      expected_value: null,
      unit: 'probetas',
      source: 'EG-2013 (Minimum 2 per pour above 4 m³)'
    },
    {
      id: 'crit_conc_design_fc',
      activity: 'CONCRETE',
      field: 'design_fc',
      operator: 'GTE',
      min_value: 210.0,
      max_value: null,
      expected_value: null,
      unit: 'kg/cm²',
      source: 'Expediente Técnico Specifications'
    },
    // COMPACTION
    {
      id: 'crit_comp_pct',
      activity: 'COMPACTION',
      field: 'compaction_pct',
      operator: 'GTE',
      min_value: 100.0,
      max_value: null,
      expected_value: null,
      unit: '%',
      source: 'Project Quality Plan (≥ 100% Modified Proctor)'
    },
    {
      id: 'crit_comp_moisture',
      activity: 'COMPACTION',
      field: 'moisture_deviation',
      operator: 'BETWEEN',
      min_value: -1.5,
      max_value: 1.5,
      expected_value: null,
      unit: '%',
      source: 'Project Quality Plan (Within ±1.5% optimum)'
    },
    {
      id: 'crit_comp_subbase',
      activity: 'COMPACTION',
      field: 'sub_base_thickness',
      operator: 'GTE',
      min_value: 20.0,
      max_value: null,
      expected_value: null,
      unit: 'cm',
      source: 'Expediente Técnico Specifications (≥ 20 cm)'
    },
    {
      id: 'crit_comp_base',
      activity: 'COMPACTION',
      field: 'base_thickness',
      operator: 'GTE',
      min_value: 25.0,
      max_value: null,
      expected_value: null,
      unit: 'cm',
      source: 'Expediente Técnico Specifications (≥ 25 cm)'
    },
    // SURVEY
    {
      id: 'crit_surv_elev',
      activity: 'SURVEY',
      field: 'elevation_deviation',
      operator: 'LTE',
      min_value: null,
      max_value: 1.0,
      expected_value: null,
      unit: 'cm',
      source: 'Project Quality Plan (≤ 1.0 cm from design cota)'
    },
    // STEEL
    {
      id: 'crit_steel_spacing',
      activity: 'STEEL',
      field: 'bar_spacing_cm',
      operator: 'BETWEEN',
      min_value: 14.0,
      max_value: 16.0,
      expected_value: null,
      unit: 'cm',
      source: 'Structural Drawing (15 cm ±1.0 cm tolerance)'
    },
    {
      id: 'crit_steel_cover',
      activity: 'STEEL',
      field: 'concrete_cover_cm',
      operator: 'GTE',
      min_value: 5.0,
      max_value: null,
      expected_value: null,
      unit: 'cm',
      source: 'EG-2013 / Structural Drawing (Recubrimiento ≥ 5 cm)'
    }
  ];

  for (const c of criteriaList) {
    insertCriterion.run(
      c.id,
      config.pilotProjectId,
      c.activity,
      c.field,
      c.operator,
      c.min_value,
      c.max_value,
      c.expected_value,
      c.unit,
      c.source,
      1
    );
  }

  // 4. Seed Pilot Activity Schedule for R10 demo
  const insertSchedule = db.prepare(`
    INSERT OR REPLACE INTO protocol_schedules (id, project_id, activity, panel, chainage, scheduled_at, notified_overdue_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // An overdue scheduled pour from earlier today for testing R10
  const pastScheduledTime = new Date(Date.now() - 5 * 3600 * 1000).toISOString();
  insertSchedule.run('sched_demo_01', config.pilotProjectId, 'CONCRETE', '14', '0+138', pastScheduledTime, null);
}
