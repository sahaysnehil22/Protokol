# CRASH — Especificación Técnica Fase 0 (Piloto)

**Documento original:** `docs/originales/crash/CRASH_TECH_SPEC_v1.pdf` (v1.0, Septiembre 2026)
**De:** Kenny Garamendi — CEO / Producto
**Para:** Snehil Sahay — CTO / Implementación
**Contexto:** Piloto en obra pública activa, Ayacucho Perú (S/ 41.9M, 2.38 km vía vial)
**Objetivo Fase 0:** Validar adopción del campo. Los técnicos de obra llenan protocolos a través de Crash
sin cambiar de hábitos.
**Stack:** Libertad total — elegir lo que permita mover más rápido (recomendaciones en Sección 9).

> **Relación con PROTOKOL:** CRASH es el nombre de producto del piloto Fase 0; PROTOKOL
> (`TECH_SPEC.md`, doc técnico v2.4) es el proyecto/dossier completo. Este documento es la versión
> ejecutiva operativa para el build. Ojo con las diferencias de criterios (ver Sección 7).

---

## 1. Contexto — por qué existe CRASH

Descubrimiento en 6 semanas de investigación de campo en una obra pública activa en Ayacucho:

- La obra tiene S/ 41.9M de presupuesto, 2.38 km de vía, y lleva 4 años en ejecución con 10 ampliaciones de plazo
- Cuando el Especialista de Calidad (David, socio de dominio) se incorporó en junio 2026, encontró: cero Plan
  de Calidad, cero Dosier, cero No Conformidades registradas
- El equipo coordina TODO por WhatsApp — incluyendo datos de ensayos, fotos de pruebas, cronogramas de vaciado
- Fieldwire estaba instalado y pagado. Nadie lo usaba. El equipo volvía siempre a WhatsApp
- El 8/8/2026, David escribió en mayúsculas en el grupo: "HASTA LA FECHA NO ESTAMOS LOGRANDO COMPLETAR
  LOS PROTOCOLOS NECESITO QUE USTEDES MISMOS PUEDAN ESTAR HABILITANDO LOS PROTOCOLOS"

**Conclusión clave:** el problema no es falta de herramientas. Es que las herramientas existentes piden cambiar
de canal. **Crash no pide eso.**

Los protocolos de calidad son obligatorios por ley (Ley 32069, contrato N° 81-2026-GRA). Sin ellos, la
valorización mensual (el pago a la constructora) se bloquea. Y el Especialista de Calidad responde legalmente
por 7 años post-entrega (Art. 1784 Código Civil).

---

## 2. Qué se construye en Fase 0

Fase 0 es un piloto de validación, no un producto completo. El objetivo es una sola cosa:

> **¿El equipo de campo adopta Crash y llena protocolos sin que David tenga que perseguirlos?**

### 2.1 Lo que SÍ se construye

- ✅ PWA (Progressive Web App) para campo — formulario de captura de protocolo
- ✅ Backend API con 3 endpoints core
- ✅ Base de datos con evidencia inmutable
- ✅ Generador de PDF de protocolo completado
- ✅ Notificaciones WhatsApp a David cuando se completa un protocolo
- ✅ Vista simple de estado de protocolos (puede ser Google Sheets en Fase 0)

### 2.2 Lo que NO se construye en Fase 0

- Dashboard web completo — se puede usar Google Sheets temporalmente
- App móvil nativa — la PWA es suficiente para el piloto
- Multi-obra — solo esta obra por ahora
- Integración con Fieldwire o SEACE — Fase 2+
- Autenticación compleja — un PIN simple por técnico es suficiente

---

## 3. Flujos de usuario

### 3.1 Flujo del técnico de campo (usuario principal)

El técnico termina una actividad constructiva. Abre Crash desde el ícono guardado en su pantalla de inicio
(PWA). El flujo completo tarda 3-5 minutos:

| Paso | Pantalla | Lo que hace el sistema |
|---|---|---|
| 1 | Inicio — 3 botones: CONCRETO / TOPOGRAFÍA / COMPACTACIÓN | Detecta GPS automáticamente. Pre-llena la progresiva más cercana |
| 2 | Selecciona la actividad | Carga el formulario específico con los campos exactos del protocolo |
| 3 | Llena los datos (slump, mixer, probetas, etc.) | Valida en tiempo real: verde si está en rango, rojo si no cumple |
| 4 | Toma foto con la cámara integrada | Guarda la foto con metadatos de GPS y timestamp inmutable. No editable después |
| 5 | Toca ENVIAR | Guarda en BD, genera PDF del protocolo, notifica a David por WhatsApp |
| 6 | Confirmación: CONFORME / NO CONFORME | Si hay NC, abre flujo de reporte con descripción y foto adicional |

### 3.2 Flujo de David (Especialista de Calidad)

David NO necesita abrir Crash para saber qué está pasando. El sistema lo notifica:

- Cada vez que se completa un protocolo: recibe WhatsApp con resumen
- Cada vez que hay una No Conformidad: recibe alerta con foto y detalle
- Al final del día: recibe resumen con protocolos completados vs pendientes
- Para generar el PDF del protocolo: abre la vista de estado (Google Sheets en Fase 0) y descarga

> En Fase 0, David ve el estado en una Google Sheet que Crash actualiza automáticamente. El dashboard web
> completo viene en Fase 1.

---

## 4. Especificación de pantallas — PWA

### 4.1 Pantalla de inicio
URL: `crash.app/{obra_id}` — Muestra: **CRASH** · Obra: Totora-Yanamilla · Progresiva: 0+144 (auto-GPS).
Tres botones grandes: CONCRETO / TOPOGRAFÍA / COMPACTACIÓN. Campo PIN para entrar.

### 4.2 Formulario de Concreto (actividad principal Fase 0)

- Paño + Progresiva
- Slump medido (cm) — rango válido mostrado: 7.5 – 12.5 cm
- N° de Mixer · Probetas tomadas · f'c de diseño (dropdown 175/210/245/280 kg/cm²)
- Foto del slump con pizarra (1 foto obligatoria)
- Observaciones · botón ENVIAR PROTOCOLO

### 4.3 Pantalla de resultado (CONFORME)
Slump: 8cm — dentro de rango · Protocolo guardado 08:47 AM · David Valdez notificado · PDF generado y
guardado · botón REGISTRAR OTRO.

### 4.4 Pantalla de No Conformidad (NO CONFORME)
Slump: 5cm — FUERA DE RANGO · Rango requerido: 7.5 – 12.5 cm · Describe el problema · Foto de evidencia ·
botón REPORTAR NO CONFORMIDAD.

---

## 5. API — contratos de interfaz

Snehil tiene libertad total de implementación. Los contratos definen qué datos entran y salen, no cómo se
procesan internamente.

### 5.1 `POST /protocolo` — Guardar protocolo
```jsonc
// Request
{
  "obra_id":      "AY-728-CRASH-001",
  "tecnico_pin":  "1234",
  "actividad":    "CONCRETO",
  "fecha_iso":    "2026-09-11T08:47:00-05:00",
  "gps_lat":      -13.1588,
  "gps_lng":      -74.2236,
  "paño":         "15",
  "progresiva":   "0+144",
  "datos": {
    "slump_cm":   8,
    "mixer_id":   "6D37",
    "probetas":   2,
    "fc_diseño":  175
  },
  "foto_url":     "https://storage.crash.app/fotos/...",
  "observaciones":""
}
// Response
{
  "protocolo_id":   "PROT-2026-0847-001",
  "resultado":      "CONFORME",
  "no_conformidad": null,
  "pdf_url":        "https://storage.crash.app/pdfs/PROT-2026-0847-001.pdf",
  "mensaje":        "Protocolo guardado. David notificado."
}
```

### 5.2 `GET /obra/{id}/estado` — Estado de protocolos
```jsonc
{
  "obra_id":        "AY-728-CRASH-001",
  "actualizado_en": "2026-09-11T09:15:00-05:00",
  "resumen": {
    "total":        84,
    "conformes":    71,
    "no_conformes": 3,
    "pendientes":   10
  },
  "protocolos": [ { "paño":"15","progresiva":"0+144","actividad":"CONCRETO",
                    "fecha":"2026-09-11","resultado":"CONFORME","pdf_url":"..." } ]
}
```

### 5.3 `GET /obra/{id}/dosier` — Generar Dosier de Calidad
```jsonc
{
  "dosier_url":     "https://storage.crash.app/dosier/AY-728-DOSIER.pdf",
  "generado_en":    "2026-09-11T09:30:00-05:00",
  "total_protocolos": 84,
  "coberturas":     ["CONCRETO","TOPOGRAFÍA","COMPACTACIÓN"],
  "no_conformidades_abiertas": 1
}
```

### 5.4 `POST /no-conformidad` — Registrar NC
```jsonc
{
  "protocolo_id":  "PROT-2026-0847-001",
  "descripcion":   "Slump de 5cm, fuera del rango 7.5-12.5cm",
  "foto_url":      "https://...",
  "accion_tomada": "Se rechazó el mixer y se solicitó nuevo despacho"
}
```

---

## 6. Modelo de datos

### 6.1 Tabla `protocolos`
id (UUID inmutable) · obra_id · tecnico_id (PIN) · actividad (ENUM: CONCRETO | TOPOGRAFÍA | COMPACTACIÓN |
ENCOFRADO | ACERO) · fecha_hora (TIMESTAMP WITH TZ, inmutable) · gps_lat/gps_lng · paño · progresiva ·
datos_json (JSONB) · resultado (ENUM: CONFORME | NO_CONFORME | PENDIENTE) · foto_url (inmutable) · pdf_url ·
created_at (auto, NUNCA editable).

### 6.2 Tabla `no_conformidades`
id · protocolo_id (FK) · descripcion · foto_url · estado (ENUM: ABIERTA | EN_PROCESO | CERRADA) ·
accion_correctiva · cerrada_en.

### 6.3 Tabla `tecnicos`
id · obra_id · nombre · pin (VARCHAR hash, 4 dígitos — sin contraseña compleja, el campo no usa eso) ·
whatsapp (notificaciones) · rol (ENUM: TECNICO_CAMPO | ESPECIALISTA_CALIDAD | RESIDENTE).

---

## 7. Criterios de validación — EG-2013

Criterios exactos que el sistema valida automáticamente, extraídos del Manual de Carreteras EG-2013 y del PAC
de esta obra. Si el resultado no cumple → No Conformidad automática.

| Actividad | Campo | Criterio CONFORME | Fuente |
|---|---|---|---|
| CONCRETO | Slump | Entre 7.5 y 12.5 cm para pavimento rígido (consistencia plástica) | EG-2013 + diseño de mezcla AKHISE |
| CONCRETO | f'c de diseño | 175, 210, 245 o 280 kg/cm² según partida | Especificación técnica del expediente |
| CONCRETO | Probetas | Mínimo 2 probetas por vaciado mayor a 4 m³ | EG-2013 |
| COMPACTACIÓN | Proctor Modificado | ≥ 100% del Proctor Modificado | PAC EVEREST_PAC_01 + informe David |
| COMPACTACIÓN | Humedad | Dentro de ±1.5% de la humedad óptima | PAC EVEREST_PAC_01 |
| COMPACTACIÓN | Espesor Sub Base | ≥ 20 cm | Expediente técnico reformulado |
| COMPACTACIÓN | Espesor Base | ≥ 25 cm | Expediente técnico reformulado |
| TOPOGRAFÍA | Variación de cota | ≤ 1 cm respecto al plano | PAC EVEREST_PAC_01 |
| TOPOGRAFÍA | Alineamiento | Dentro de tolerancia del plano | EG-2013 |

> **Snehil:** estos criterios van como **constantes en el código**, no en la base de datos. Si cambian por adenda
> al expediente, Kenny actualiza el código — no es algo que el usuario configure.
>
> ⚠ **Conflicto a resolver con TECH_SPEC.md (PROTOKOL v2.4):** v2.4 declara los criterios como *datos* (decisión
> irreversible #1) y slump 8.9–12.7 cm con 4 probetas por mixer; CRASH v1 usa constantes en código, slump
> 7.5–12.5 cm y 2 probetas por vaciado >4 m³. **Pendiente de reconciliar con Snehil antes de codear.**

---

## 8. Notificaciones WhatsApp

WhatsApp en Fase 0 es SOLO para notificaciones salientes a David. NO es canal de captura (eso va por la PWA).
Usar WhatsApp Business API oficial de Meta.

| Trigger | Destinatario | Mensaje |
|---|---|---|
| Protocolo CONFORME completado | David (Esp. de Calidad) | Paño {N} \| {actividad} \| {progresiva} — CONFORME ✅ Slump: {valor}cm \| Mixer: {id} \| {hora} PDF: {link} |
| Protocolo NO CONFORME | David + número del Residente | NO CONFORMIDAD — Paño {N} \| {actividad} Problema: {descripción} Técnico: {nombre} \| {hora} Foto: {link} |
| Protocolo pendiente >4 h después de actividad programada | David | Paño {N} lleva 4h sin protocolo de {actividad}. ¿Verificar con el técnico? |
| Resumen fin de día (7 PM) | David | Resumen {fecha}: Conformes: {n} ✅ NC: {n} ❌ Pendientes: {n} ⏳ Ver detalle: {link} |

---

## 9. Stack recomendado — Fase 0

| Capa | Sugerencia | Por qué |
|---|---|---|
| PWA (campo) | React + Vite + Tailwind CSS | Rápido, offline con Service Workers, instalable en Android sin Play Store |
| Backend API | Lo que Snehil domine más — Python/FastAPI o Java/Spring Boot | Cualquiera sirve; Spring Boot si se planea escalar enterprise |
| Base de datos | PostgreSQL en Railway o Render | Simple, confiable, JSONB para datos variables por actividad |
| Storage de fotos | Cloudflare R2 o Supabase Storage | Barato, URLs permanentes |
| Generador de PDF | PDFKit (Node) o WeasyPrint (Python) | PDF del protocolo completado |
| Notificaciones WA | WhatsApp Business API — Meta directa o Twilio | Meta directa si ya hay cuenta Business verificada |
| Deploy | Render.com o Railway | Gratis para el piloto |
| Vista de estado Fase 0 | Google Sheets con Apps Script | David ya lo usa; no hace falta dashboard todavía |

---

## 10. Definición de éxito — Fase 0

El piloto dura **4 semanas**. Al final, una sola pregunta:

> **¿El equipo de campo llenó >80% de los protocolos sin que David tuviera que pedírselo?**

Si sí → Fase 1: dashboard real + generador del Dosier de Calidad.
Si no → analizar por qué y ajustar antes de invertir más tiempo.

| Métrica | Meta Fase 0 | Cómo se mide |
|---|---|---|
| Tasa de adopción | ≥ 80% de protocolos completados sin pedido explícito de David | Ratio en BD: completados / total esperado por cronograma |
| Tiempo por protocolo | ≤ 5 minutos | Timestamp de inicio vs envío en la PWA |
| Tasa de error de datos | ≤ 10% de registros inválidos o incompletos | Validaciones fallidas en el API |
| NC detectadas | Al menos 1 NC real detectada y reportada | Confirma que el sistema valida correctamente |
| Satisfacción de David | "Ya no tengo que perseguir a nadie" | Entrevista directa al finalizar el piloto |

---

## 11. Timeline — Fase 0

| Semana | Qué construye Snehil | Hito |
|---|---|---|
| Semana 1 | Setup infra + BD + API endpoint POST /protocolo + formulario básico de concreto en PWA | Primer protocolo guardado en BD desde el celular de un técnico |
| Semana 2 | Validaciones automáticas EG-2013 + generador de PDF + notificaciones WhatsApp a David | David recibe su primer WhatsApp automático de Crash |
| Semana 3 | Formularios de Topografía y Compactación + flujo de NC + Google Sheets sync | Los 3 tipos de protocolo funcionan; David ve el estado en Sheets |
| Semana 4 | Pruebas en campo con el equipo real + ajustes UX + GET /obra/{id}/estado | Piloto activo con el equipo de Totora-Yanamilla |

---

## 12. Preguntas para Snehil (antes de confirmar timeline con David)

1. ¿Cuántas horas por semana puedes dedicar a Crash en paralelo a tus otros proyectos?
2. ¿Tienes cuenta de Meta Business verificada para la WhatsApp API, o necesitamos tramitarla?
3. ¿Prefieres Python/FastAPI o Java/Spring Boot para el backend del piloto?
4. ¿Tienes acceso a Railway/Render o prefieres otro proveedor de deploy?
5. ¿Hay algo en la especificación que no está claro o que cambiarías?
