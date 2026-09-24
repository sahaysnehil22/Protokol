# Expediente de Calidad — Inventario Técnico de Archivos de la Obra

**Fuente:** `docs/originales/chat_gcalidad/` (extraído del chat "G.Calidad en pavimento") +
`docs/originales/imagenes/` (fotos recibidas por WhatsApp) + documentos sueltos en `docs/originales/`
**Obra:** "Mejoramiento y ampliación del servicio de transitabilidad entre el tramo AY-728 (Penal de
Yanamilla) hasta el tramo AY-729 (PTAR)", 2.38 km, distrito Andrés Avelino Cáceres — Huamanga — Ayacucho.
**Contrato:** N° 81-2026-GRA-SEDECENTRAL-OAPF

---

## 1. Registros y plantillas de control (Excel)

### 1.1 GR-PROBETA JULIO-2026-PLANTILLA.xlsx
Plantilla oficial de **Control de Roturas de Probeta** (código interno SGC-CRP-2026).
- Campos: CÓDIGO DE PROBETA · UBICACIÓN · ESTRUCTURA/ELEMENTO · f'c (kg/cm²) · FECHA DE MUESTREO · EDAD ·
  FECHA DE ROTURA · f'c a "x" días · RESISTENCIA AL f'c (%) · DESCRIPCIÓN
- Firmas: ESPECIALISTA CALIDAD · Ing. RESIDENTE · SUPERVISOR DE OBRA · RESPONSABLE DE CAMPO ·
  ESTRUCTURISTA-SUPERVISOR
- Fila de ejemplo: M-13-1 → MURO C.A. 13-1 (muro de concreto armado)
- Es la plantilla base que el sistema debe replicar como salida PDF (criterio R8 de la spec).

### 1.2 Cronograma_Progresivas.xlsx
Cronograma de vaciado de pavimento por tramos:
- Columnas: Carril · Progresiva Inicial · Progresiva Final · Día Programado · Color
- Ejemplos: 0+000.00–0+082.73 MARTES 14 (Rojo) · 0+097.73–0+141.53 JUEVES 16 (Celeste) ·
  0+144.04–0+156.06 LUNES 27 (Vino)
- Uso: plan de qué paño se vacía cada día → alimenta la métrica "protocolos esperados por cronograma"
  (R10: alerta a las 4 h sin protocolo).

### 1.3 LLENADO POR DIAS.xlsx
Variante del cronograma por **carril Izquierdo/Derecho** con los mismos campos (progresivas, día, color).
Segunda fuente de verdad del mismo dato — evidencia del hallazgo "cinco fuentes paralelas".

### 1.4 INGRESO DE CONCRETO PREMEZCLADO TITAN.xlsx
Registro de despachos de concreto premix del proveedor **Concreto Titan**:
- Campos: M3 · FECHA · MATERIAL · PLACA · ITEM · N° O/ENT · CANT · VAN · TOTAL COMPRA · SEGÚN ORDEN ·
  1er/2do/3er ENTREGABLE · ENTREGADO · PENDIENTE · O/C CONCRETO TITAN
- Uso: control de volumen de concreto recibido por obra vs. orden de compra.

---

## 2. Planos y documentos de obra (PDF / DWG)

| Archivo | Páginas | Contenido |
|---|---|---|
| PAÑOS CON FECHA.pdf | 1 | Plano de distribución de **paños** del pavimento con juntas transversales (construcción, asfáltica, contracción con corte y sellado E=3/4"), bombeo S=2.00% y bermas |
| VACIADO POR FECHAS.pdf | 1 | Mismo plano de paños con **fechas de vaciado** por paño |
| IMPRIMIR.pdf | 5 | Lote de formatos de protocolo listos para imprimir (formato imagen) — el "papel" actual |
| DM_3-4_TOTORA_YANAMILLA.pdf | 36 | Planos del tramo 3-4 (Totora-Yanamilla) — escaneos de gran formato |
| DM_MEDIA_TOTORA_YANAMILLA.pdf | 36 | Planos del tramo media (Totora-Yanamilla) |
| yanamilla.dwg | — | Archivo AutoCAD del plano con **ortofoto** georreferenciada (enviado por +51 961 195 884) |
| INNOVACIÓN EN LA CONSTRUCCIÓN (1).pdf | 43 | Presentación de David Valdez (2026): "Innovación en la industria de la construcción con metodologías ágiles" — material de la reunión del 6-Ago |

---

## 3. Documentos de calidad sueltos (`docs/originales/`)

| Archivo | Contenido |
|---|---|
| EVEREST_Plan de Calidad_V01.docx | Plan de Calidad de la obra (PAC Everest V01) — fuente de criterios de compactación citados en CRASH_TECH_SPEC (EVEREST_PAC_01) |
| INFORME C-N003 SUBBASE.docx | Informe técnico de subbase (C-N003) — evidencia de informes de partidas |

---

## 4. Fotos de campo (WhatsApp)

### 4.1 `docs/originales/chat_gcalidad/` — 22 fotos (4–12 Ago 2026)
- IMG-20260804-WA0001 — obra (4-Ago)
- IMG-20260808-WA0006 — muestras de cunetas (8-Ago)
- IMG-20260810-WA0001..0004 — testigos muro 8-9 f'c 175 kg/cm² sin rotular (10-Ago, David)
- IMG-20260810-WA0030..0045 — fotos de muestreo de testigos y slump de veredas y cunetas (10-Ago noche)
- IMG-20260811-WA0025/0026 — dosier de calidad y referencia (11-Ago)
- IMG-20260812-WA0071 — protocolos de liberación, frentes de trabajo (12-Ago)

### 4.2 `docs/originales/imagenes/` — 13 fotos sueltas recibidas por WhatsApp
- 7 fotos del 15-Sep-2026 (11:51) — obra, sin clasificar
- 6 fotos del 18-Ago-2026 (21:16) — obra, sin clasificar
> Pendiente: clasificar estas fotos con David/técnicos (¿slump, probetas, curado, muros?) e integrarlas
> como evidencia con fecha/GPS en el sistema.

---

## 5. Vínculos con el sistema CRASH

| Archivo del expediente | Uso en CRASH |
|---|---|
| GR-PROBETA JULIO-2026-PLANTILLA.xlsx | Plantilla del PDF generado por protocolo de concreto / probetas |
| Cronograma_Progresivas / LLENADO POR DIAS | Fuente de "protocolos esperados por cronograma" (alertas R10, métrica de adopción) |
| INGRESO DE CONCRETO PREMEZCLADO TITAN | Modelo de datos de despachos por mixer (guías de despacho) |
| PAÑOS CON FECHA / VACIADO POR FECHAS | Referencia de paños y progresivas para pre-llenado GPS |
| EVEREST_Plan de Calidad_V01 | Criterios de compactación (Proctor ≥100%, humedad ±1.5%) |
| DM_3-4 / DM_MEDIA / yanamilla.dwg | Criterios de topografía (cota ≤1 cm) y geometría del tramo |

---

## 6. Observaciones del expediente (para el producto)

1. La plantilla de probetas confirma la nomenclatura oficial de elementos: "MURO C.A. 13-1" → el sistema
   debe capturar estructura/elemento, no solo paño.
2. El cronograma usa **días de semana + colores** (martes 14, rojo) — sin fechas absolutas en varias filas:
   riesgo de ambigüedad que el sistema debe resolver pidiendo fecha explícita.
3. Los planos DM son escaneos de 36 páginas (no vectoriales) — la georreferenciación real está en
   yanamilla.dwg (ortofoto).
4. El dosier requerido por David (deflectometría cada 25 m, vehículo C2 82 kN, Viga Benkelman calibrada)
   excede las 3 actividades de Fase 0 → candidatos a protocolos de Fase 1+ (sub base/base granular).
