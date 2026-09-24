import { hashPin } from '../services/integrity.service.js';
export const PILOT_PROJECT_ID = 'AY-728-001';
export function seedDatabase(db) {
    // 1. Seed Pilot Project (Data, not code constants)
    const insertProject = db.prepare(`
    INSERT OR REPLACE INTO projects (
      id, name, contract_number, entity, execution_mode,
      location, road_section, timezone, timezone_offset,
      whatsapp_recipients, sampling_basis, cylinders_per_truck, default_design_fc
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    insertProject.run(PILOT_PROJECT_ID, 'Mejoramiento y Ampliación de Transitabilidad AY-728 a AY-729', 'N° 81-2026-GRA-SEDECENTRAL-OAPF', 'Gobierno Regional de Ayacucho', 'Administración Directa', 'Ayacucho, Perú', 'Tramo AY-728 a AY-729 (km 0+000 a 2+380)', 'America/Lima', '-05:00', '+51966000001', 'PER_TRUCK', 4, 280);
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
            min_value: 8.9, // 3.5 inches (v2.4 confirmed 16 Sep 2026)
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
        insertCriterion.run(c.id, PILOT_PROJECT_ID, c.activity, c.field, c.operator, c.min_value, c.max_value, c.allowed_values || null, c.expected_value, c.unit, c.source, c.hold_point || 0, 1);
    }
    // 4. Seed Checklist Templates (F1: Paper-format Checklist as Data for 5 Activities)
    const insertChecklistTemplate = db.prepare(`
    INSERT OR REPLACE INTO checklist_templates (id, project_id, activity, section, item_text, item_order, applicable_if, version, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
    const checklistItems = [
        // COMPACTION
        { id: 'chk_comp_1', act: 'COMPACTION', sec: '1. Material y Cantera', text: 'Material granular de cantera cumple con especificaciones técnicas del expediente y certificado de laboratorio.', order: 1 },
        { id: 'chk_comp_2', act: 'COMPACTION', sec: '2. Preparación', text: 'Espesor de capa suelta verificado antes de iniciar el pase del rodillo compactador.', order: 2 },
        { id: 'chk_comp_3', act: 'COMPACTION', sec: '3. Ensayos de Campo', text: 'Contenido de humedad de la muestra dentro de la tolerancia óptima (±1.5%).', order: 3 },
        { id: 'chk_comp_4', act: 'COMPACTION', sec: '3. Ensayos de Campo', text: 'Densidad in-situ alcanza ≥100% de la máxima densidad seca del ensayo Proctor Modificado.', order: 4 },
        { id: 'chk_comp_5', act: 'COMPACTION', sec: '4. Terminación', text: 'Superficie compactada uniforme, libre de ahuellamientos, fisuras o zonas blandas.', order: 5 },
        // SURVEY
        { id: 'chk_surv_1', act: 'SURVEY', sec: '1. Calibración', text: 'Estación total / nivel topográfico cuenta con certificado de calibración vigente.', order: 1 },
        { id: 'chk_surv_2', act: 'SURVEY', sec: '2. Nivelación', text: 'Puntos de control topográfico (BM) y cotas de rasante verificados con tolerancia ≤ 1.0 cm.', order: 2 },
        { id: 'chk_surv_3', act: 'SURVEY', sec: '3. Geometría', text: 'Alineamiento de eje y anchos de calzada y bermas conformes a secciones tipo.', order: 3 },
        { id: 'chk_surv_4', act: 'SURVEY', sec: '3. Geometría', text: 'Pendientes longitudinales y bombeo transversal (S = 2.00%) verificados con plantilla.', order: 4 },
        // STEEL
        { id: 'chk_steel_1', act: 'STEEL', sec: '1. Materiales', text: 'El acero corrugado cuenta con certificado de calidad de fábrica y está libre de óxido escamoso o grasas.', order: 1 },
        { id: 'chk_steel_2', act: 'STEEL', sec: '2. Colocación', text: 'Los diámetros y distribución de varillas coinciden con el plano estructural del expediente.', order: 2 },
        { id: 'chk_steel_3', act: 'STEEL', sec: '2. Colocación', text: 'Espaciamiento entre barras de refuerzo verificado dentro de la tolerancia de diseño.', order: 3 },
        { id: 'chk_steel_4', act: 'STEEL', sec: '3. Amarre y Apoyo', text: 'Recubrimiento libre de concreto asegurado con dados de mortero prefabricados (≥ 5 cm).', order: 4 },
        { id: 'chk_steel_5', act: 'STEEL', sec: '3. Amarre y Apoyo', text: 'Intersecciones firmemente aseguradas con alambre negro de amarra #16 sin holguras.', order: 5 },
        // FORMWORK
        { id: 'chk_form_1', act: 'FORMWORK', sec: '1. Material y Estado', text: 'Paneles de encofrado (metálicos/madera) limpios, rectos y sin deformaciones previas.', order: 1 },
        { id: 'chk_form_2', act: 'FORMWORK', sec: '2. Geometría y Cota', text: 'Dimensiones internas y cotas del encofrado conformes al plano (desviación ≤ 0.5 cm).', order: 2 },
        { id: 'chk_form_3', act: 'FORMWORK', sec: '2. Geometría y Cota', text: 'Alineamiento y verticalidad verificados con plomada y nivel (tolerancia ≤ 5 mm).', order: 3 },
        { id: 'chk_form_4', act: 'FORMWORK', sec: '3. Estanqueidad', text: 'Juntas selladas para evitar fuga de lechada durante el vaciado y vibrado.', order: 4 },
        { id: 'chk_form_5', act: 'FORMWORK', sec: '4. Preparación', text: 'Desmoldante aplicado homogéneamente y fondo libre de aserrín o basura antes del vaciado.', order: 5 },
        // CONCRETE
        { id: 'chk_conc_1', act: 'CONCRETE', sec: '1. Autorización Previa', text: 'Liberación previa firmada de Topografía, Acero y Encofrado antes de autorizar el vaciado.', order: 1 },
        { id: 'chk_conc_2', act: 'CONCRETE', sec: '2. Despacho Planta', text: 'Guía de remisión del proveedor (Concreto Titán / Carmix) verificada con volumen y resistencia f\'c.', order: 2 },
        { id: 'chk_conc_3', act: 'CONCRETE', sec: '3. Ensayo de Cono', text: 'Prueba de asentamiento (Slump de Abrams) realizada por mixer dentro de 3.5" a 5.0".', order: 3 },
        { id: 'chk_conc_4', act: 'CONCRETE', sec: '4. Muestreo de Probetas', text: 'Moldeo de 4 probetas cilíndricas por mixer en moldes normalizados con rotulado indeleble.', order: 4 },
        { id: 'chk_conc_5', act: 'CONCRETE', sec: '5. Colocación y Vibrado', text: 'Vibrado mecánico adecuado sin tocar el acero de refuerzo ni producir segregación.', order: 5 },
        { id: 'chk_conc_6', act: 'CONCRETE', sec: '6. Curado', text: 'Aplicación inmediata de curador químico y/o mantas de yute húmedas según EG-2013.', order: 6 }
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
