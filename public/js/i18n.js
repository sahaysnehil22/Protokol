// PROTOKOL — Internationalization (i18n) Module
// Supported Languages: Español ('es') | English ('en')

const translations = {
  es: {
    // Header & Navigation
    'brand.title': 'PROTOKOL',
    'brand.subtitle': 'Trazabilidad Vial',
    'nav.online': 'ONLINE',
    'nav.offline': 'OFFLINE',
    'nav.syncing': 'SINCRONIZANDO',
    'nav.queued': '{count} EN COLA',
    'nav.lang_toggle': 'EN',
    'nav.projects': 'Proyectos',
    'nav.new_project': '+ Nuevo Proyecto',

    // Project Portal View
    'portal.title': 'Proyectos de Infraestructura Vial',
    'portal.subtitle': 'Seleccione un proyecto para ingresar a la gestión de calidad en campo',
    'portal.search': 'Buscar por nombre, código o tramo...',
    'portal.open_project': 'Abrir Proyecto →',
    'portal.empty': 'No se encontraron proyectos registrados.',
    'portal.sampling': 'Muestreo',
    'portal.default_fc': 'f\'c Base',
    'portal.change_project': '← Cambiar de Proyecto',

    // Home View
    'home.quality_record': 'Registro de Calidad en Campo',
    'home.select_activity': 'Seleccione Actividad a Liberar',
    'home.act_concrete_title': '1. CONCRETO',
    'home.act_concrete_desc': 'Vaciado con múltiples mixers, asentamiento (slump), guía, probetas por camión y checklist previo de encofrado.',
    'home.act_survey_title': '2. TOPOGRAFÍA',
    'home.act_survey_desc': 'Nivelación geométrica, cota de rasante y tolerancia de elevación (≤ 1 cm).',
    'home.act_compaction_title': '3. COMPACTACIÓN',
    'home.act_compaction_desc': 'Densidad in-situ (≥100% Proctor Modificado), humedad y espesor de capas base/sub-base.',
    'home.act_steel_title': '4. ACERO',
    'home.act_steel_desc': 'Armadura de refuerzo, espaciamiento entre varillas y recubrimiento mínimo.',
    'home.btn_status_view': '📊 Vista de Estado del Especialista de Calidad →',
    'home.btn_project_config': '⚙️ Configuración / Nuevo Proyecto →',

    // Identify View
    'identify.title': 'Identificación de Campo',
    'identify.select_project': 'Proyecto Activo',
    'identify.select_tech': 'Ingeniero / Especialista Responsable',
    'identify.pin_label': 'PIN de Seguridad (4 dígitos)',
    'identify.pin_hint': 'PIN demo: 1234',
    'identify.device_label': 'Token de Dispositivo Físico',
    'identify.btn_submit': 'Ingresar al Panel de Campo →',
    'identify.err_pin': 'El PIN debe contener exactamente 4 dígitos.',

    // Protocol Form
    'form.back': '← Volver',
    'form.back_to_activities': '← Actividades',
    'form.exit': '✕ Salir',
    'form.confirm_exit': '¿Desea salir del protocolo actual? Se descartarán los cambios no enviados.',
    'form.step1': 'Ubicación',
    'form.step2': 'Medición',
    'form.step3': 'Evidencia',
    'form.step4': 'Firma',
    'form.prev_step': '← Anterior',
    'form.step_prev_btn': '← Paso {step}',
    'form.next_step': 'Siguiente Paso →',
    'form.submit_btn': '✓ Firmar y Emitir Protocolo',
    'form.quality_advisory_title': '⚠️ Advertencia de Control de Calidad',
    'form.quality_advisory_nc_text': 'Se detectaron parámetros fuera de la tolerancia técnica exigida. Si continúa, el protocolo se emitirá como NO CONFORME y se registrará automáticamente una No Conformidad (NC).',
    'form.quality_advisory_fix': 'Corregir Medición',
    'form.quality_advisory_continue': 'Continuar con NC →',
    'form.pre_verdict_pass': '✅ Mediciones Conformes: Todos los parámetros cumplen las tolerancias técnicas.',
    'form.pre_verdict_nc': '⚠️ Alerta de Calidad: Hay parámetros fuera de tolerancia. Se emitirá como NO CONFORME con apertura de NC.',
    'validation.slump_out': '⚠️ Fuera de tolerancia ({range} cm). Generará No Conformidad (NC).',
    'validation.slump_ok': '✓ Conforme con diseño ({range} cm)',
    'validation.cylinders_out': '⚠️ Muestreo insuficiente (mínimo {min} probetas)',
    'validation.cylinders_ok': '✓ Muestreo reglamentario (≥ {min} probetas)',
    'validation.elev_out': '⚠️ Desviación excesiva (tolerancia ≤ {max} cm). Generará NC.',
    'validation.elev_ok': '✓ Nivelación conforme (≤ {max} cm)',
    'validation.comp_out': '⚠️ Densidad insuficiente (exigido ≥ {min}% Proctor). Generará NC.',
    'validation.comp_ok': '✓ Grado de compactación conforme (≥ {min}%)',
    'validation.moisture_out': '⚠️ Humedad fuera de tolerancia (±{max}%). Generará NC.',
    'validation.moisture_ok': '✓ Humedad conforme (±{max}%)',
    'validation.subbase_out': '⚠️ Espesor sub-base insuficiente (exigido ≥ {min} cm). Generará NC.',
    'validation.subbase_ok': '✓ Espesor sub-base conforme (≥ {min} cm)',
    'validation.base_out': '⚠️ Espesor base insuficiente (exigido ≥ {min} cm). Generará NC.',
    'validation.base_ok': '✓ Espesor base conforme (≥ {min} cm)',
    'validation.spacing_out': '⚠️ Espaciamiento fuera de tolerancia ({range} cm). Generará NC.',
    'validation.spacing_ok': '✓ Espaciamiento de acero conforme ({range} cm)',
    'validation.cover_out': '⚠️ Recubrimiento insuficiente (mínimo ≥ {min} cm). Generará NC.',
    'validation.cover_ok': '✓ Recubrimiento de concreto conforme (≥ {min} cm)',


    // Step 1: Location
    'step1.title': 'Paso 1: Segmento y Coordenadas',
    'step1.chainage': 'Progresiva (Km + Metros)',
    'step1.chainage_hint': 'Ejemplo: 0+144 para el metro 144',
    'step1.panel': 'Paño / Elemento Estructural',
    'step1.panel_hint': 'Número de paño de pavimento o elemento',
    'step1.gps_title': 'Georreferenciación GPS Automática',
    'step1.gps_hint': 'Coordenadas grabadas con sello de tiempo inmutable.',

    // Step 2: Concrete
    'concrete.step_title': 'Paso 2: Vaciado y Control de Camiones Mixer',
    'concrete.formwork_title': '1. Checklist Previo al Vaciado (Encofrado)',
    'concrete.formwork_label': 'Encofrado Verificado y Aprobado',
    'concrete.formwork_desc': 'Dimensiones, nivelación, alineamiento y estanqueidad conformes.',
    'concrete.trucks_title': '2. Control Individual por Camión Mixer (Llegada)',
    'concrete.add_truck': '+ Agregar Camión Mixer',
    'concrete.truck_header': 'Camión Mixer #{number}',
    'concrete.remove_truck': 'Eliminar',
    'concrete.mixer_id': 'Identificador de Mixer',
    'concrete.delivery_note': 'Guía de Remisión de Concreto',
    'concrete.slump': 'Asentamiento / Slump (Cono de Abrams)',
    'concrete.slump_hint': 'Rango exigido: {range} cm',
    'concrete.cylinders': 'Probetas / Testigos a Molotear',
    'concrete.design_fc': "Resistencia de Diseño f'c",

    // Step 2: Survey, Compaction, Steel
    'survey.step_title': 'Paso 2: Topografía y Control Geométrico',
    'survey.elevation': 'Desviación de Cota respecto al Diseño',
    'compaction.step_title': 'Paso 2: Ensayos de Suelos y Compactación',
    'compaction.pct': 'Grado de Compactación (% Proctor Modificado)',
    'compaction.moisture': 'Desviación de Humedad respecto al Óptimo',
    'compaction.subbase': 'Espesor de Sub-base Granular',
    'compaction.base': 'Espesor de Base Granular',
    'steel.step_title': 'Paso 2: Inspección de Acero de Refuerzo',
    'steel.spacing': 'Espaciamiento entre Varillas de Refuerzo',
    'steel.cover': 'Recubrimiento Libre de Concreto',

    // Step 3: Evidence
    'step3.title': 'Paso 3: Evidencia Fotográfica y Georreferenciada',
    'step3.capture_btn': '📷 Tomar Foto de Campo',
    'step3.hint': 'Las fotos se almacenan con coordenadas GPS y hash SHA-256 inmutable.',

    // Step 4: Signature
    'step4.title': 'Paso 4: Declaración Jurada y Emisión',
    'step4.tech_label': 'Especialista Firmante',
    'step4.notes_label': 'Observaciones Adicionales de Campo (Opcional)',
    'step4.declaration': 'Declaro que las mediciones corresponden fielmente a los ensayos in-situ ejecutados según normativa aplicable.',

    // Verdict View
    'verdict.title': 'Veredicto de Control de Calidad',
    'verdict.pass_title': 'CONFORME / APROBADO',
    'verdict.provisional_title': 'APROBACIÓN PROVISIONAL',
    'verdict.provisional_desc': 'Protocolo conforme en campo. Veredicto final condicionado al ensayo de compresión de probetas a 28 días.',
    'verdict.fail_title': 'NO CONFORME',
    'verdict.fail_desc': 'Una o más mediciones se encuentran fuera de la tolerancia técnica exigida. Se abrió No Conformidad.',
    'verdict.pdf_btn': '📄 Ver Certificado Oficial (PDF)',
    'verdict.new_protocol': 'Nuevo Registro de Campo',
    'verdict.status_view': 'Ver Estado del Proyecto',

    // Status View
    'status.title': 'Estado de Calidad y Trazabilidad',
    'status.back': '← Volver al Campo',
    'status.refresh': '🔄 Actualizar',
    'status.total_expected': 'Total Esperados',
    'status.passed': 'Aprobados (Pass)',
    'status.provisional': 'Provisionales (Lab)',
    'status.failed': 'No Conformes (NC)',
    'status.dossier_title': 'Dosier de Calidad Oficial',
    'status.dossier_desc': 'Compila todos los protocolos, actas y ensayos en un PDF único para valorización.',
    'status.dossier_btn': '📦 Generar Dosier (PDF)',
    'status.record_break_title': 'Registrar Rotura de Probeta (Laboratorio)',
    'status.record_break_btn': 'Registrar Rotura Lab →',

    // Project Setup View
    'setup.title': 'Configuración y Creación de Proyecto',
    'setup.subtitle': 'Cree o configure parámetros y criterios específicos de cada obra.',
    'setup.back': '← Volver',
    'setup.id': 'ID del Proyecto (Código Único)',
    'setup.id_hint': 'Ejemplo: AY-728-001 o CUST-2026-02',
    'setup.name': 'Nombre Completo de la Obra',
    'setup.contract': 'Número de Contrato',
    'setup.entity': 'Entidad Propietaria / Gobierno Regional',
    'setup.mode': 'Modalidad de Ejecución',
    'setup.location': 'Ubicación Geográfica / Región',
    'setup.road_section': 'Tramo de Carretera / Progresivas',
    'setup.timezone': 'Zona Horaria',
    'setup.cylinders_per_truck': 'Probetas a moldear por Camión Mixer',
    'setup.default_fc': "f'c de Diseño por Defecto (kg/cm²)",
    'setup.slump_min': 'Asentamiento Slump Mínimo (cm)',
    'setup.slump_max': 'Asentamiento Slump Máximo (cm)',
    'setup.recipients': 'Teléfono(s) WhatsApp para Notificaciones',
    'setup.btn_create': '✓ Guardar y Activar Proyecto',
    'setup.success': '¡Proyecto configurado y activado exitosamente!'
  },
  en: {
    // Header & Navigation
    'brand.title': 'PROTOKOL',
    'brand.subtitle': 'Road Traceability',
    'nav.online': 'ONLINE',
    'nav.offline': 'OFFLINE',
    'nav.syncing': 'SYNCING',
    'nav.queued': '{count} QUEUED',
    'nav.lang_toggle': 'ES',
    'nav.projects': 'Projects',
    'nav.new_project': '+ New Project',

    // Project Portal View
    'portal.title': 'Highway Infrastructure Projects',
    'portal.subtitle': 'Select a project to enter field quality certification',
    'portal.search': 'Search by name, code, or road section...',
    'portal.open_project': 'Open Project →',
    'portal.empty': 'No registered projects found.',
    'portal.sampling': 'Sampling',
    'portal.default_fc': 'Base f\'c',
    'portal.change_project': '← Change Project',

    // Home View
    'home.quality_record': 'Field Quality Inspection',
    'home.select_activity': 'Select Activity to Certify',
    'home.act_concrete_title': '1. CONCRETE',
    'home.act_concrete_desc': 'Pour with multi-truck tracking, slump test, delivery notes, per-truck cylinders, and formwork checklist.',
    'home.act_survey_title': '2. SURVEY',
    'home.act_survey_desc': 'Geometric leveling, design elevation, and tolerance verification (≤ 1 cm).',
    'home.act_compaction_title': '3. COMPACTION',
    'home.act_compaction_desc': 'In-situ density (≥100% Modified Proctor), moisture deviation, and sub-base/base thickness.',
    'home.act_steel_title': '4. REINFORCING STEEL',
    'home.act_steel_desc': 'Rebar placement, spacing tolerance, and minimum concrete cover.',
    'home.btn_status_view': '📊 Quality Manager Status View →',
    'home.btn_project_config': '⚙️ Configuration / New Project →',

    // Identify View
    'identify.title': 'Field Technician Login',
    'identify.select_project': 'Active Project',
    'identify.select_tech': 'Responsible Engineer / Specialist',
    'identify.pin_label': 'Security PIN (4 digits)',
    'identify.pin_hint': 'Demo PIN: 1234',
    'identify.device_label': 'Physical Device Token',
    'identify.btn_submit': 'Enter Field Dashboard →',
    'identify.err_pin': 'PIN must contain exactly 4 digits.',

    // Protocol Form
    'form.back': '← Back',
    'form.back_to_activities': '← Activities',
    'form.exit': '✕ Exit',
    'form.confirm_exit': 'Exit current protocol? Unsubmitted changes will be lost.',
    'form.step1': 'Location',
    'form.step2': 'Measurement',
    'form.step3': 'Evidence',
    'form.step4': 'Sign',
    'form.prev_step': '← Previous',
    'form.step_prev_btn': '← Step {step}',
    'form.next_step': 'Next Step →',
    'form.submit_btn': '✓ Sign & Issue Protocol',
    'form.quality_advisory_title': '⚠️ Quality Control Advisory',
    'form.quality_advisory_nc_text': 'One or more measurements are outside technical tolerances. If you proceed, the protocol will be issued as NON-CONFORMING (FAIL) and open an automatic Non-Conformance (NC).',
    'form.quality_advisory_fix': 'Fix Measurement',
    'form.quality_advisory_continue': 'Proceed with NC →',
    'form.pre_verdict_pass': '✅ Compliant: All measurements meet engineering tolerances.',
    'form.pre_verdict_nc': '⚠️ Quality Warning: Parameters outside tolerance. Will be recorded as NON-CONFORMING with NC report.',
    'validation.slump_out': '⚠️ Out of tolerance ({range} cm). Will trigger Non-Conformance (NC).',
    'validation.slump_ok': '✓ Within design range ({range} cm)',
    'validation.cylinders_out': '⚠️ Insufficient sampling (minimum {min} cylinders)',
    'validation.cylinders_ok': '✓ Sampling compliant (≥ {min} cylinders)',
    'validation.elev_out': '⚠️ Excessive deviation (tolerance ≤ {max} cm). Will trigger NC.',
    'validation.elev_ok': '✓ Leveling compliant (≤ {max} cm)',
    'validation.comp_out': '⚠️ Insufficient compaction (required ≥ {min}% Proctor). Will trigger NC.',
    'validation.comp_ok': '✓ Compaction compliant (≥ {min}%)',
    'validation.moisture_out': '⚠️ Moisture out of tolerance (±{max}%). Will trigger NC.',
    'validation.moisture_ok': '✓ Moisture compliant (±{max}%)',
    'validation.subbase_out': '⚠️ Insufficient sub-base thickness (required ≥ {min} cm). Will trigger NC.',
    'validation.subbase_ok': '✓ Sub-base thickness compliant (≥ {min} cm)',
    'validation.base_out': '⚠️ Insufficient base thickness (required ≥ {min} cm). Will trigger NC.',
    'validation.base_ok': '✓ Base thickness compliant (≥ {min} cm)',
    'validation.spacing_out': '⚠️ Spacing out of tolerance ({range} cm). Will trigger NC.',
    'validation.spacing_ok': '✓ Rebar spacing compliant ({range} cm)',
    'validation.cover_out': '⚠️ Insufficient clear cover (required ≥ {min} cm). Will trigger NC.',
    'validation.cover_ok': '✓ Concrete cover compliant (≥ {min} cm)',


    // Step 1: Location
    'step1.title': 'Step 1: Section & GPS Coordinates',
    'step1.chainage': 'Chainage (Km + Meters)',
    'step1.chainage_hint': 'Example: 0+144 for meter 144',
    'step1.panel': 'Panel / Structural Element',
    'step1.panel_hint': 'Pavement slab number or element tag',
    'step1.gps_title': 'Automatic GPS Georeferencing',
    'step1.gps_hint': 'Coordinates recorded with tamper-proof timestamp.',

    // Step 2: Concrete
    'concrete.step_title': 'Step 2: Concrete Pour & Mixer Trucks Control',
    'concrete.formwork_title': '1. Pre-pour Formwork Checklist',
    'concrete.formwork_label': 'Formwork Verified & Approved',
    'concrete.formwork_desc': 'Dimensions, leveling, alignment, and tightness compliant.',
    'concrete.trucks_title': '2. Individual Ready-Mix Truck Control (Arrival)',
    'concrete.add_truck': '+ Add Ready-Mix Truck',
    'concrete.truck_header': 'Mixer Truck #{number}',
    'concrete.remove_truck': 'Remove',
    'concrete.mixer_id': 'Mixer Unit ID',
    'concrete.delivery_note': 'Delivery Note (Guía)',
    'concrete.slump': 'Consistency Slump (Abrams Cone)',
    'concrete.slump_hint': 'Required Range: {range} cm',
    'concrete.cylinders': 'Cylinders Molded per Truck',
    'concrete.design_fc': "Design Compressive Strength f'c",

    // Step 2: Survey, Compaction, Steel
    'survey.step_title': 'Step 2: Surveying & Geometric Control',
    'survey.elevation': 'Elevation Deviation from Design',
    'compaction.step_title': 'Step 2: Soils & Compaction Testing',
    'compaction.pct': 'Compaction Degree (% Modified Proctor)',
    'compaction.moisture': 'Moisture Deviation from Optimum',
    'compaction.subbase': 'Granular Sub-base Thickness',
    'compaction.base': 'Granular Base Thickness',
    'steel.step_title': 'Step 2: Reinforcement Steel Inspection',
    'steel.spacing': 'Rebar Spacing Tolerance',
    'steel.cover': 'Clear Concrete Cover',

    // Step 3: Evidence
    'step3.title': 'Step 3: Photographic Evidence & Georeferencing',
    'step3.capture_btn': '📷 Capture Field Photo',
    'step3.hint': 'Photos are stored with GPS metadata and SHA-256 integrity hash.',

    // Step 4: Signature
    'step4.title': 'Step 4: Formal Declaration & Issuance',
    'step4.tech_label': 'Signing Specialist',
    'step4.notes_label': 'Field Notes & Observations (Optional)',
    'step4.declaration': 'I formally certify that the recorded values reflect in-situ measurements taken per technical specifications.',

    // Verdict View
    'verdict.title': 'Quality Control Verdict',
    'verdict.pass_title': 'CONFORMING / APPROVED',
    'verdict.provisional_title': 'PROVISIONAL APPROVAL',
    'verdict.provisional_desc': 'Field parameters compliant. Final sign-off pending 28-day cylinder compressive break.',
    'verdict.fail_title': 'NON-CONFORMING',
    'verdict.fail_desc': 'One or more values fall outside the required tolerance. Non-conformance opened.',
    'verdict.pdf_btn': '📄 View Official Certificate (PDF)',
    'verdict.new_protocol': 'New Field Inspection',
    'verdict.status_view': 'View Project Status',

    // Status View
    'status.title': 'Project Quality Status & Traceability',
    'status.back': '← Back to Field',
    'status.refresh': '🔄 Refresh',
    'status.total_expected': 'Total Expected',
    'status.passed': 'Passed',
    'status.provisional': 'Provisional (Lab)',
    'status.failed': 'Non-Conformances',
    'status.dossier_title': 'Official Quality Dossier',
    'status.dossier_desc': 'Compiles all protocols, certificates, and test results into a single payment backing PDF.',
    'status.dossier_btn': '📦 Generate Dossier (PDF)',
    'status.record_break_title': 'Record Cylinder Break (Laboratory)',
    'status.record_break_btn': 'Submit Lab Result →',

    // Project Setup View
    'setup.title': 'Project Configuration & Setup',
    'setup.subtitle': 'Create or customize contract details, sampling rules, and technical criteria.',
    'setup.back': '← Back',
    'setup.id': 'Project ID (Unique Code)',
    'setup.id_hint': 'Example: AY-728-001 or PROJECT-B',
    'setup.name': 'Full Project / Contract Name',
    'setup.contract': 'Contract Number',
    'setup.entity': 'Owner Entity / Regional Government',
    'setup.mode': 'Execution Mode',
    'setup.location': 'Geographic Location',
    'setup.road_section': 'Road Section / Chainage',
    'setup.timezone': 'Timezone',
    'setup.cylinders_per_truck': 'Cylinders Molded per Mixer Truck',
    'setup.default_fc': "Default Design Strength f'c (kg/cm²)",
    'setup.slump_min': 'Minimum Slump (cm)',
    'setup.slump_max': 'Maximum Slump (cm)',
    'setup.recipients': 'WhatsApp Alert Recipients (Phone)',
    'setup.btn_create': '✓ Save & Activate Project',
    'setup.success': 'Project configured and activated successfully!'
  }
};

let currentLanguage = (typeof localStorage !== 'undefined' ? localStorage.getItem('protokol_lang') : null) || 'es';
const listeners = [];

export function getLanguage() {
  return currentLanguage;
}

export function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('protokol_lang', lang);
    }
    listeners.forEach(fn => fn(lang));
  }
}

export function onLanguageChange(fn) {
  listeners.push(fn);
}

export function t(key, params = {}) {
  const dict = translations[currentLanguage] || translations['es'];
  let str = dict[key] || translations['es'][key] || key;
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return str;
}
