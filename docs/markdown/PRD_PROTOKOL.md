# PROTOKOL — PRD (Product Requirements Document)

**Producto:** PROTOKOL — Trazabilidad de Calidad para Infraestructura Pública
**Mercado:** Obra pública vial, Perú (Administración Directa + INFOBRAS)
**Estado:** Pre-build. Nada se ha codeado aún.
**Fuentes:** `docs/originales/PROTOKOL_TECHNICAL_DOC_v2.docx` a `_v2_4` (docx + pdf), `PROTOKOL_David_v3.docx`,
`Dossier_PROTOKOL.docx`, `CRASH_PRD_v1.docx`, `CRASH_AUDITORIA_v1.docx`, `PROTOKOL_AUDITORIA_II/III.docx`,
`dossier-hallazgos-gestion-calidad-pavimento.md`
**Fecha:** Septiembre 2026

> Historial de versiones del Technical Product Document (v2.0 → v2.4):
> - **v2.1** — agrega hallazgos de la reunión presencial (12-Sep): estructura de equipos, terminología PPI,
>   competidor confirmado (Acofile Q), alcance Fase 0 de 4 actividades (se suma Acero) y estructura de desembolso por hitos.
> - **v2.2** — agrega Sección 12 (direcciones futuras del canal comercial) y la pregunta 7 a Snehil.
> - **v2.3** — agrega umbrales reales confirmados (slump 8.9–12.7 cm, 4 cilindros por mixer, f'c por partida),
>   roster de firmantes con números CIP, evidencia de 6 protocolos firmados, alcance de subcontratista, y la
>   corrección: los códigos de plantilla encofrado/acero no son versiones en conflicto sino tipos de elemento.
> - **v2.4** — correcciones post-auditoría: ejemplos de contratos API alineados al slump y cilindros reales,
>   preguntas 3 y 7 marcadas como respondidas por Snehil, y 3 competidores confirmados adicionales
>   (Calidad Cloud, ObraLink, Bildin).

> Nota: este archivo se llamó originalmente PRD_CRASH.md por error; el nombre correcto es PRD_PROTOKOL.md.

---

## 1. Resumen ejecutivo

Tenemos acceso privilegiado a un proyecto de infraestructura pública viva en Perú: un contrato de
construcción vial de **S/ 41.9M (≈ USD 11M)**, incluyendo su archivo documental completo, su canal de
coordinación interno y su especialista de calidad. Analizamos **487 archivos** y el historial completo del
chat del equipo durante seis semanas.

Lo que encontramos: un sistema de documentación **legalmente obligatorio, financieramente bloqueante y
completamente roto**. Los registros de calidad que exige la ley se llevan en cuadernos de papel, WhatsApp
y Excels que se contradicen entre sí. Sin esos registros, el contratista no cobra, y el ingeniero de calidad
responde personalmente por 7 años.

**PROTOKOL es el sistema que lo arregla**: captura datos de calidad en el punto donde ocurre el trabajo,
los valida contra la norma técnica vinculante y produce el paquete documental que exige el Estado —
automáticamente.

### Por qué vale la pena construirlo

| Factor | Evidencia |
|---|---|
| Problema real y documentado | El jefe de calidad escribió en mayúsculas al equipo: "AS OF TODAY WE ARE NOT MANAGING TO COMPLETE THE PROTOCOLS" |
| Mercado grande | 2,741 obras públicas paralizadas en Perú, más de S/ 67 mil millones en inversión comprometida |
| Acceso interno | Acceso total al archivo, chat y procesos de un proyecto vivo — la competencia construye a ciegas |
| Disparador de pago | La documentación faltante bloquea la valorización mensual (certificado de pago) |
| Canal comercial | Un ingeniero civil con reputación sectorial y contactos institucionales listo para venderlo |

---

## 2. Roles del proyecto piloto

| Persona | Rol |
|---|---|
| Kenny Garamendi | Producto, investigación, go-to-market (fundador) |
| Snehil Sahay | Ingeniería, arquitectura, implementación (fundador — autoridad técnica total) |
| David Valdez Ochoa | Experto de dominio y canal comercial. Ingeniero civil, Especialista de Calidad del proyecto piloto. Socio comercial (no fundador; términos por definir) |

**Financiamiento Fase 0:** se espera desembolso por hitos (pago inicial, pago intermedio, resto contra
entrega). Porcentajes y fechas en negociación con David. Regla de trabajo (v2.4 §2): Snehil planifica su
tiempo y facturación alrededor de los pagos por hitos, no de una transferencia única; los montos y fechas
exactos se confirman antes de arrancar Fase 0 y este documento se actualizará cuando queden fijados.
Precio propuesto por Snehil: **USD 2,500** de desarrollo, infraestructura y servicios aparte (David_v3).

---

## 3. El problema (hallazgos verificados)

Cada hallazgo está respaldado por artefactos específicos que poseemos:

1. **Los registros de calidad no se completan y todos lo saben** — el 8-Ago-2026 el Especialista de Calidad
   escribió al grupo en mayúsculas pidiendo que completen los protocolos. Nadie respondió. El cuello de
   botella no es conciencia: es **fricción al momento de registrar**.
2. **Cinco fuentes de verdad paralelas para los mismos datos** — cronograma de vaciados (Excel), registro de
   despachos de concreto (Excel, 137 filas), plantilla de ensayos de laboratorio, cuaderno de papel de
   cemento por elemento y tracker maestro de protocolos. Ninguna se reconcilia. Evidencia: dos versiones
   del mismo archivo con 96.5 m³ vs 39.9 m³ de concreto para el mismo tramo. Además, el mismo plano
   (DM_3-4_TOTORA_YANAMILLA) circula en 4 formatos distintos (.dwg nativo, PDF limpio, escaneo de
   fotocopiadora y un duplicado con otro nombre); dos de esos archivos son byte-por-byte idénticos con
   nombres diferentes.
3. **El papel pierde datos para siempre** — un registro del cuaderno de cemento tiene un signo de
   interrogación escrito a mano en la cantidad. Dato irrecuperable.
4. **El tracker maestro tiene contradicciones** — 26 de 84 filas con avance >100% (hasta 154%); 17 filas con
   No Conformidades registradas pero marcadas "Cumplido".
5. **Procedimientos copiados de un proyecto minero anterior sin adaptar** — carátula correcta de esta obra,
   cuerpo que menciona "Nueva Fuerabamba" y "GyM S.A." (2011-2012). Riesgo serio de control documentario
   en contrato estatal.
6. **Ya tienen software de construcción y la calidad igual corre por WhatsApp** — Fieldwire está instalado
   pero casi no se usa; toda interacción crítica de calidad fluye por WhatsApp. Las plataformas generales no
   cubren la **cadena de liberación de protocolos por capa**.
7. **El sistema de calidad no existió hasta hace 3 meses** — al entrar en junio 2026 (obra con ~4 años de
   ejecución) no había plan de calidad, ni procedimientos, ni dosier, ni registro de No Conformidades.
   Ya hay defectos físicos: fisuras en 2 muros de contención y cangrejeras en varios muros.

---

## 4. Contexto de dominio (lo que el sistema modela)

Una carretera de concreto no se vacía de una vez: se construye en **capas horizontales** y cada capa debe
aprobarse antes de que la siguiente se apoye encima. Esa secuencia es el corazón del sistema.

| Paso | Actividad física | Qué se verifica |
|---|---|---|
| 1 | Subrasante: suelo natural cortado, nivelado, compactado | Densidad de compactación, humedad, cota |
| 2 | Sub base granular (20 cm) | Compactación ≥100% del Proctor, espesor, certificado de material |
| 3 | Base granular (25 cm) | Igual que sub base + ensayo de capacidad portante |
| 4 | Encofrado | Dimensiones, alineamiento, cota |
| 5 | Acero | Diámetro de barra, espaciamiento, recubrimiento |
| 6 | Vaciado de concreto | Slump a la llegada, probetas cilíndricas, ID de mixer |
| 7 | Curado | Método y duración |
| 8 | Rotura de probetas | Resistencia a 7 y 28 días vs f'c de diseño |

**Insight de arquitectura: esto es una máquina de estados sobre segmentos físicos (paños), no un CRUD
de formularios.**

El nombre formal de un "protocolo" es **PPI — Programa de Puntos de Inspección** (v2.1): define quién
inspecciona, qué norma aplica y si el punto es **hold point** (requiere visto bueno externo para continuar)
o **witness point** (verificación interna). Un elemento constructivo no tiene un solo protocolo: tiene una
cadena (ej. columna: Acero → Encofrado → Concreto; si es muro se agrega Topografía). Cada etapa se libera y
firma antes de tapar la siguiente.

**Matiz operativo del vaciado (16-Sep-2026):** un solo vaciado puede involucrar **20+ cargas de mixer**
(cada una con su guía de despacho, su lectura de slump y su set de 4 probetas). El registro de concreto debe
sostener una **lista de entradas por mixer**, no un solo par slump/probetas por protocolo.

### Actores e incentivos

| Actor | Qué hace | Incentivo frente a PROTOKOL |
|---|---|---|
| Técnico de campo | Ejecuta y mide en obra | Neutro/negativo — salvo que sea más rápido que lo actual |
| **Especialista de Calidad** | Firma conformidad. Responde 7 años | **FUERTEMENTE POSITIVO. Nuestro usuario y campeón. David.** |
| Residente de obra | Ejecuta; necesita la valorización mensual | Positivo — la documentación faltante le retrasa el pago |
| Supervisor | Auditor independiente del Estado | Positivo — menos tiempo persiguiendo papeles |
| Entidad estatal (GORE) | Propietaria del proyecto | Positivo institucional, lento en decisiones |
| Contraloría | Audita y sanciona | No es cliente, pero es la razón por la que nos necesitan |

Estructura de equipos confirmada en persona (12-Sep-2026): **Ejecución** = Residente, Especialista de
Suelos, Especialista de Calidad, Asistente, Especialista de Seguridad. **Supervisión** = Supervisor,
Especialista de Estructuras (solo puentes/concreto armado), Especialista de Calidad, Asistente.
El rol de Calidad está en ambos equipos → es el punto de entrada de PROTOKOL.
Esta estructura 5+4 es **estándar en la industria peruana** (v2.1: confirmada contra múltiples ofertas
laborales de los mismos roles), no particular de esta obra → el modelo técnico/aprobador se diseña sobre
estos roles, no sobre una jerarquía genérica de dos niveles.

**Firmantes reales de protocolos** (confirmados en 6 protocolos firmados en campo, 16-Sep-2026):

| Persona | Rol | CIP |
|---|---|---|
| Ing. Edison Cuadros García | Residente de Obra (ejecución) | CIP 302775 |
| David Valdez Ochoa | Especialista de Calidad (ejecución) | — |
| Ing. Teodoro Manuel Huamancusi Quispe | Supervisor | CIP 53548 |
| Ing. Roly Conocachi Huamaní | Especialista de Estructuras (supervisión) | CIP 76843 |
| Ing. Cristian Manuel Torres Salinas | Especialista de Calidad (supervisión) | CIP 260873 |

**Regla de subcontratista (v2.3):** al menos un subcontratista (suministro de sub base) tiene su propio
Especialista de Calidad firmando sus propios protocolos → el modelo debe permitir atar un protocolo a un
alcance de subcontratista, no solo al equipo de ejecución principal.

### Tres hechos legales/financieros que definen el negocio

1. **Los documentos de calidad gatean el dinero** — sin respaldo documentario la valorización es observada y
   el pago se retrasa (memos internos del proyecto lo prueban).
2. **Responsabilidad personal por 7 años** — Art. 1784 del Código Civil peruano; en obra pública mínimo 7 años
   desde la recepción. La documentación es la única defensa.
3. **Ya existe un sistema estatal obligatorio: INFOBRAS** — Directiva N° 017-2023-CG/GMPL (jun 2024). Es un
   **cuña comercial, no competencia**: PROTOKOL debe **alimentar** INFOBRAS, no competir con él.

---

## 5. Oportunidad y competencia

### Tamaño de mercado

- 2,741 obras públicas paralizadas en Perú (inicio 2026) — S/ 67+ mil millones (Contraloría)
- Causa líder citada: capacidad técnica insuficiente en gestión y documentación
- 32 proyectos auditados en 2026 duplicaron costo y triplicaron plazo
- Mercado direccionable: toda obra pública por Administración Directa en las 25 regiones

### Competencia (evaluación honesta)

| Competidor | Qué hace | Por qué no compite de frente |
|---|---|---|
| Acofile Q (España) | Digitaliza PPIs, offline, GPS bloqueado, NC con un clic | Vende a grandes EPC en Europa; no toca obra pública peruana ni INFOBRAS |
| Calidad Cloud (Chile) | 8,000+ proyectos, 13,000 usuarios; calidad + productividad + garantías; integra Procore | Solo construcción privada/inmobiliaria; sin mención de obra pública ni Perú |
| ObraLink (Chile/MX/UK) | Visión computacional + IoT para medir resistencia y avance sin formularios | Dirección de largo plazo de la categoría, no preocupación de Fase 0 |
| Bildin (Perú) | Productividad de mano de obra local; aliado de Calidad Cloud | No es herramienta de calidad; no toca Administración Directa ni INFOBRAS |

**Ninguno cubre la capa de cumplimiento**: criterios vinculantes de un proyecto específico, secuencia de
liberación capa por capa, resultados de laboratorio diferidos semanas después del vaciado, y dosier de
calidad en el formato que exige el Estado peruano.

### Defensibilidad (3 activos compuestos)

1. **Base de conocimiento normativo** — los criterios de cada obra están enterrados en su expediente técnico
   y diseños de mezcla; extraerlos requiere acceso de dominio. Cada proyecto procesado profundiza la librería.
2. **Integración con el sistema estatal** — alimentar INFOBRAS en el formato exigido es característica de
   cumplimiento, no de conveniencia. Las plataformas extranjeras no la construirán.
3. **Canal por credibilidad** — la confianza sectorial en Perú es personal.

### Cuña y escalera

| Etapa | Qué vendemos | A quién | Por qué compran |
|---|---|---|---|
| Cuña | Captura de registros de calidad + generación de dosier | Especialista de Calidad | Protección legal personal; deja de perseguir gente |
| Paso 2 | Paquete de respaldo de valorización | Residente / contratista | Destraba flujo de caja mensual |
| Paso 3 | Visibilidad de cumplimiento en tiempo real + feed INFOBRAS | Entidad estatal / supervisión | Preparación de auditoría, evitar sanciones |
| Paso 4 | Inteligencia de calidad multiproyecto regional | Gobierno Regional | Control de riesgo de obras paralizadas a nivel cartera |

---

## 6. Qué construimos (Fase 0 — build piloto)

**Pregunta única que Fase 0 debe responder:**
> ¿El equipo de campo registra datos de calidad a través de PROTOKOL sin que el jefe de calidad los persiga?

### En alcance

- **PWA** con formularios guiados para **5 actividades, cada una con su propio protocolo completo**
  (orden de obra: **Compactación → Topografía → Acero → Encofrado → Concreto**)
- **Prioridad de campo (pedido explícito de David, ~20-Sep-2026):** la obra está por iniciar pavimento y
  termina sep–nov 2026 → probar primero **Topografía, Encofrado y Concreto (pavimento)**; Compactación y
  Acero se completan después
- **El protocolo digital ES el formato de papel** — el checklist completo ítem por ítem (Cumple / No Cumple /
  No Aplica), no un resumen de 3–4 criterios. Lo único variable por protocolo: fecha de liberación, partida
  y progresiva inicial/final. La estructura del checklist es fija por tipo de actividad
- Backend API con los 4 endpoints de la especificación técnica:
  `POST /protocols`, `POST /protocols/{id}/cylinder-result`, `GET /projects/{id}/status`,
  `GET /projects/{id}/dossier` (v2.4 §8)
- Almacenamiento inmutable de registros con manejo de fotos
- **Criterios de validación del proyecto cargados como datos** (nunca hardcodeados)
- Generación de PDF de protocolo **con grilla de firmas por firmante** (cada especialista firma su recuadro
  ligado a su cuenta/PIN)
- Notificaciones WhatsApp al jefe de calidad
- Ingreso diferido de resultados de probetas (7 y 28 días)
- Vista de estado simple (una hoja sincronizada es aceptable)

### Parámetros de validación confirmados del piloto (v2.3/v2.4, cargados como datos)

| Actividad | Campo | Criterio de aprobación | Fuente |
|---|---|---|---|
| CONCRETE | `slump` | **Selector de valores discretos, no rango:** 3.5" / 4" / 4.5" / 5" (reunión 20-Sep dio 3.5/4/4.5; WhatsApp 16-Sep incluía 5" → unión de ambas fuentes). Cada mixer trae su slump; el técnico elige cuál le tocó | David, 16-Sep (WhatsApp) + ~20-Sep (reunión) |
| CONCRETE | `design_fc` | Según partida: 140 / 175 / 210 / 245 / 280 kg/cm² · **confirmado real: 280 kg/cm² pavimento, 210 kg/cm² muros/alcantarillas** — vive como **configuración interna**, NO en la pantalla de "Información General del Proyecto" | Expediente técnico + 16-Sep-2026 |
| CONCRETE | `cylinders_cast` | **4 probetas por mixer (carmix)**, no por vaciado completo · **número de guía registrado por cada mixer del día** | Especialista de Calidad, 16-Sep-2026 |
| CYLINDER | `strength_kgcm2` | ≥ f'c de diseño a 28 días | EG-2013 |
| COMPACTION | `compaction_pct` | ≥ 100% del Proctor Modificado | Plan de calidad |
| COMPACTION | `moisture_deviation` | Dentro de ±1.5% del óptimo | Plan de calidad |
| COMPACTION | `sub_base_thickness` / `base_thickness` | ≥ 20 cm / ≥ 25 cm | Expediente técnico |
| SURVEY | `elevation_deviation` | ≤ 1 cm respecto al diseño | Plan de calidad |
| STEEL | `bar_spacing_cm` / `concrete_cover_cm` | Según plano estructural, tolerancia por diámetro / recubrimiento mínimo por elemento | Plano estructural / EG-2013 |

> Nota v2.3: los códigos de plantilla de encofrado/acero que parecían versiones en conflicto son en
> realidad para **tipos de elemento distintos** (estructural vs. pavimento) — no es un conflicto a resolver.

### Rediseño del formulario — feedback del Ing. David sobre el MVP (~20-Sep-2026)

David probó el MVP en persona y su feedback redefine la UX del formulario. Es un rediseño real, no un parche:

1. **El protocolo digital debe SER el formato de papel, no un resumen.** Nada de pantalla con 3–4 criterios
   validados (como la prueba: formwork_approved / slump_cm / cylinders_cast). Replicar la lista de
   verificación completa tal cual los Excel/formatos reales que ya tenemos (ítem por ítem, columna
   Cumple / No Cumple / No Aplica). Lo único que se llena por protocolo: **fecha de liberación, partida,
   progresiva inicial y final**. El resto de la estructura es fija, igual al papel. David: "quiero que
   tenga esta misma estructura, que me valide el de calidad, supervisor, residente, y al final me reportan".
2. **Slump = selección, no rango.** Elegir uno de los valores discretos (3.5", 4", 4.5", 5") con selector —
   cada mixer llega con slump distinto y el técnico elige cuál le tocó; no escribe un número en rango.
3. **Progresiva y GPS quedan silenciosos.** La progresiva vive integrada dentro del formato del protocolo
   (no como pregunta separada); el GPS es dato interno que se captura solo, sin campo visible ni llenable.
4. **Firmas: un recuadro por firmante, como el papel.** Nada de botón único "Firmar y Emitir" que no firma
   nada. Replicar la grilla real de firmantes: cada especialista (calidad ejecución, calidad supervisión,
   supervisor, residente, estructuras cuando aplique) firma su propio recuadro ligado a su **cuenta/PIN**.
   David no entendió el botón "firmar" del MVP ("no sale mi firma").
5. **"Información del Contrato" → "Información General del Proyecto".** Ahí van: nombre de obra, número de
   contrato, entidad, tipo de proyecto (vial/edificación), tramo. Los criterios técnicos (f'c, slump) van
   **aparte, como configuración interna** — David: "criterio técnico… esto no debería ir".
6. **Equipo de Ingeniería se conecta a las firmas del PDF.** Los nombres cargados en esa sección deben
   aparecer en los recuadros de firma correspondientes del PDF generado, no solo guardarse en BD.
7. **Hallazgo de lenguaje: David no entendió "Aprobación Provisional"** ("¿qué es eso?"). El estado clave
   `PROVISIONAL_PASS` debe mostrarse en lenguaje claro, ej. **"Aprobado, pendiente resultado de laboratorio
   a 28 días"**, no la etiqueta sola. Mismo problema con "PIN de conformidad" del MVP.
8. **Sellos: pendiente — decisión técnica.** David lo dejó abierto ("tú ya sabes cómo se maneja").
   Propuesta a decidir con Snehil: subir imagen del sello igual que la firma.
9. **Cuentas de firma por especialista.** Crear cuentas/acceso para que cada firmante valide desde su
   celular ("una sola clave… para que tengan acceso y para que firmen"). La validación entre calidad
   ejecución y calidad supervisión ocurre "ese mismo instante".
10. **No Conformidad es su propio formato.** NC = notificar + evidenciar con fotos (ej. columna 40×40 en
    plano, 30×30 en campo). David valora tanto el registro de NC que mencionó la posibilidad de un
    aplicativo solo de NC — probarlo dentro del MVP actual.
11. **Dosier de Calidad = legajo completo.** Todos los protocolos + todas las NCs + todos los informes de
    laboratorio (roturas de testigos, ensayos de densidad de campo). David: "diario genero protocolos…
    todo eso sumas y ahí figura el dossier".
12. **Timing:** David corrige y vuelve a presentar "entre hoy y mañana"; objetivo de lanzamiento del MVP
    en campo **antes de fin de mes** (obra termina sep–nov 2026). Hay otra obra candidata en Juan Caulica
    (pistas y veredas) para probar adaptación, y posible uso futuro en edificación.

### Fuera de alcance (explícito)

- Dashboard web completo → Fase 1
- App móvil nativa → la PWA alcanza
- Soporte multiproyecto → un proyecto, hardcodeado, está bien
- Integración INFOBRAS → diseñar para ella, no construirla aún
- Facturación, suscripciones, onboarding autoservicio
- Autenticación compleja (ver identidad en spec técnica)

### Qué es y qué no es WhatsApp

WhatsApp es el canal de **notificación y escalamiento** (protocolo completado, NC abierta, registro vencido),
no el canal de captura. La captura va en la PWA porque calidad de foto, metadatos GPS y campos
estructurados importan legalmente y WhatsApp degrada los tres.

---

## 7. Criterios de aceptación (R1–R14)

1. **R1** — Al enviar un protocolo completo, persistir registro inmutable y responder veredicto en ≤5 s.
2. **R2** — Medición fuera de criterio → NC vinculada + notificación en ≤60 s.
3. **R3** — Sin conectividad → encolar localmente y sincronizar solo al volver la señal.
4. **R4** — Protocolo de concreto → `PROVISIONAL_PASS` hasta rotura a 28 días. **UI copy (feedback David):
   mostrar "Aprobado, pendiente resultado de laboratorio a 28 días" — la etiqueta "provisional" no se
   entiende.**
5. **R5** — Resistencia < f'c de diseño → veredicto `FAIL` + NC.
6. **R6** — Todo timestamp en UTC con offset explícito; nunca aceptar timestamp solo del cliente.
7. **R7** — Rechazar toda modificación de registros persistidos; correcciones vía nuevo registro vinculado.
8. **R8** — PDF generado con valores, fotos, identidad del técnico, timestamp y progresiva.
9. **R9** — Fotos con GPS y hora de captura como metadatos independientes del archivo.
10. **R10** — Protocolo esperado sin enviar 4 h después de la actividad → notificar al jefe de calidad.

### Criterios adicionales del feedback post-MVP (~20-Sep-2026)

11. **R11** — El formulario de cada actividad replica el **checklist completo del formato de papel**
    (ítem por ítem, Cumple / No Cumple / No Aplica); los únicos campos variables por instancia son fecha de
    liberación, partida y progresiva inicial/final.
12. **R12** — Slump se captura como **selección de valor discreto** (3.5" / 4" / 4.5" / 5"), nunca como
    input numérico en rango.
13. **R13** — La grilla de firmas del PDF tiene **un recuadro por firmante** (calidad ejecución, calidad
    supervisión, supervisor, residente, estructuras si aplica); cada firma queda ligada a la cuenta/PIN del
    firmante y a su timestamp.
14. **R14** — Progresiva y GPS no se muestran como campos llenables: progresiva integrada en el formato del
    protocolo, GPS como captura silenciosa con metadatos.

---

## 8. Gobernanza y reglas de negocio post-auditoría

De las tres auditorías internas (CRASH_AUDITORIA_v1, PROTOKOL_AUDITORIA_II y III) y de CRASH_PRD_v1.
No son alcance de build, son **gates de decisión del proyecto**.

### Gates antes de codear (Auditoría III — correcciones mínimas para enviar la spec)

1. Conversación de equity con Snehil (porcentaje, vesting, propiedad del código) — antes de enviar la spec.
2. Preguntar a 3 técnicos por qué NO llenan protocolos hoy (si la respuesta es "no me pagan por eso",
   ningún software lo arregla → reevaluar Fase 0).
3. Confirmar con David la fecha real de cierre de la obra piloto (53% de avance físico; si quedan <3 meses,
   recortar Fase 0 a la mitad).
4. Confirmación por escrito de David de que el proyecto es independiente de IADATA PERÚ (donde tiene un
   proyecto "Digitalización de Protocolos de Calidad").
5. Cumplimiento de datos personales e IA ya exigible en Perú: aviso de privacidad en la PWA antes del primer
   uso, consentimiento del técnico para ubicación/imagen, política de retención y registro de la BD ante la
   ANPDP (Ley 29733 + D.S. 016-2024-JUS, multas hasta 100 UIT; si se usa IA: Ley 31814 + D.S. 115-2025-PCM).

### Criterios de muerte (escritos de antemano — Auditoría III §5)

| Momento | Si pasa esto… | …entonces |
|---|---|---|
| Antes de codear | Los 3 técnicos dicen que el problema es tiempo/incentivo, no herramienta | Cambiar a Fase 0 alternativa (compilación del dosier para David) o replantear el producto |
| Antes de codear | David no confirma por escrito la independencia de su empleador | Pausar. No construir sobre base legal ambigua |
| Semana 2 | Snehil no ha desplegado nada accesible por link | Reevaluar su disponibilidad real |
| Semana 4 | Menos del 40% de protocolos se llenan con la herramienta | El problema no era el canal → pivotar a compilación o matar |
| Semana 6 | Nadie hizo ningún gesto de compra ni presentó PROTOKOL a otra obra | No hay negocio, hay favor. Decidir si continuar o parar |
| Mes 3 | Cerró la obra piloto sin un segundo cliente identificado | PROTOKOL fue un proyecto, no una empresa. Cerrar ordenadamente |

**Ruta alternativa validada (Auditoría III §4):** una Fase 0 alternativa — compilar lo que YA llega por
WhatsApp en protocolos estructurados + dosier para David (1 usuario, 1–2 semanas, cero cambio de hábito en
campo) — es la decisión consciente a tomar si las entrevistas a técnicos no respaldan la ruta de captura.

### Pricing referencial post-piloto (CRASH_PRD_v1 §6.2 — sujeto a validación de partida presupuestal)

| Plan | Para quién | Precio referencial | Incluye |
|---|---|---|---|
| Starter | Obra <S/5M, 1 actividad | S/ 600/mes por obra | Agente, tracker, PDF de protocolo |
| Pro | Obra S/5M–S/50M, multi-actividad | S/ 1,500/mes por obra | + dashboard, detector NC, generador de dosier |
| Enterprise | Gobierno Regional / multi-obra | A negociar (S/ 4,000+/mes) | + multi-obra, acceso supervisión, SLA |

> Pendiente de validar con David: bajo qué **partida presupuestal** se pagaría (probablemente como servicio
> de consultoría en gestión de calidad, no como SaaS). El piloto con la obra es gratuito.
> Referencia de modelo: la app gratuita que hoy usa el equipo de David es freemium con tope.

---

## 9. Direcciones futuras señaladas por el canal comercial (no Fase 0)

1. **Asistente basado en recuperación (RAG) para un solo rol** — propuesto por David: un asistente que
   responda contra los documentos normativos del Especialista de Calidad (o del Residente). Posible producto
   separado: más barato, vendible antes, financiaría el build mayor. Decisión de negocio aún no tomada.
2. **Acumular datos de calidad entre proyectos** — la base normativa acumulada como activo (análisis
   cross-proyecto, benchmarking). Impacto en Fase 0: **solo como restricción** — no encarecer la agregación
   multiproyecto futura. Decisión ya cubierta por "criterios como datos" (Sección 9.2 de la spec).

---

## 10. Preguntas abiertas al socio técnico (antes de codear)

1. ¿Cuántas horas semanales reales puede darle?
2. ¿Qué partes del documento no tienen sentido? (dominio ajeno)
3. ¿Acuerda las 4 decisiones irreversibles? — **RESPONDIDO 16-Sep-2026: de acuerdo con las cuatro.**
4. ¿Algo en los criterios de aceptación es técnicamente irrazonable o ambiguo?
5. ¿Qué infraestructura quiere y cuánto cuesta mensual? (para presupuestar)
6. ¿Construiría algo primero que no se haya propuesto?
7. ¿Las direcciones futuras cambian el modelo de datos de Fase 0? — **RESPONDIDO 16-Sep-2026: el RAG no
   cambia la arquitectura de Fase 0; multiproyecto solo influye con entidades con scope por proyecto, sin
   funcionalidad multiproyecto ahora.**
