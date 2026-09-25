import { DatabaseSync } from 'node:sqlite';
import { hashPin } from '../services/integrity.service.js';

export const PILOT_PROJECT_ID = 'AY-728-001';

export function seedDatabase(db: DatabaseSync): void {
  // 1. Seed Pilot Project (Data, not code constants)
  const insertProject = db.prepare(`
    INSERT OR REPLACE INTO projects (
      id, name, contract_number, entity, execution_mode,
      location, road_section, timezone, timezone_offset,
      whatsapp_recipients, sampling_basis, cylinders_per_truck, default_design_fc
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertProject.run(
    PILOT_PROJECT_ID,
    'Mejoramiento y Ampliación de Transitabilidad AY-728 a AY-729',
    'N° 81-2026-GRA-SEDECENTRAL-OAPF',
    'Gobierno Regional de Ayacucho',
    'Administración Directa',
    'Ayacucho, Perú',
    'Tramo AY-728 a AY-729 (km 0+000 a 2+380)',
    'America/Lima',
    '-05:00',
    '+51966000001',
    'PER_TRUCK',
    4,
    280
  );

  // 2. Seed Technicians (Execution & Supervision Teams from v2.4)
  const insertTech = db.prepare(`
    INSERT OR REPLACE INTO technicians (id, project_id, name, pin_hash, device_token, whatsapp, role, cip_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const defaultPinHash = hashPin('1234');

  const teamMembers = [
    // Execution Team
    { id: 'tech_quality_spec', name: 'Ing. David Valdez Ochoa (Especialista Calidad)', role: 'Quality Specialist', phone: '+51966000001', device: 'dvc_pilot_qa_01', cip: null },
    { id: 'tech_resident', name: 'Ing. Edison Cuadros Garcia (Residente de Obra)', role: 'Site Resident', phone: '+51966000002', device: 'dvc_pilot_res_02', cip: '302775' },
    { id: 'tech_soils', name: 'Ing. Especialista en Suelos', role: 'Soils Specialist', phone: '+51966000003', device: 'dvc_pilot_soils_03', cip: null },
    { id: 'tech_assistant_exec', name: 'Tec. Jorge Huamán (Asistente Calidad)', role: 'Assistant', phone: '+51966000004', device: 'dvc_pilot_asst_04', cip: null },
    { id: 'tech_safety', name: 'Ing. Patricia Flores (Seguridad)', role: 'Safety Specialist', phone: '+51966000005', device: 'dvc_pilot_safe_05', cip: null },
    // Supervision Team
    { id: 'tech_supervisor', name: 'Ing. Teodoro Manuel Huamancusi Quispe (Supervisor)', role: 'Supervisor', phone: '+51966000006', device: 'dvc_pilot_sup_06', cip: '53548' },
    { id: 'tech_structures', name: 'Ing. Roly Conocachi Huamani (Estructuras)', role: 'Structures Specialist', phone: '+51966000007', device: 'dvc_pilot_struct_07', cip: '76843' },
    { id: 'tech_quality_sup', name: 'Ing. Cristian Manuel Torres Salinas (Calidad Supervisión)', role: 'Quality Specialist', phone: '+51966000009', device: 'dvc_pilot_qa_sup_09', cip: '260873' },
    { id: 'tech_assistant_sup', name: 'Tec. Juan Ramos (Asistente Supervisión)', role: 'Assistant', phone: '+51966000008', device: 'dvc_pilot_asst_08', cip: null }
  ];

  for (const m of teamMembers) {
    insertTech.run(m.id, PILOT_PROJECT_ID, m.name, defaultPinHash, m.device, m.phone, m.role, m.cip || null);
  }

  // 3. Seed Pilot Validation Criteria (Sourced strictly from v2.4 Section 9.3 & F2)
  const insertCriterion = db.prepare(`
    INSERT OR REPLACE INTO criteria (id, project_id, activity, field, operator, min_value, max_value, allowed_values, expected_value, unit, source_reference, hold_point, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const criteriaList = [
    // CONCRETE
    {
      id: 'crit_conc_slump_discrete',
      activity: 'CONCRETE',
      field: 'slump',
      operator: 'IN',
      min_value: null,
      max_value: null,
      allowed_values: JSON.stringify(['3.5', '4', '4.5', '5']),
      expected_value: null,
      unit: '"',
      source: 'Especialista de Calidad 16-Sep + 20-Sep-2026 (Selector discreto: 3.5", 4", 4.5", 5")',
      hold_point: 0
    },
    {
      id: 'crit_conc_slump',
      activity: 'CONCRETE',
      field: 'slump_cm',
      operator: 'BETWEEN',
      min_value: 8.9,  // 3.5 inches (v2.4 confirmed 16 Sep 2026)
      max_value: 12.7, // 5.0 inches (v2.4 confirmed 16 Sep 2026)
      allowed_values: null,
      expected_value: null,
      unit: 'cm',
      source: 'Accredited Lab Mix Design / Quality Specialist Confirmed (8.9 - 12.7 cm)',
      hold_point: 0
    },
    {
      id: 'crit_conc_formwork',
      activity: 'CONCRETE',
      field: 'formwork_approved',
      operator: 'EQ',
      min_value: null,
      max_value: null,
      allowed_values: null,
      expected_value: 'true',
      unit: 'checklist',
      source: 'EG-2013 / Pre-pour Checklist (Encofrado)',
      hold_point: 1
    },
    {
      id: 'crit_conc_cylinders',
      activity: 'CONCRETE',
      field: 'cylinders_cast',
      operator: 'GTE',
      min_value: 4.0, // 4 cylinders per mixer truck (v2.4 confirmed 16 Sep 2026)
      max_value: null,
      allowed_values: null,
      expected_value: null,
      unit: 'probetas/mixer',
      source: 'EG-2013 / Quality Specialist Confirmed (4 probetas por mixer)',
      hold_point: 0
    },
    {
      id: 'crit_conc_design_fc',
      activity: 'CONCRETE',
      field: 'design_fc',
      operator: 'GTE',
      min_value: 210.0,
      max_value: null,
      allowed_values: null,
      expected_value: null,
      unit: 'kg/cm²',
      source: 'Expediente Técnico Specifications (140 - 280 kg/cm²)',
      hold_point: 0
    },
    // FORMWORK (ENCOFRADO)
    {
      id: 'crit_form_alignment',
      activity: 'FORMWORK',
      field: 'alignment_deviation_mm',
      operator: 'LTE',
      min_value: null,
      max_value: 5.0,
      allowed_values: null,
      expected_value: null,
      unit: 'mm',
      source: 'EG-2013 / Tolerancia de Encofrado (≤ 5 mm)',
      hold_point: 1
    },
    {
      id: 'crit_form_dimension',
      activity: 'FORMWORK',
      field: 'dimension_deviation_cm',
      operator: 'LTE',
      min_value: null,
      max_value: 0.5,
      allowed_values: null,
      expected_value: null,
      unit: 'cm',
      source: 'Plano Estructural / Tolerancia Dimensional (≤ 0.5 cm)',
      hold_point: 1
    },
    // COMPACTION
    {
      id: 'crit_comp_pct',
      activity: 'COMPACTION',
      field: 'compaction_pct',
      operator: 'GTE',
      min_value: 100.0,
      max_value: null,
      allowed_values: null,
      expected_value: null,
      unit: '%',
      source: 'Project Quality Plan (≥ 100% Modified Proctor)',
      hold_point: 1
    },
    {
      id: 'crit_comp_moisture',
      activity: 'COMPACTION',
      field: 'moisture_deviation',
      operator: 'BETWEEN',
      min_value: -1.5,
      max_value: 1.5,
      allowed_values: null,
      expected_value: null,
      unit: '%',
      source: 'Project Quality Plan (Within ±1.5% optimum)',
      hold_point: 0
    },
    {
      id: 'crit_comp_subbase',
      activity: 'COMPACTION',
      field: 'sub_base_thickness',
      operator: 'GTE',
      min_value: 20.0,
      max_value: null,
      allowed_values: null,
      expected_value: null,
      unit: 'cm',
      source: 'Expediente Técnico Specifications (≥ 20 cm)',
      hold_point: 0
    },
    {
      id: 'crit_comp_base',
      activity: 'COMPACTION',
      field: 'base_thickness',
      operator: 'GTE',
      min_value: 25.0,
      max_value: null,
      allowed_values: null,
      expected_value: null,
      unit: 'cm',
      source: 'Expediente Técnico Specifications (≥ 25 cm)',
      hold_point: 0
    },
    // SURVEY
    {
      id: 'crit_surv_elev',
      activity: 'SURVEY',
      field: 'elevation_deviation',
      operator: 'LTE',
      min_value: null,
      max_value: 1.0,
      allowed_values: null,
      expected_value: null,
      unit: 'cm',
      source: 'Project Quality Plan (≤ 1.0 cm from design cota)',
      hold_point: 1
    },
    // STEEL
    {
      id: 'crit_steel_spacing',
      activity: 'STEEL',
      field: 'bar_spacing_cm',
      operator: 'BETWEEN',
      min_value: 14.0,
      max_value: 16.0,
      allowed_values: null,
      expected_value: null,
      unit: 'cm',
      source: 'Structural Drawing (15 cm ±1.0 cm tolerance)',
      hold_point: 0
    },
    {
      id: 'crit_steel_cover',
      activity: 'STEEL',
      field: 'concrete_cover_cm',
      operator: 'GTE',
      min_value: 5.0,
      max_value: null,
      allowed_values: null,
      expected_value: null,
      unit: 'cm',
      source: 'EG-2013 / Structural Drawing (Recubrimiento ≥ 5 cm)',
      hold_point: 1
    }
  ];

  for (const c of criteriaList) {
    insertCriterion.run(
      c.id,
      PILOT_PROJECT_ID,
      c.activity,
      c.field,
      c.operator,
      c.min_value,
      c.max_value,
      c.allowed_values || null,
      c.expected_value,
      c.unit,
      c.source,
      c.hold_point || 0,
      1
    );
  }

  // 4. Seed Checklist Templates (F1: Paper-format Checklist as Data for 5 Activities)
  const insertChecklistTemplate = db.prepare(`
    INSERT OR REPLACE INTO checklist_templates (id, project_id, activity, section, item_text, item_order, applicable_if, version, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const checklistItems = [
    // FORMWORK (GDC-PDE-2026, Rev. 001) - Verbatim from 02. PAVIMENTO_ENCOFRADO_MI.xlsx
    { id: 'chk_form_101', act: 'FORMWORK', sec: '1. DESCRIPCION DE ACTIVIDAD', text: '1.01 ¿Tipo de encofrado es adecuado para el tipo de estructura a concretar?', order: 1 },
    { id: 'chk_form_102', act: 'FORMWORK', sec: '1. DESCRIPCION DE ACTIVIDAD', text: '1.02 ¿Los accesorios empleados son los adecuados?', order: 2 },
    { id: 'chk_form_103', act: 'FORMWORK', sec: '1. DESCRIPCION DE ACTIVIDAD', text: '1.03 ¿Ubicación correcta de los elementos embebidos?', order: 3 },
    { id: 'chk_form_104', act: 'FORMWORK', sec: '1. DESCRIPCION DE ACTIVIDAD', text: '1.04 ¿Los puntales son los adecuados?', order: 4 },
    { id: 'chk_form_201', act: 'FORMWORK', sec: '2. VERIFICACIÓN DE LOS MATERIALES', text: '2.01 Dimensiones del encofrado según los planos y las EETT.', order: 5 },
    { id: 'chk_form_202', act: 'FORMWORK', sec: '2. VERIFICACIÓN DE LOS MATERIALES', text: '2.02 Distancias entre ejes y longitudes de encofrado.', order: 6 },
    { id: 'chk_form_203', act: 'FORMWORK', sec: '2. VERIFICACIÓN DE LOS MATERIALES', text: '2.03 Verificación del alineamiento del encofrado.', order: 7 },
    { id: 'chk_form_204', act: 'FORMWORK', sec: '2. VERIFICACIÓN DE LOS MATERIALES', text: '2.04 Verificación de la verticalidad o inclinación en los diferentes encofrados.', order: 8 },

    // STEEL (FO01PT03 / GDC-PLA-2026, Rev. 001) - Verbatim from 03. PAVIMENTO_ACERO_MI.xlsx
    { id: 'chk_steel_101', act: 'STEEL', sec: '1. MATERIAL', text: '1.01 Calidad del acero / Fluencia corresponde con las EETT del proyecto', order: 1 },
    { id: 'chk_steel_102', act: 'STEEL', sec: '1. MATERIAL', text: '1.02 ¿El acero instalado presenta certificado de calidad?', order: 2 },
    { id: 'chk_steel_201', act: 'STEEL', sec: '2. GENERAL', text: '2.01 ¿Las armaduras de acero son del diámetro indicado en los planos ó EETT?', order: 3 },
    { id: 'chk_steel_202', act: 'STEEL', sec: '2. GENERAL', text: '2.02 ¿Las intersecciones están aseguradas con alambre de amarre?', order: 4 },
    { id: 'chk_steel_203', act: 'STEEL', sec: '2. GENERAL', text: '2.03 ¿Se colocaron dados de concreto en la base de la armadura?', order: 5 },
    { id: 'chk_steel_204', act: 'STEEL', sec: '2. GENERAL', text: '2.04 ¿Se colocaron dados de concreto en los laterales de la armadura?', order: 6 },
    { id: 'chk_steel_205', act: 'STEEL', sec: '2. GENERAL', text: '2.05 ¿La armadura de acero está alineada verticalmente y horizontalmente según EETT y planos?', order: 7 },
    { id: 'chk_steel_206', act: 'STEEL', sec: '2. GENERAL', text: '2.06 ¿Las cotas del acero colocado están de acuerdo a los planos?', order: 8 },
    { id: 'chk_steel_207', act: 'STEEL', sec: '2. GENERAL', text: '2.07 ¿Las distancias entre las varillas son las que se indican en los planos de referencia?', order: 9 },
    { id: 'chk_steel_301', act: 'STEEL', sec: '3. OTROS', text: '3.01 ¿Las armaduras están libres de óxidos y sustancias extrañas en su superficie?', order: 10 },
    { id: 'chk_steel_302', act: 'STEEL', sec: '3. OTROS', text: '3.02 ¿Todas las condiciones están dadas para dar conformidad a la armadura de acero?', order: 11 },

    // CONCRETE (GDC-PCC-2026, Rev. 001) - Verbatim from 04. PAVIMENTO_CONCRETO_MI.xlsx
    { id: 'chk_conc_101', act: 'CONCRETE', sec: '1. INSPECCIÓN PREVIA AL VACIADO', text: '1.1 ¿Se cuenta con diseño de mezcla aprobado por la Supervisión?', order: 1 },
    { id: 'chk_conc_102', act: 'CONCRETE', sec: '1. INSPECCIÓN PREVIA AL VACIADO', text: '1.2 ¿La superficie del solado está limpia, libre de tierra, raíces y arena?', order: 2 },
    { id: 'chk_conc_103', act: 'CONCRETE', sec: '1. INSPECCIÓN PREVIA AL VACIADO', text: '1.3 ¿El acero de refuerzo se encuentra limpio, libre de lubricantes y óxidos?', order: 3 },
    { id: 'chk_conc_104', act: 'CONCRETE', sec: '1. INSPECCIÓN PREVIA AL VACIADO', text: '1.4 ¿La posición del acero de refuerzo y el encofrado ha sido verificado por el topógrafo?', order: 4 },
    { id: 'chk_conc_105', act: 'CONCRETE', sec: '1. INSPECCIÓN PREVIA AL VACIADO', text: '1.5 ¿El espesor de recubrimiento de concreto cumple con lo indicado según ET?', order: 5 },
    { id: 'chk_conc_106', act: 'CONCRETE', sec: '1. INSPECCIÓN PREVIA AL VACIADO', text: '1.6 ¿Se encuentra con una referencia para determinar el nivel de llenado de concreto?', order: 6 },
    { id: 'chk_conc_107', act: 'CONCRETE', sec: '1. INSPECCIÓN PREVIA AL VACIADO', text: '1.7 ¿Se ha verificado la conformidad de las juntas?', order: 7 },
    { id: 'chk_conc_108', act: 'CONCRETE', sec: '1. INSPECCIÓN PREVIA AL VACIADO', text: '1.8 ¿Se ha verificado la conformidad de los recubrimientos mínimos?', order: 8 },
    { id: 'chk_conc_gate', act: 'CONCRETE', sec: '1. INSPECCIÓN PREVIA AL VACIADO', text: '¿Las condiciones están dadas para iniciar el concretado? (Punto de Control / Gate)', order: 9 },
    { id: 'chk_conc_401', act: 'CONCRETE', sec: '4. VERIFICACIÓN POSTERIOR AL VACIADO', text: '1 Acabado superficial de acuerdo a lo especificado', order: 10 },
    { id: 'chk_conc_402', act: 'CONCRETE', sec: '4. VERIFICACIÓN POSTERIOR AL VACIADO', text: '2 Nivel de aplomado del elemento de acuerdo a lo especificado', order: 11 },
    { id: 'chk_conc_403', act: 'CONCRETE', sec: '4. VERIFICACIÓN POSTERIOR AL VACIADO', text: '3 Correcta posición final de los elementos embebidos', order: 12 },
    { id: 'chk_conc_404', act: 'CONCRETE', sec: '4. VERIFICACIÓN POSTERIOR AL VACIADO', text: '4 Curado de la estructura concretada adecuado', order: 13 },

    // SURVEY (GCO-PVT-2026, Rev. 01) - Verbatim from PRO-TOPOGRAFIA-2026 - copia.xlsx
    { id: 'chk_surv_101', act: 'SURVEY', sec: '1. VERIFICACION PRELIMINAR', text: '1.1 Área limpia y sin obstáculos', order: 1 },
    { id: 'chk_surv_102', act: 'SURVEY', sec: '1. VERIFICACION PRELIMINAR', text: '1.2 Área de trabajo señalizada', order: 2 },
    { id: 'chk_surv_103', act: 'SURVEY', sec: '1. VERIFICACION PRELIMINAR', text: '1.3 Equipos y herramientas operativas', order: 3 },
    { id: 'chk_surv_104', act: 'SURVEY', sec: '1. VERIFICACION PRELIMINAR', text: '1.4 Se cuenta con todos los permisos de seguridad (AST, etc.)', order: 4 },
    { id: 'chk_surv_201', act: 'SURVEY', sec: '2. VERIFICACIÓN DURANTE LA ACTIVIDAD', text: '2.1 Ubicación de puntos auxiliares', order: 5 },
    { id: 'chk_surv_202', act: 'SURVEY', sec: '2. VERIFICACIÓN DURANTE LA ACTIVIDAD', text: '2.2 Replanteo de linderos del terreno', order: 6 },
    { id: 'chk_surv_203', act: 'SURVEY', sec: '2. VERIFICACIÓN DURANTE LA ACTIVIDAD', text: '2.3 Levantamiento topográfico', order: 7 },
    { id: 'chk_surv_204', act: 'SURVEY', sec: '2. VERIFICACIÓN DURANTE LA ACTIVIDAD', text: '2.4 Trazo y replanteo de ejes', order: 8 },
    { id: 'chk_surv_205', act: 'SURVEY', sec: '2. VERIFICACIÓN DURANTE LA ACTIVIDAD', text: '2.5 Distancia y proporcionalidad entre ejes', order: 9 },
    { id: 'chk_surv_206', act: 'SURVEY', sec: '2. VERIFICACIÓN DURANTE LA ACTIVIDAD', text: '2.6 Colocación de niveles', order: 10 },
    { id: 'chk_surv_207', act: 'SURVEY', sec: '2. VERIFICACIÓN DURANTE LA ACTIVIDAD', text: '2.7 Verticalidad y alineamiento', order: 11 },
    { id: 'chk_surv_301', act: 'SURVEY', sec: '3. VERIFICACIONES POSTERIORES', text: '3.1 Recojo de equipos y herramientas', order: 12 },
    { id: 'chk_surv_302', act: 'SURVEY', sec: '3. VERIFICACIONES POSTERIORES', text: '3.2 Limpieza del área de trabajo', order: 13 },

    // COMPACTION (GDC-PCS-2026, Rev. 001) - Suelos y Pavimentos per EG-2013 / GORE Ayacucho
    { id: 'chk_comp_101', act: 'COMPACTION', sec: '1. MATERIAL Y CANTERA', text: '1.1 Material granular de cantera cumple con especificaciones técnicas del expediente y ensayos de laboratorio (CBR, granulometría, límites de Atterberg)', order: 1 },
    { id: 'chk_comp_102', act: 'COMPACTION', sec: '1. MATERIAL Y CANTERA', text: '1.2 Cantera autorizada y material libre de materia orgánica o sobretamaños > 2"', order: 2 },
    { id: 'chk_comp_201', act: 'COMPACTION', sec: '2. PREPARACIÓN Y COLOCACIÓN', text: '2.1 Espesor de capa suelta verificado antes de iniciar el pase del rodillo compactador (máx. 20-25 cm)', order: 3 },
    { id: 'chk_comp_202', act: 'COMPACTION', sec: '2. PREPARACIÓN Y COLOCACIÓN', text: '2.2 Humedad de mezclado homogénea y dentro de la tolerancia óptima del ensayo Proctor Modificado (±1.5%)', order: 4 },
    { id: 'chk_comp_301', act: 'COMPACTION', sec: '3. CONTROL DE COMPACTACIÓN Y ENSAYOS', text: '3.1 Grado de compactación in-situ alcanza ≥100% de la máxima densidad seca (MDS) del Proctor Modificado', order: 5 },
    { id: 'chk_comp_302', act: 'COMPACTION', sec: '3. CONTROL DE COMPACTACIÓN Y ENSAYOS', text: '3.2 Ensayos de cono de arena o densímetro nuclear realizados con frecuencia requerida por EG-2013', order: 6 },
    { id: 'chk_comp_401', act: 'COMPACTION', sec: '4. TERMINACIÓN Y GEOMETRÍA', text: '4.1 Superficie compactada uniforme, libre de ahuellamientos, fisuras o zonas blandas', order: 7 },
    { id: 'chk_comp_402', act: 'COMPACTION', sec: '4. TERMINACIÓN Y GEOMETRÍA', text: '4.2 Cotas y pendientes transversales verificadas conforme al plano de rasante', order: 8 }
  ];

  for (const item of checklistItems) {
    insertChecklistTemplate.run(item.id, PILOT_PROJECT_ID, item.act, item.sec, item.text, item.order, null, 1);
  }

  // 5. Seed Pilot Activity Schedule for R10 demo
  const insertSchedule = db.prepare(`
    INSERT OR REPLACE INTO protocol_schedules (id, project_id, activity, panel, chainage, scheduled_at, notified_overdue_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const pastScheduledTime = new Date(Date.now() - 5 * 3600 * 1000).toISOString();
  insertSchedule.run('sched_demo_01', PILOT_PROJECT_ID, 'CONCRETE', '14', '0+138', pastScheduledTime, null);
}
