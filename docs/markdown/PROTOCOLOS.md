# PROTOKOL — Protocolos de Calidad (Dominio del Sistema)

**Alcance:** Definición de los protocolos de calidad que el sistema PROTOKOL modela, valida y emite para
obra pública vial en Perú (Administración Directa).
**Fuentes:** `docs/originales/PROTOKOL_TECHNICAL_DOC_v2_4.pdf` (secciones 2.1, 2.4, 9.3), `PROTOKOL_David.docx`,
`PROTOKOL_Diagnostico_Competencia.docx`
**Normas de referencia:** EG-2013 (MTC), Directiva N° 017-2023-CG/GMPL (INFOBRAS), Código Civil art. 1784

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

## 3. Los 4 protocolos de Fase 0

Confirmado con el Especialista de Calidad (12-Sep-2026): pilotar **los cuatro** protocolos, no tres.
El encofrado se verifica como **checklist pre-vaciado dentro del protocolo de concreto** (no como actividad
separada en la PWA).

| Protocolo | Actividad en API | Qué captura |
|---|---|---|
| **Topografía** | `SURVEY` | Cotas/elevaciones por paño vs. diseño (desviación ≤1 cm) |
| **Encofrado** | (dentro de `CONCRETE`) | Dimensiones, alineamiento y cota del molde antes del vaciado |
| **Acero** | `STEEL` | Diámetro, espaciamiento y recubrimiento del refuerzo por plano estructural |
| **Concreto** | `CONCRETE` | Slump por mixer, f'c de diseño, probetas por mixer, guía de despacho |

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
| Concreto | `slump` | **Selector discreto: 3.5" / 4" / 4.5" / 5"** (banda de referencia 8.9–12.7 cm). Se elige un valor por mixer, no se escribe un número en rango | Especialista de Calidad, 16-Sep + 20-Sep-2026 |
| Concreto | `design_fc` | 140 / 175 / 210 / 245 / 280 kg/cm² según partida | Expediente técnico |
| Concreto | `cylinders_cast` | 4 probetas por mixer (carmix) | Especialista de Calidad, 16-Sep-2026 |
| Probetas | `strength_kgcm2` | ≥ f'c de diseño a 28 días | EG-2013 |
| Compactación | `compaction_pct` | ≥ 100% del Proctor Modificado | Plan de calidad |
| Compactación | `moisture_deviation` | ±1.5% del óptimo | Plan de calidad |
| Compactación | `sub_base_thickness` / `base_thickness` | ≥ 20 cm / ≥ 25 cm | Expediente técnico |
| Topografía | `elevation_deviation` | ≤ 1 cm del diseño | Plan de calidad |
| Acero | `bar_spacing_cm` / `concrete_cover_cm` | Según plano estructural / recubrimiento mínimo por elemento | Plano estructural / EG-2013 |

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
