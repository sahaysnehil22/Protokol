# PROTOKOL — Protocolos de Calidad (Dominio del Sistema)

**Alcance:** Definición de los protocolos de calidad que el sistema PROTOKOL modela, valida y emite para
obra pública vial en Perú (Administración Directa).
**Fuentes:** `docs/originales/PROTOKOL_TECHNICAL_DOC_v2_4.pdf` (secciones 2.1, 2.4, 9.3), `PROTOKOL_David.docx`,
`PROTOKOL_Diagnostico_Competencia.docx`, y los formatos en papel del Ing. David extraídos en Sep-2026
(`docs/originales/protocolos_david/`):
- `02. PAVIMENTO_ENCOFRADO_MI.xlsx` (Encofrado, Cód. GDC-PDE-2026 + variante FO01PT02)
- `03. PAVIMENTO_ACERO_MI.xlsx` (Acero, Cód. FO01PT03)
- `04. PAVIMENTO_CONCRETO_MI.xlsx` (Concreto, Cód. GDC-PCC-2026 + variante GRA/PR-001)
- `PRO-TOPOGRAFIA-2026 - copia.xlsx` (Topografía, Cód. GCO-PVT-2026)
- `GR-PROBETA-2026 - copia.xlsx` y `chat_gcalidad/GR-PROBETA JULIO-2026-PLANTILLA.xlsx` (Probetas, Cód. SGC-CRP-2026)
- `PROTOCOLO CA YEE.xlsx` (Liberación de estructuras: encofrado GDC-PLE-2026, acero GDC-PLA-2026, vaciado GDC-PLV-2026)
- `chat_gcalidad/INGRESO DE CONCRETO PREMEZCLADO TITAN.xlsx`, `Cronograma_Progresivas.xlsx`, `LLENADO POR DIAS.xlsx` (apoyo)

**Normas de referencia:** EG-2013 (MTC), Directiva N° 017-2023-CG/GMPL (INFOBRAS), Código Civil art. 1784,
NTE E.060 Concreto Armado, NTE G.050 Seguridad en Construcción, ASTM A615-Grado 60, NTP 341.031 G60

---

## 1. Conceptos base

- **Protocolo (PPI — Programa de Puntos de Inspección):** registro formal que prueba que una actividad
  cumplió la norma. Define quién inspecciona, qué norma aplica, y si es un **hold point** (requiere
  visto bueno externo para continuar) o un **witness point** (verificación interna).
- **Liberación:** firma/visto bueno que permite pasar a la siguiente etapa de obra.
- **No Conformidad (NC):** registro formal de que algo falló un criterio. Exige acción correctiva documentada.
- **Dosier de Calidad:** paquete documental completo compilado. Requisito para cerrar el contrato.
- **Valorización:** certificado de pago mensual basado en avance medido — se bloquea sin respaldo de calidad.
- **Expediente Técnico:** documento maestro del proyecto (planos, especificaciones, metrados, presupuesto).
- **INFOBRAS:** sistema obligatorio de la Contraloría para registro de ejecución de obras.

---

## 2. La cadena de liberación física (lo que el sistema modela)

Cada capa debe aprobarse antes de que la siguiente se apoye encima. **El sistema es una máquina de estados
sobre paños, no un CRUD de formularios.**

| # | Etapa | Qué se ejecuta físicamente | Qué se verifica en el protocolo |
|---|---|---|---|
| 1 | **Subrasante** | Suelo natural cortado, nivelado y compactado (fundación) | Densidad de compactación, contenido de humedad, cota |
| 2 | **Sub base** | Capa granular de 20 cm extendida y compactada | Compactación ≥100% de referencia de laboratorio, espesor, certificado de material |
| 3 | **Base granular** | Segunda capa granular de 25 cm, mayor calidad | Igual que sub base + ensayo de capacidad portante |
| 4 | **Encofrado** | Moldes de madera/metal para contener el concreto | Dimensiones, alineamiento, cota |
| 5 | **Acero** | Barras de refuerzo colocadas dentro del encofrado | Diámetro de barra, espaciamiento, recubrimiento de concreto |
| 6 | **Vaciado** | Concreto premix llega en mixer y se vierte | Slump a la llegada, probetas tomadas, ID de mixer registrado |
| 7 | **Curado** | Concreto mantenido húmedo por días para ganar resistencia | Método y duración del curado |
| 8 | **Rotura de probetas** | Probetas rotas en laboratorio a 7 y 28 días | Resistencia a compresión debe cumplir el valor de diseño |

---

## 3. Los 5 protocolos de Fase 0

Confirmado con el Especialista de Calidad (12-Sep-2026) y refinado con la revisión del MVP (~20-Sep-2026):
pilotar **cinco** actividades, cada una con su protocolo completo en el orden de obra
(Compaction → Survey → Steel → Formwork → Concrete). **El encofrado es un protocolo propio con su propio
checklist en papel** (feedback F1 de David) — no va embebido en el de concreto. Ojo: el protocolo de
concreto **sí conserva su bloque de inspección previa al vaciado** (que incluye verificar posición de
encofrado y acero), pero esa es una sección interna del formato de concreto, no un reemplazo del
protocolo de encofrado.

| Protocolo | Actividad en API | Qué captura | Código en papel |
|---|---|---|---|
| **Compactación** | `COMPACTION` | Densidad ≥100% Proctor Modificado, humedad ±1.5%, espesores 20/25 cm | (según plan de calidad) |
| **Topografía** | `SURVEY` | Cotas/elevaciones vs. diseño (≤1 cm), equipos, calibración, coordenadas (X/Y/Z) | GCO-PVT-2026 |
| **Acero** | `STEEL` | Diámetro, espaciamiento, recubrimiento, traslapes, ganchos, amarre | FO01PT03 / GDC-PLA-2026 |
| **Encofrado** | `FORMWORK` | Dimensiones, alineamiento, verticalidad, desmoldante, puntales | GDC-PDE-2026 / GDC-PLE-2026 |
| **Concreto** | `CONCRETE` | Inspección previa, tipo/colocación/acabado, guía + slump + vol. por mixer, probetas, curado | GDC-PCC-2026 / GDC-PLV-2026 |

Los checklists íntegros (ítem por ítem, tal como están en los Excel de David) están en el **Anexo A**.

---

## 4. Flujo real de un vaciado (para validar en campo)

```
Preparación → Inspección → Vaciado → Toma de cilindros → Envío a AKHISE → Resultado → Aprobación final
```

Notas de dominio:
- Un solo vaciado puede involucrar **20+ cargas de mixer**, cada una con su guía de despacho, su lectura de
  slump y su set de 4 probetas → el registro de concreto guarda una **lista de entradas por mixer**.
  El slump se elige de un **selector discreto (3.5" / 4" / 4.5" / 5")**, no se digita un rango.
- **Veredicto en dos etapas:** el vaciado queda `PROVISIONAL_PASS` hasta la rotura de probetas a 28 días;
  recién ahí pasa a `PASS` (o `FAIL` + NC si la resistencia está por debajo del f'c de diseño).
- **Firmas:** cada protocolo liberado lleva la firma del Especialista de Calidad (lado ejecución) y, según el
  elemento, del Supervisor y/o Especialista de Estructuras (lado supervisión). El modelo debe soportar también
  protocolos atados a alcance de **subcontratista** con su propio Especialista de Calidad.

---

## 5. Criterios de validación por protocolo (cargados como datos)

| Protocolo | Campo | Criterio de aprobación | Fuente |
|---|---|---|---|
| Concreto | `slump` | **Selector discreto: 3.5" / 4" / 4.5" / 5"** (banda de referencia 8.9–12.7 cm). Se elige un valor por mixer, no se escribe un número en rango. El papel lo registra **por guía de despacho** junto con su `V°B°` (visto bueno) y volumen m³ (ej. 5 1/2") | Especialista de Calidad, 16-Sep + 20-Sep-2026 / Excel GDC-PCC-2026 §3 |
| Concreto | `design_fc` | 140 / 175 / 210 / 245 / 280 kg/cm² según partida. **Confirmado en papel (GDC-PCC-2026): pavimento f'c=280 kg/cm²**; variante GRA/PR-001 (veredas): 210/175 kg/cm² | Expediente técnico / Excel GDC-PCC-2026 |
| Concreto | `cylinders_cast` | 4 probetas por mixer (carmix). El formato de papel además registra **"Testigos Cilíndricos" por vaciado** (ej. 6 en la hoja PR12) y "Testigos Viga" (ej. 0) — ambos campos existen y deben modelarse | Especialista de Calidad, 16-Sep-2026 / Excel GRA/PR-001 |
| Compactación | `compaction_pct` | ≥ 100% del Proctor Modificado | Plan de calidad |
| Compactación | `moisture_deviation` | ±1.5% del óptimo | Plan de calidad |
| Compactación | `sub_base_thickness` / `base_thickness` | ≥ 20 cm / ≥ 25 cm | Expediente técnico |
| Concreto | `vol_teorico_m3` / `vol_real_m3` | Volumen teórico = Σ paños (N° veces × Long × Base × Altura); volumen real = Σ guías despachadas. Ambos campos del formato (control de cubicación) | Excel GRA/PR-001 §3 |
| Concreto | condiciones de vaciado | Clima (despejado/soleado/nublado), turno (día/noche), hora de inicio y término del vaciado | Excel GDC-PLV-2026 |
| Probetas | `strength_kgcm2` | ≥ f'c de diseño a 28 días; el registro lleva `F'C a "x" días` + `RESISTENCIA AL F'C (%)` | EG-2013 / SGC-CRP-2026 |
| Acero | `bar_spacing_cm` / `concrete_cover_cm` | Según plano estructural / recubrimiento mínimo por elemento. El papel además verifica: limpieza, calidad (ASTM A615 G60, grado, marca), diámetro liso/corrugado, **longitud de traslape, gancho, radio de doblez**, alambre de amarre, soportes de recubrimiento (base/lateral), verticalidad (plomada), horizontalidad | Plano estructural / ASTM A615-G60 / NTP 341.031 / NTE E.060 |
| Topografía | `elevation_deviation` | ≤ 1 cm del diseño. El papel exige además: equipos (marca/modelo/serie) **calibrados con certificado vigente**, punto de referencia (BM/PA/PC) y coordenadas (Este X, Norte Y, Cota Z) por punto | Plan de calidad / Excel GCO-PVT-2026 |

---

## 6. No Conformidades (NC)

- Se abren **automáticamente** cuando un valor enviado falla el criterio.
- Exigen **acción correctiva documentada** y cierre formal (`closed_at`).
- Hallazgo del piloto: el tracker actual tiene 17 filas con NC registradas marcadas "Cumplido" → el criterio
  de cierre del sistema debe **impedir liberar con NC abiertas**, salvo registro explícito y trazable.

---

## 7. Dosier de calidad y cierre

- El dosier compila: protocolos, fotos, resultados de laboratorio y NCs de todo el proyecto.
- Es requisito para **cerrar el contrato** y para sustentar cada **valorización mensual**.
- El sistema genera el PDF por protocolo y el paquete compilado del dosier; la estructura de exportación se
  diseña desde el inicio para ser **compatible con INFOBRAS** (Directiva N° 017-2023-CG/GMPL).

---

## 8. Glosario de campo (términos del dominio)

| Término | Significado |
|---|---|
| Progresiva | Distancia a lo largo del eje de la vía, en km+metros. `0+144` = 144 m desde el inicio |
| Paño | Panel rectangular de pavimento vaciado en una jornada — unidad diaria de trabajo |
| Vaciado | Vertido de concreto |
| Encofrado | Molde temporal que contiene el concreto fresco |
| Slump | Ensayo de consistencia del concreto (cono de Abrams), en cm |
| f'c | Resistencia de diseño a compresión del concreto, en kg/cm² |
| Probeta / Testigo | Cilindro de concreto vaciado durante la obra, roto a 7 y 28 días |
| Mixer | Camión de concreto premix |
| Curado | Mantener húmedo el concreto para que desarrolle resistencia |
| Subrasante | Suelo natural preparado (capa fundación) |
| Sub base / Base granular | Capas granulares de 20 cm / 25 cm |
| Proctor Modificado | Ensayo de laboratorio que establece la densidad máxima del suelo; la compactación de campo se expresa como % de este |
| Cota | Nivel de elevación verificado con equipo topográfico |
| Liberación | Visto bueno que permite pasar a la siguiente etapa |
| Residente de Obra | Ingeniero residente — dirige la ejecución |
| Supervisor / Inspector | Ingeniero supervisor independiente designado por la entidad estatal |
| Administración Directa | La entidad estatal ejecuta con personal propio (sin contratista privado) |
| EG-2013 | Manual de especificaciones técnicas de carreteras del MTC — norma vinculante |
| Solado | Capa delgada de concreto pobre sobre la que se apoya el refuerzo/estructura; debe estar limpia antes del vaciado |
| Dado de concreto | Tacos de concreto que separan la armadura de la base y los laterales (garantizan el recubrimiento) |
| Ochavo | Bisel de esquina del encofrado según especificación |
| Desmoldante | Aditivo aplicado a las paredes del encofrado para que no se adhiera el concreto |
| Alambre de amarre | Alambre con que se aseguran las intersecciones de las varillas |
| Traslape / Gancho / Radio de doblez | Longitudes de empalme, de anclaje en extremos y radio de curvatura de la varilla (cm) — se verifican en el protocolo de acero |
| Plomada | Instrumento/control de verticalidad |
| Guía de despacho (O/ENT) | Documento del proveedor por cada mixer despachado (número de orden de entrega) — base legal de la cubicación |
| V°B° | Visto bueno por fila de guía en el control de calidad del vaciado |
| Testigo cilíndrico / Testigo viga | Probeta de concreto de forma cilíndrica / prismática (viga para flexión) |
| Caravista | Acabado de concreto que queda a la vista (sin tarrajeo) |
| BM / PA / PC | Punto de referencia topográfico: Bench Mark / Puntos Auxiliares / Punto de Control |
| Margen | Lado de la vía (izquierdo/derecho) al que pertenece el elemento verificado |
| AST | Análisis de Seguridad en el Trabajo — permiso de seguridad previo a la actividad |

---

## Anexo A — Checklists íntegros de los formatos en papel (extraídos de los Excel del Ing. David, Sep-2026)

Fuente de los archivos: `docs/originales/protocolos_david/`. La aplicación debe renderizar **estos ítems
exactos, en este orden**, con las columnas de respuesta de cada formato. Cada hoja Excel es un protocolo
emitido; el correlativo en varias plantillas se auto-genera desde el nombre de la hoja/archivo
(`=RIGHT(CELL("nombrearchivo",…),2)`) — el equivalente digital es un correlativo secuencial por proyecto.

### A.1 Encofrado — `02. PAVIMENTO_ENCOFRADO_MI.xlsx` (Cód. GDC-PDE-2026, Rev. 001, 13/06/2026)

**Encabezado (campos fijos por instancia):** Obra · Ejecuta · Ubicación · Elemento · PARTIDA ·
Fecha liberación · PLANO DE REFERENCIA · Correlativo N°.

**Columnas de respuesta:** CUMPLE | NO CUMPLE | NO APLICA | Observación.

| # | Sección | Ítem |
|---|---|---|
| 1.01 | 1. DESCRIPCION DE ACTIVIDAD | ¿Tipo de encofrado es adecuado para el tipo de estructura a concretar? |
| 1.02 | | ¿Los accesorios empleados son los adecuados? |
| 1.03 | | ¿Ubicación correcta de los elementos embebidos? |
| 1.04 | | ¿Los puntales son los adecuados? |
| 2.01 | 2. VERIFICACIÓN DE LOS MATERIALES | Dimensiones del encofrado según los planos y las EETT. |
| 2.02 | | Distancias entre ejes y longitudes de encofrado. |
| 2.04 | | Verificación del alineamiento del encofrado. |
| 2.05 | | Verificación de la verticalidad o inclinación en los diferentes encofrados |

**Firmas:** RESIDENTE DE OBRA | ESPECIALISTA DE CALIDAD | ESTRUCTURISTA-SUPERVISOR | SUPERVISOR DE OBRA.

**Variante FO01PT02 (hojas PR12–PR19, obra Ciudad Libertad) — checklist ampliado:**
1.01 ¿El acero de refuerzo está verificado y conforme? · 1.02 tipo de encofrado · 1.03 accesorios ·
1.04 elementos embebidos · 1.05 puntales · 1.06 ¿Los paneles de encofrado se encuentran limpios? —
2.01 ¿Listones de madera según los requerimientos? · 2.02 ¿Tirante y tuerca mariposa de encofrado? ·
2.03 ¿Aditivo desmoldante con especificaciones del fabricante? · 2.04 ¿Dados de concreto de las
dimensiones especificadas en los planos? — 3.01 Dimensiones según planos y EETT · 3.02 Distancias entre
ejes · 3.03 Paredes internas con capa de aditivo desmoldante · 3.04 Alineamiento · 3.05 Verticalidad ·
3.06 Ochavos colocados según especificación · 3.07 Dados de concreto colocados según especificación.
**Firmas variante:** PRODUCCIÓN | CALIDAD | RESIDENTE DE OBRA | INSPECTOR DE OBRA.

### A.2 Acero — `03. PAVIMENTO_ACERO_MI.xlsx` (Cód. FO01PT03, Rev. 001, 13/06/2026)

**Encabezado:** igual que encofrado (Obra · Ejecuta · Ubicación · Elemento · PARTIDA · Fecha liberación ·
PLANO DE REFERENCIA · Correlativo N°).
**Columnas de respuesta:** CUMPLE | NO CUMPLE | NO APLICA | Observación.

| # | Sección | Ítem |
|---|---|---|
| 1.01 | 1. MATERIAL | Calidad del acero / Fluencia corresponde con las EETT del proyecto |
| 1.02 | | ¿El acero instalado presenta certificado de calidad? |
| 2.01 | 2. GENERAL | ¿Las armaduras de acero son del diámetro indicado en los planos ó EETT? |
| 2.02 | | ¿Las intersecciones están aseguradas con alambre de amarre? |
| 2.03 | | ¿Se colocaron dados de concreto en la base de la armadura? |
| 2.04 | | ¿Se colocaron dados de concreto en los laterales de la armadura? |
| 2.05 | | ¿La armadura está ubicada vertical y horizontalmente según EETT y planos? |
| 2.06 | | ¿Las cotas del acero colocado están de acuerdo a los planos? |
| 2.07 | | ¿Las distancias entre las varillas son las que se indican en los planos de referencia? |
| 3.01 | 3. OTROS | ¿Las armaduras están libres de óxidos y sustancias extrañas en su superficie? |
| 3.02 | | ¿Todas las condiciones están dadas para dar conformidad a la armadura de acero? |

**Nota:** la plantilla trae columnas anexas "VACIADOS REAL / VACIADOS PARA PROTOCOLOS" (fecha | Pedido |
m³ | ETAPA) — cronograma de vaciados embebido en el formato. En el sistema esto se prellena desde
`Cronograma_Progresivas.xlsx` (Carril, Progresiva Inicial/Final, Día Programado, Color, Cubos m³).
**Firmas:** RESIDENTE DE OBRA | ESPECIALISTA DE CALIDAD | ESTRUCTURISTA-SUPERVISOR | SUPERVISOR DE OBRA.

### A.3 Concreto — `04. PAVIMENTO_CONCRETO_MI.xlsx` (Cód. GDC-PCC-2026, Rev. 001, 13/06/2026)

**Encabezado:** OBRA · EJECUTA · SUPERVISA · ELEMENTO Y UBICACIÓN · PLANO DE REFERENCIA ·
Fecha de liberación · PARTIDA · Correlativo N°.

**1.- INSPECCIÓN PREVIA AL VACIADO** (columnas Si | No | N/A):

| # | Ítem |
|---|---|
| 1.1 | ¿Se cuenta con diseño de mezcla aprobado por la Supervisión? |
| 1.2 | ¿La superficie del solado está limpia, libre de tierra, raíces y arena? |
| 1.3 | ¿El acero de refuerzo se encuentra limpio, libre de lubricantes y óxidos? |
| 1.4 | ¿La posición del acero de refuerzo y el encofrado ha sido verificado por el topógrafo? |
| 1.5 | ¿El espesor de recubrimiento de concreto cumple con lo indicado según ET? |
| 1.6 | ¿Se encuentra con una referencia para determinar el nivel de llenado de concreto? |
| 1.7 | ¿Se ha verificado la conformidad de las juntas? |
| 1.8 | ¿Se ha verificado la conformidad de los recubrimientos mínimos? |
| — | **¿Las condiciones están dadas para iniciar el concretado?** → Si / No |

Variante GRA/PR-001 (edificaciones, hojas PR12+): 1.8 instalaciones sanitarias · 1.9 instalaciones
eléctricas · 1.10 instalaciones mecánicas · 1.11 anclajes estructurales · 1.12 recubrimientos mínimos.

**2.- TIPO DE CONCRETO Y COLOCACIÓN** (marcar con aspa):

- **F´c diseño:** 280 KG/CM² (pavimento) / 210–175 KG/CM² (veredas) — valor por partida
- **SLUMP:** valor por vaciado (ej. 5 1/2")
- **Testigos Cilíndricos / Testigos Viga:** conteo por vaciado (ej. 6 / 0)
- **PROCEDENCIA:** Hecho en obra | Premezclado
- **COLOCACIÓN:** Directo | Grúa y balde
- **ACABADO:** Caravista | Otro

**3.- CONTROL DE CALIDAD:**

- Tabla por mixer: **N° de Guía | Slump | Vol. (m³) | V°B°** (dos bloques, uno por frente) + fila
  "Número de testigos elaborados".
- Tabla de cubicación: **Elemento | N° de veces | Long | Base | Altura | Parcial | Total**
  (PAÑO TIPO 1, PAÑO TIPO 2…) → **Cantidad de concreto teórico (M³)** y **Cantidad de concreto real (M³)**.

**4.- VERIFICACIÓN POSTERIOR AL VACIADO** (Si | No | N/A + Observaciones):

| # | Ítem |
|---|---|
| 1 | Acabado superficial de acuerdo a lo especificado |
| 2 | Nivel de aplomado del elemento de acuerdo a lo especificado |
| 3 | Correcta posición final de los elementos embebidos |
| 4 | Curado de la estructura concretada adecuado |

**COMENTARIOS / OBSERVACIONES** + **Firmas:** RESIDENTE DE OBRA | ESPECIALISTA DE CALIDAD |
ESTRUCTURISTA-SUPERVISOR | SUPERVISOR DE OBRA (variante GRA/PR-001: PRODUCCIÓN | CALIDAD | RESIDENTE
DE OBRA | INSPECTOR).

### A.4 Topografía — `PRO-TOPOGRAFIA-2026 - copia.xlsx` (Cód. GCO-PVT-2026, Rev. 01, 08/06/2026)

**Encabezado:** OBRA · PLANO DE REF. · UBICACIÓN/PROGRESIVA · TRAMO · ELEMENTO · FECHA ·
N° CORRELATIVO · DESCRIPCIÓN DE TRABAJO.
**Columnas de respuesta:** NA | INSPECCIÓN (C / NC) | OBSERVACIONES | V.B (leyenda: C=Conforme,
NC=No Conforme, NA=No Aplica).

| # | Sección | Ítem |
|---|---|---|
| 1.1 | 1. VERIFICACION PRELIMINAR | Área limpia y sin obstáculos |
| 1.2 | | Área de trabajo señalizada |
| 1.3 | | Equipos y herramientas operativas |
| 1.4 | | Se cuenta con todos los permisos de seguridad (AST, etc.) |
| 2.1 | 2. VERIFICACIÓN DURANTE LA ACTIVIDAD | Ubicación de puntos auxiliares |
| 2.2 | | Replanteo de linderos del terreno |
| 2.3 | | Levantamiento topográfico |
| 2.4 | | Trazo y replanteo de ejes |
| 2.5 | | Distancia y proporcionalidad entre ejes |
| 2.6 | | Colocación de niveles |
| 2.7 | | Verticalidad y alineamiento |
| 3.1 | 3. VERIFICACIONES POSTERIORES | Recojo de equipos y herramientas |
| 3.2 | | Limpieza del área de trabajo |

**Datos de campo:** EQUIPO 1 / EQUIPO 2 (MARCA, MODELO, SERIE) · CALIBRACIÓN (Sí/No) ·
N° DE CERTIFICADO · ARCHIVO (adjuntar archivo del levantamiento topográfico).
**Coordenadas:** tabla PUNTO REF. | NOMBRE | (ESTE) X | (NORTE) Y | (COTA) Z.
**Punto de referencia:** BM (Bench Mark) | PA (Puntos Auxiliares) | PC (Punto de Control).
**Plano/sketch:** indicar Sí/No si se adjunta.
**Firmas:** RESIDENTE DE OBRA | ESPECIALISTA DE CALIDAD EJECUCIÓN | SUPERVISOR DE OBRA |
ESTRUCTURAS - SUPERVISIÓN, más ESPECIALISTA DE CALIDAD SUPERVISIÓN.

### A.5 Probetas — `GR-PROBETA-2026 - copia.xlsx` y `GR-PROBETA JULIO-2026-PLANTILLA.xlsx` (Cód. SGC-CRP-2026)

**Plantilla (registro de roturas):** CÓDIGO DE PROBETA | UBICACIÓN | ESTRUCTURA/ELEMENTO | F'C (kg/cm²) |
FECHA DE MUESTREO | EDAD | FECHA DE ROTURA | F'C a "x" días (kg/cm²) | RESISTENCIA AL F'C (%) | DESCRIPCIÓN.

- **EDAD** se calcula: fecha de rotura − fecha de muestreo.
- **Nomenclatura real de códigos de probeta** (del registro 2026, todas f'c=210): `M-13-1` (muro C.A.
  13-1), `Z-M13-01` (zapata), `M-ALETA-AL3`, `M-C.ENT-AL3`, `Z-CAJA ENT3` (alcantarilla 3+315),
  `Z-AL2-C.ENT` (alcantarilla 2, 1+080), `M-ALC-2` (3+080) → prefijo `M-`=muro, `Z-`=zapata + elemento.
- **Firmas:** Ing. RESIDENTE | ESPECIALISTA CALIDAD | ESTRUCTURISTA-SUPERVISOR | SUPERVISOR DE OBRA
  (+ RESPONSABLE DE CAMPO en la versión JULIO).

### A.6 Liberación de estructuras — `PROTOCOLO CA YEE.xlsx` (formato CA Yee, Rev. 01)

Encabezado común: ESTRUCTURA · ELEMENTO ESTRUCTURAL · UBICACIÓN · PROGRESIVAS · MARGEN ·
NORMA DE REFERENCIA · DOCUMENTO DE REFERENCIA (N° de plano, referenciales, cambios de ingeniería).

**4.ENC-C.ENTRAD — Liberación de Encofrado (Cód. GDC-PLE-2026)** · Normas: NTE G.050 + NTE E.060.

- *Revisión de alineamiento* (CONFORME Sí/No + OBSERVACIONES): 1 Eje transversal · 2 Eje longitudinal.
- *3.00 Verificación del encofrado — Puntos de control* (NO/SÍ + COMENTARIOS): Material de encofrado
  (madera o metal) · Condición del encofrado · Limpieza de formas · Forma y dimensiones ·
  Apuntamiento y fijación · Aplicación del desmoldante · Alineamiento · Verticalidad ·
  **Nivel de vaciado ref. +/- 0.00**.

**5.ACE-C.ENTRAD3 — Liberación de Armado de Aceros (Cód. GDC-PLA-2026)** · Normas: ASTM A615-Grado 60,
NTP 341.031 G60, NTE E.060. Columnas: SI | NO | NA | OBSERVACIONES.

| # | Punto de control |
|---|---|
| 1.01 | Limpieza (corrosión, concreto, grasa) |
| 1.02 | Calidad de acero (Norma ASTM, grado, marca) |
| 1.03 | Diámetro de varilla (pulg), indicar si es liso/corrugado |
| 1.04 | Longitud de traslape (cm) |
| 1.05 | Longitud de gancho (cm) |
| 1.06 | Radio de doblez (cm) |
| 1.07 | Espaciamiento en barras (cm) |
| 1.08 | Alambre de amarre |
| 1.09 | Soportes para recubrimiento contra base (cm) |
| 1.10 | Soportes para recubrimiento lateral (cm) |
| 1.11 | Verticalidad (plomada) |
| 1.12 | Horizontalidad (alineamiento) |
| 2.00 | Comentarios / Observaciones / Croquis |

**6.VAC-C.ENTRAD3 — Liberación de Vaciado de Concreto (Cód. GDC-PLV-2026)** · columnas SI | NO | OBSERVACIÓN:

| # | Información técnica |
|---|---|
| 1 | Vaciado de concreto para: SOLADO / CONCRETO SIMPLE / CONCRETO ARMADO |
| 2 | La resistencia del concreto cumple las EETT del proyecto (f'c=210 kg/cm²) |
| 3 | Diámetro máximo de agregados |
| 4 | Acero y encofrado correctamente instalados |
| 5 | Espaciamiento entre barras (cm) |
| 6 | Asentamiento de acuerdo a EETT del proyecto — SLUMP |
| 7 | Aditivos requeridos |

Más: **HORARIO Y CONDICIONES CLIMÁTICAS** (clima: despejado/soleado/nublado · turno: día/noche ·
inicio y término del vaciado) y **DETALLES**.
**Firmas:** RESIDENTE DE OBRA | SUPERVISOR DE OBRA · ESPECIALISTA DE CALIDAD EJECUCIÓN |
ESTRUCTURAS - SUPERVISIÓN · ESPECIALISTA DE CALIDAD SUPERVISIÓN.

### A.7 Apoyo — registros auxiliares que el sistema debe absorber

- **`INGRESO DE CONCRETO PREMEZCLADO TITAN.xlsx`:** ITEM | FECHA | MATERIAL | CANT (m³) | N° O/ENT
  (guía) | PLACA — reconciliación con el proveedor (base de `mixer_loads`).
- **`Cronograma_Progresivas.xlsx` / `LLENADO POR DIAS.xlsx`:** Carril | Progresiva Inicial |
  Progresiva Final | Día Programado | Color (+ Cubos m³) — cronograma de vaciados por paño; fuente del
  prellenado silencioso de progresivas (F3).
