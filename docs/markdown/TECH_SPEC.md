# PROTOKOL — TECH_SPEC (Especificación Técnica)

**Documento:** Technical Product Document v2.4 — Trazabilidad de Calidad para Infraestructura Pública
**Para:** Snehil Sahay (Ingeniería)
**Estado:** Pre-build. Nada codeado.
**Fuente:** `docs/originales/PROTOKOL_TECHNICAL_DOC_v2_4.pdf` (v2.4, septiembre 2026 — corregido post-auditoría: contratos API con rango real de slump y cilindros por mixer; preguntas 3 y 7 respondidas; 3 competidores confirmados adicionales)

---

## 1. Arquitectura — tres capas

### Capa 1 — Captura (campo)
PWA sin instalación, sin creación de cuenta, abre desde un link, funciona en Android de gama baja con señal
intermitente. El técnico registra lo que acaba de hacer en menos de 5 minutos.

- Formularios guiados por tipo de actividad (no captura libre)
- Cámara con coordenadas GPS y timestamp a prueba de manipulación
- **Offline-first**: encola localmente y sincroniza al volver la señal
- Validación en tiempo real — el técnico sabe de inmediato si un valor está fuera de rango

### Capa 2 — Inteligencia (backend)
Mantiene el estado verdadero del proyecto y hace cumplir las reglas.

- Valida cada valor enviado contra criterios del proyecto cargados como datos
- Abre automáticamente una No Conformidad cuando un valor falla
- Rastrea el estado de liberación de cada paño en cada etapa de protocolo
- Maneja el flujo diferido: resultados de probetas que llegan 7 y 28 días después del vaciado
- Almacén de evidencia inmutable — registros append-only con hash de integridad

### Capa 3 — Salida (oficina y Estado)

- PDF de protocolo generado por registro, en el formato que acepta la supervisión
- Vista de estado en vivo para el jefe de calidad (liberado / pendiente / no conforme)
- Compilación del dosier de calidad para cierre de contrato
- Exportación en estructura compatible con INFOBRAS

**Límite de autoridad:** los contratos de API definen qué cruza la frontera. Todo lo interno (stack,
framework, patrones, despliegue) es decisión de ingeniería.

---

## 2. Contratos API

### 2.1 `POST /protocols`
Enviado cuando el técnico completa un formulario. El servidor valida contra criterios almacenados y devuelve veredicto.

```jsonc
// Request
{
  "project_id":    "AY-728-001",
  "device_token":  "dvc_8f3a...",       // emitido una vez por dispositivo
  "technician_pin":"1234",
  "activity":      "CONCRETE",           // CONCRETE | SURVEY | COMPACTION | STEEL
  "recorded_at":   "2026-09-11T08:47:00-05:00",
  "gps":           { "lat": -13.1588, "lng": -74.2236 },
  "panel":         "15",
  "chainage":      "0+144",
  "measurements":  {
     "slump":           "4",            // selector discreto: "3.5" | "4" | "4.5" | "5" (pulgadas)
     "mixer_id":       "6D37",
     "delivery_note":  "GR-00412",       // guía de despacho (documento legal)
     "cylinders_cast": 4,                // 4 por mixer (carmix), confirmado 16-Sep-2026
     "design_fc":      210
  },
  "photo_ids":     ["ph_a91c...", "ph_b22e..."],
  "notes":         ""
}

// Response
{
  "protocol_id":   "PRT-20260911-0847-015",
  "verdict":       "PROVISIONAL_PASS",   // PASS | PROVISIONAL_PASS | FAIL
  "checks": [
     { "field":"slump", "expected":["3.5","4","4.5","5"], "actual":"4", "result":"PASS" }
  ],
  "nonconformance_id": null,
  "pdf_url":       "https://.../PRT-20260911-0847-015.pdf",
  "pending":       ["CYLINDER_7D","CYLINDER_28D"]
}
```

> **PROVISIONAL_PASS importa**: un vaciado no puede certificarse definitivamente hasta que lleguen las
> roturas de probetas semanas después. Modelar veredicto en dos etapas es requisito de dominio, no adorno.

**Matiz operativo (16-Sep-2026):** un solo vaciado puede involucrar 20+ cargas de mixer (guías de despacho),
cada una con su propia lectura de slump y su propio set de 4 probetas. El registro de concreto debe contener
**una lista de entradas por mixer**, no un solo par slump/probetas por protocolo.

**Slump como selector discreto (feedback David ~20-Sep-2026):** el slump no se captura como número en un
rango. Es **selección de un valor discreto** — `3.5" | 4" | 4.5" | 5"` — uno por mixer, porque cada mixer
llega con slump distinto y el técnico elige cuál le tocó. El rango 8.9–12.7 cm (16-Sep) corresponde a esa
banda de 3.5"–5" y queda como banda de referencia; el criterio se carga como datos con operador
`in` + `allowed_values`.

### 2.2 `POST /protocols/{id}/cylinder-result`
Cuando el laboratorio devuelve resistencia a 7 o 28 días. Convierte provisional en final, o abre NC.

```jsonc
{
  "age_days":       28,
  "cylinder_code":  "P-2026-0847-A",
  "strength_kgcm2": 231,
  "lab":            "AKHISE",
  "report_photo_id":"ph_c77d..."
}
```

### 2.3 `GET /projects/{id}/status`
Estado de liberación actual de todo el proyecto. Alimenta la vista de estado y, luego, el dashboard.

```jsonc
{
  "project_id":  "AY-728-001",
  "as_of":       "2026-09-11T09:15:00-05:00",
  "summary": {
     "total_expected": 84,
     "passed":         71,
     "provisional":    6,
     "failed":         3,
     "missing":        4
  },
  "protocols": [ /* ... */ ]
}
```

### 2.4 `GET /projects/{id}/dossier`
Compila protocolos, fotos, resultados de laboratorio y NCs en el paquete de dosier de calidad.

```jsonc
{
  "dossier_url":        "https://.../AY-728-dossier.pdf",
  "generated_at":       "2026-09-11T09:30:00-05:00",
  "protocols_included": 84,
  "open_nonconformances": 1,
  "completeness_pct":   94.2
}
```

---

## 3. Modelo de datos

### 3.1 Tablas core

| Tabla | Propósito | Campos críticos |
|---|---|---|
| `projects` | Una fila por proyecto | id, name, contract_number, entity, execution_mode |
| `protocols` | Artefacto central. Uno por actividad registrada. | id, project_id, activity, recorded_at (con timezone), gps, panel, chainage, measurements (JSON), verdict, device_token, integrity_hash |
| `criteria` | Umbrales de validación por proyecto, cargados como datos | project_id, activity, field, operator, min, max, source_reference |
| `cylinders` | Probetas y sus resultados diferidos | protocol_id, cylinder_code, cast_date, test_date, age_days, strength, lab |
| `nonconformances` | Fallas que requieren acción correctiva | protocol_id, description, status, corrective_action, closed_at |
| `photos` | Evidencia con metadatos | id, protocol_id, storage_key, gps, captured_at, hash |
| `technicians` | Usuarios de campo | id, project_id, name, pin_hash, device_token, whatsapp, role |
| `notifications` | Log de mensajes salientes | recipient, event_type, payload, sent_at, status |

### 3.2 Decisiones irreversibles (confirmadas 16-Sep-2026 — Snehil de acuerdo con las 4)

| Decisión | Por qué es irreversible | Recomendación |
|---|---|---|
| Criterios en código vs. base de datos | Si se hardcodea, todo el producto se diseña sobre supuestos monoproyecto; el retrofit toca todo | **Criterios como datos desde el día 1.** No negociable para el modelo de negocio |
| Manejo de timestamps | Registros sin timezone explícito quedan legalmente ambiguos para siempre; no se reparan retroactivamente | **UTC con offset explícito siempre.** Mostrar en hora local del proyecto |
| Mecanismo de identidad del técnico | El valor legal de cada registro depende de probar quién lo envió; no se re-firman registros pasados | **PIN para UX + device token persistente.** Guardar device + PIN + GPS + integrity_hash en cada registro |
| Referencias de fotos | Miles de fotos con URLs de proveedor embebidas en registros inmutables hacen dolorosa la migración | **ID opaco propio.** Resolver a URL al momento de leer. Nunca persistir URL de vendor dentro de un registro |

---

## 4. Criterios de validación — valores reales del proyecto piloto

Provienen del expediente técnico vinculante y del diseño de mezcla del laboratorio acreditado (AKHISE).
Se cargan como datos por proyecto, nunca como constantes.

| Actividad | Campo | Criterio de aprobación | Fuente |
|---|---|---|---|
| CONCRETE | `slump` | **Selector discreto: 3.5" / 4" / 4.5" / 5"** (unión de WhatsApp 16-Sep y reunión 20-Sep; banda de referencia 8.9–12.7 cm). Aplica por elemento, no por partida | Especialista de Calidad, 16-Sep + 20-Sep-2026 |
| CONCRETE | `design_fc` | Según partida: 140 / 175 / 210 / 245 / 280 kg/cm² | Expediente técnico |
| CONCRETE | `cylinders_cast` | 4 probetas por mixer (carmix), no por vaciado completo | Especialista de Calidad, 16-Sep-2026 |
| CYLINDER | `strength_kgcm2` | ≥ f'c de diseño a 28 días | EG-2013 |
| COMPACTION | `compaction_pct` | ≥ 100% del Proctor Modificado | Plan de calidad del proyecto |
| COMPACTION | `moisture_deviation` | Dentro de ±1.5% del óptimo | Plan de calidad del proyecto |
| COMPACTION | `sub_base_thickness` | ≥ 20 cm | Expediente técnico |
| COMPACTION | `base_thickness` | ≥ 25 cm | Expediente técnico |
| SURVEY | `elevation_deviation` | ≤ 1 cm respecto al diseño | Plan de calidad del proyecto |
| STEEL | `bar_spacing_cm` | Según plano estructural, tolerancia por diámetro | Plano estructural |
| STEEL | `concrete_cover_cm` | Recubrimiento mínimo por tipo de elemento | EG-2013 / plano |

---

## 5. Datos confirmados del proyecto piloto (16-Sep-2026)

- **Proyecto:** Mejoramiento y ampliación de transitabilidad vial, tramo AY-728 a AY-729
- **Ubicación:** Región Ayacucho, Perú · **Longitud:** 2.38 km
- **Contrato:** N° 81-2026-GRA-SEDECENTRAL-OAPF · **Propietario:** Gobierno Regional de Ayacucho
- **Modalidad:** Administración Directa
- **Presupuesto:** S/ 16.3M → reformulado a S/ 41.9M (+156%)
- **Plazo:** 240 días → 1,325 días calendario · **Ampliaciones:** 10 (AP01–AP10)
- **Avance:** 53.19% físico / 68.37% financiero
- **Alcance:** pavimento rígido, asfalto, puente, sardineles, veredas, alcantarillas, muros de gravedad y contención
- **Firmantes reales de protocolos (6 protocolos firmados en campo):**
  - Ing. Edison Cuadros García — Residente de Obra, CIP 302775
  - David Valdez Ochoa — Especialista de Calidad (ejecución)
  - Ing. Teodoro Manuel Huamancusi Quispe — Supervisor, CIP 53548
  - Ing. Roly Conocachi Huamaní — Especialista de Estructuras (supervisión), CIP 76843
  - Ing. Cristian Manuel Torres Salinas — Especialista de Calidad (supervisión), CIP 260873
- Los códigos de plantilla de encofrado/acero que parecían versiones en conflicto son en realidad para
  **tipos de elemento distintos** (estructural vs. pavimento) — no es conflicto a resolver.
- Al menos un subcontratista (suministro de sub base) tiene su propio Especialista de Calidad firmando sus
  propios protocolos → el modelo debe permitir atar un protocolo a un alcance de subcontrato.

---

## 6. Forma de trabajo (acuerdo entre fundadores)

- **Autoridad:** stack/arquitectura → Snehil. Qué se construye y en qué orden → Kenny. Deadlock → gana la
  opción reversible; si ninguna lo es, se difiere.
- **Cadencia:** deploy semanal a un link abrible en teléfono. Kenny prueba en ≤48 h y responde por escrito.
  Una llamada de 30 min semanal (bloqueos → decisiones → demo).
- **Preguntas de dominio:** nunca adivinar. Si una decisión depende del proceso físico o legal → marcarla
  como DOMAIN BLOCKER. Kenny responde en ≤24 h (≤48 h si consulta campo). Cada respuesta de dominio se
  escribe en el documento (fuente de verdad), no solo en el chat.
- **Decision records:** cada decisión de arquitectura genera un archivo corto en el repo (contexto, decisión,
  consecuencias, rating de reversibilidad).
- **Definition of done:** desplegado y alcanzable por link · cumple criterios de aceptación · probado por
  Kenny en teléfono real · decisión de arquitectura registrada.
