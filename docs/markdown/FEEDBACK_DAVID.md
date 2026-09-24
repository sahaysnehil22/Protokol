# PROTOKOL — Feedback y acuerdos con el Ing. David

**Documento original:** `docs/originales/PROTOKOL_David.docx`
**Título:** Hallazgos de la obra AY-728 / AY-729 y propuesta de sistema de calidad
**Fecha:** 12-Sep-2026 · **Dirigido a:** Ing. David Valdez Ochoa (Especialista de Calidad)

---

## 1. Contexto

Con acceso al Drive de la obra, al grupo del equipo y a los archivos de control de calidad, se revisó a fondo:
protocolos, informes, planos, chat del equipo y archivos de control de calidad. Este documento resume los
hallazgos y la propuesta.

---

## 2. Lo que se encontró

1. **Obra desde 2022, con 10 ampliaciones de plazo** y presupuesto que subió de S/16.3M a S/41.9M.
   Avance físico: **53%**.
2. **Al entrar en junio no había**: Plan de Calidad, Procedimientos Constructivos, Dosier de Calidad
   documentado, ni registro de No Conformidades.
3. **Defectos físicos reales en estructuras ejecutadas**: fisuras en muros y segregaciones/cangrejeras en
   varios muros de concreto. No es solo un tema de orden documentario.
4. **La certificación de calidad es requisito formal para tramitar el pago** de cada partida (sub base, base
   granular, etc.). Un vacío en el dosier es un riesgo directo sobre el pago.
5. **El trabajo diario real corre por WhatsApp y Excel.** Fieldwire está instalado pero casi no se usa.
6. **Procedimientos oficiales (Encofrado, Puente) con carátula de esta obra pero contenido de otro proyecto**
   (minero anterior: "Nueva Fuerabamba", "GyM S.A."). Plantillas copiadas sin adaptar.
7. **El archivo de protocolos liberados tiene inconsistencias**: filas marcadas "Cumplido" con No
   Conformidades registradas, y porcentajes de avance por encima de 100%.
8. **Al menos tres registros manuales en paralelo sin cruzar**: cuaderno de cemento por elemento, notas de
   alturas de muro y Excel de ingreso de concreto de Concreto Titan.

**Diagnóstico:** el problema no es falta de esfuerzo del equipo. La información vive repartida en WhatsApp,
Excel y papel, sin un sistema que la ordene, la valide y la deje lista para sustentar cada pago. Eso genera
los vacíos, las inconsistencias y, en algunos casos, los defectos que ya se ven en obra.

---

## 3. La propuesta: PROTOKOL

Un sistema donde el técnico llena el protocolo desde el celular, **con o sin internet** en la zona.

- Valida automáticamente contra los criterios de la obra
- Genera la No Conformidad si algo no cumple
- Entrega el **PDF firmable al toque** — nada de reescribir en Excel después

---

## 4. Preguntas para conversar en persona (no asumir el dominio)

1. **Flujo real de un vaciado**: preparación → inspección → vaciado → toma de cilindros → envío a AKHISE →
   resultado → aprobación final. El paso a paso tal cual pasa en campo, no el ideal.
2. **Frecuencia de trabajo sin señal**: si varios técnicos llenan protocolos offline el mismo día y se
   conectan después, ¿cómo se resuelve el orden?
3. **Asignación de trabajo hoy**: sin ningún sistema, ¿cómo sabe cada técnico en qué paño o actividad está
   trabajando? Eso define cómo el sistema lo va a preguntar.
4. **Definición de éxito**: ¿qué tendría que pasar para decir que esta primera versión ya sirve de verdad en
   la obra?

---

## 5. Lo que se necesita que comparta David

Para armar la primera versión funcional en 2–3 semanas:

| # | Entregable | Prioridad |
|---|---|---|
| 1 | **Criterios técnicos exactos de esta obra**: slump, f'c por partida, tolerancia de compactación y de topografía | Esta semana |
| 2 | **Un protocolo real ya aprobado y firmado, en PDF** — la plantilla exacta que el sistema debe generar | Esta semana |
| 3 | **Un dosier de calidad completo** de una obra o fase ya cerrada — el resultado final que el sistema debe producir | Esta semana |
| 4 | **Formato de carga a INFOBRAS** — si el sistema alimenta esto automático, es un diferencial fuerte | Cuando lo tenga a mano |
| 5 | **Lista de obras activas del Gobierno Regional de Ayacucho** — para ver hasta dónde puede escalar | Cuando lo tenga a mano |

---

## 6. Costo y tiempo

- **Desarrollo de la primera versión: USD 2,500.** Infraestructura y servicios aparte.
- **Plazo: 2 a 3 semanas** para la primera versión usable en obra (con los datos y respuestas de la reunión).

**Pedido final a David:** feedback directo sobre si los hallazgos calzan con lo que ve en el día a día, y si
hace sentido avanzar en esos términos.

---

## 7. Estado de acuerdos (seguimiento posterior)

| Punto | Estado |
|---|---|
| Reunión presencial con Especialista de Calidad | ✅ Realizada 12-Sep-2026 — estructura de equipos, cadena de liberación por elemento, comportamiento de firma offline, y pedido explícito de pilotar **los 4 protocolos** (topografía, encofrado, acero, concreto) en vez de 3 |
| Protocolos firmados reales obtenidos (6) | ✅ 16-Sep-2026 — topografía, encofrado ×2, acero ×2, concreto |
| Criterios técnicos reales confirmados | ✅ slump 8.9–12.7 cm (banda de referencia); 4 cilindros por mixer; f'c 280 kg/cm² pavimento, 210 kg/cm² muros/alcantarillas |
| Rediseño de formulario post-MVP (~20-Sep) | ✅ checklist completo del formato de papel; **slump como selector discreto (3.5" / 4" / 4.5" / 5")**; firmas por recuadro con cuenta/PIN; progresiva/GPS silenciosos; renombre a "Información General del Proyecto" |
| Formato INFOBRAS | ⏳ Pendiente — diseño listo para exportar, integración diferida a Fase 1+ |
| Lista de obras activas GORE Ayacucho | ⏳ Pendiente |
| Financiamiento Fase 0 por hitos | ⏳ Porcentajes y fechas en negociación |
| Términos de sociedad comercial con David | ⏳ Pendientes de definir por separado |
