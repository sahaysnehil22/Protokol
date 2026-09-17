# PROTOKOL — Sistema de Trazabilidad de Calidad Vial

> **Source of Truth:** PROTOKOL Technical Product Document v2.4 (Septiembre 2026)  
> **Directiva:** N° 017-2023-CG/GMPL (Contraloría General de la República del Perú)

PROTOKOL es una plataforma de aseguramiento y control de calidad (QA/QC) para obras de infraestructura vial pública por administración directa y contrata. 

---

## Características Principales (Arquitectura v2.4)

1. **Configuración de Proyecto Dinámica (Criteria as Data):**
   - Elimina valores fijos en código TypeScript. Los proyectos, umbrales de slump, resistencias de diseño $f'c$, criterios de aceptación y listas de verificación se almacenan en base de datos.
   - Soporta creación de nuevos proyectos con sus propios parámetros sin alterar código fuente.
   - El proyecto piloto de Ayacucho (`AY-728-001`, Tramo AY-728 a AY-729) se provee como datos de semilla (*seed data*).

2. **Modelo de Vaciado de Concreto Multi-Camión (Multi-Truck Ready-Mix):**
   - Soporta vaciados masivos con 1 a 20+ camiones mixer por protocolo.
   - Cada camión cuenta con:
     - Identificador de Mixer / Placa
     - Número de Guía de Remisión
     - Medición individual de Asentamiento (*Slump*)
     - Conjunto de probetas cilíndricas programadas (configuración piloto: 4 probetas por camión)
   - Validación independiente por camión: si un camión falla en asentamiento, se genera una No Conformidad específica vinculada a dicho camión, manteniendo el registro estructurado.

3. **Compuerta de Cumplimiento Diferido (Rotura de Probetas):**
   - Al registrar el vaciado, el protocolo pasa a estado `PROVISIONAL_PASS`.
   - Roturas tempranas a 7 días registran evolución de resistencia sin alterar el estado provisional.
   - El protocolo transiciona a `PASS` definitivo únicamente cuando la totalidad de las probetas a 28 días cumplen la resistencia contractual $f'c$. Si cualquier probeta a 28 días no alcanza la resistencia, el protocolo transiciona a `FAIL` y genera una No Conformidad formal.

4. **Inmutabilidad Criptográfica y Disparadores SQL:**
   - Cada protocolo cuenta con hash SHA-256 de integridad calculado con HMAC sobre mediciones, coordenadas GPS, panel, progresiva y metadatos.
   - Disparador SQLite (`trg_protocols_immutability`) bloquea cualquier edición o alteración arbitraria de protocolos guardados, permitiendo únicamente la transición legítima de `PROVISIONAL_PASS` a `PASS`/`FAIL`. Las correcciones requieren un nuevo registro vinculado con `supersedes_protocol_id`.

5. **Identidad del Técnico y Dispositivo:**
   - Verificación estricta mediante token de dispositivo registrado y hash de PIN criptográfico (SHA-256 + salt). Los PINs nunca se almacenan en texto plano ni se exponen en logs.

6. **Internacionalización Bilingüe (i18n):**
   - Interfaz de usuario PWA y reportes PDF completamente bilingües (Español / Inglés) seleccionables en tiempo real.
   - Enums y contratos internos permanecen en identificadores estables (`CONCRETE`, `SURVEY`, `COMPACTION`, `STEEL`, `PASS`, `FAIL`, `PROVISIONAL_PASS`).

7. **Desconectado Primero (Offline-First):**
   - Cola de sincronización IndexedDB con clave de idempotencia (`UUIDv4`). De-duplicación en servidor para garantizar que reintentos de red no generen registros duplicados.

---

## Estructura de la Base de Datos

- `projects`: Configuración del proyecto (ID, nombre, contrato, entidad, modo de ejecución, huso horario, regla de muestreo, probetas por camión, $f'c$ por defecto, destinatarios de alertas WhatsApp).
- `technicians`: Padrón de especialistas autorizados con `pin_hash`, `device_token`, `whatsapp`, `cip_number`.
- `criteria`: Reglas de aceptación por actividad configuradas como datos (`BETWEEN`, `GTE`, `LTE`, `EQ`).
- `protocols`: Registros inmutables con hash de integridad, coordenadas GPS, progresiva y veredicto.
- `concrete_trucks`: Registros normalizados de cada camión mixer participante en un vaciado.
- `cylinders`: Probetas individuales programadas a 7 y 28 días vinculadas a su respectivo camión y protocolo.
- `nonconformances`: Registro formal de desviaciones abiertas automáticamente con alerta en <60s.
- `photos`: Metadatos opacos de fotografías (hash SHA-256, coordenadas EXIF, timestamp, storage key).
- `notifications`: Registro de auditoría de alertas WhatsApp despachadas.

---

## Requisitos de Entorno y Variables de Configuración

Las variables de entorno se reservan exclusivamente para infraestructura, almacenamiento y credenciales:

```env
# Puerto del servidor (por defecto 3000)
PORT=3000

# Rutas de almacenamiento persistente
DATABASE_PATH=./data/protokol.db
UPLOAD_DIR=./data/uploads
PDF_DIR=./data/pdfs
DOSSIER_DIR=./data/dossiers

# Seguridad y Criptografía
HMAC_SECRET=your-secure-random-hmac-secret-min-32-chars

# Proveedor de Notificaciones WhatsApp (Opcional en desarrollo)
WHATSAPP_PROVIDER=DEV
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
```

---

## Despliegue en Render (Persistent Disk Deployment)

> ⚠️ **IMPORTANTE SOBRE PERSISTENCIA EN PRODUCCIÓN:**  
> Por defecto, el sistema de archivos de Render es **efímero**. Al reiniciar o redesplegar el servicio, los archivos en el disco raíz se pierden. Para producción con SQLite y archivos locales (fotos, PDFs, dossiers), **es obligatorio configurar un Render Persistent Disk**.

### Pasos para Configurar en Render:

1. **Crear un Web Service en Render:**
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start` (ejecuta `node index.js`, con soporte automático para `--experimental-sqlite`)

2. **Configurar el Persistent Disk:**
   - En la pestaña **Disks** del servicio en Render, añadir un disco persistente:
     - **Name:** `protokol-data`
     - **Mount Path:** `/var/data`
     - **Size:** 5 GB a 20 GB (según volumen estimado de fotografías y dossiers)

3. **Configurar las Variables de Entorno en Render:**
   - `NODE_ENV=production`
   - `DATABASE_PATH=/var/data/protokol.db`
   - `UPLOAD_DIR=/var/data/uploads`
   - `PDF_DIR=/var/data/pdfs`
   - `DOSSIER_DIR=/var/data/dossiers`
   - `HMAC_SECRET=<cadena-aleatoria-secreta>`
   - `WHATSAPP_PROVIDER=DEV` (o credenciales Twilio de producción)

Con esta configuración, la base de datos SQLite y todos los archivos adjuntos se almacenarán de forma permanente en `/var/data`, preservándose entre despliegues y reinicios del servidor.

---

## Comandos de Desarrollo y Verificación

```bash
# Instalar dependencias
npm install

# Compilar TypeScript
npm run build

# Ejecutar suite completa de pruebas (19 suites, 21 requisitos v2.4)
npm test

# Iniciar servidor en modo desarrollo con recarga automática
npm run dev

# Iniciar servidor en modo producción
npm start
```

---

## Contratos de API Principales

- `POST /api/protocols`: Registro de nuevo protocolo con verificación de token/PIN, soporte multi-camión y validación dinámica.
- `POST /api/protocols/:id/cylinder-result`: Registro de ensayo diferido de rotura de probeta (7d / 28d) con control de compuerta contractual.
- `GET /api/projects/:id/status`: Estado agregado de calidad del proyecto, progreso por paño/progresiva y probetas pendientes.
- `GET /api/projects/:id/dossier`: Generación y compilación del dossier maestro consolidado de calidad en PDF.
- `GET /api/projects`: Listado de proyectos configurados.
- `POST /api/projects`: Creación de nuevo proyecto con configuración personalizada.
- `GET /api/projects/:id/criteria`: Consulta de criterios de aceptación del proyecto.
- `POST /api/projects/:id/criteria`: Adición de nuevos criterios de aceptación.
- `GET /api/projects/:id/technicians`: Padrón de especialistas asignados al proyecto.
