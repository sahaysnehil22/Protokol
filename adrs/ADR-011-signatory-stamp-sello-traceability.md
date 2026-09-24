# ADR-011: Signatory Stamp (Sello) & PIN Traceability for Peruvian PPI Protocols

## Context
In Peruvian public infrastructure and private real estate inspection (Directiva N° 017-2023-CG/GMPL and MTC EG-2013), a single blanket "Sign & Issue" button does not meet legal audit requirements. Field review with Lead Civil Engineer Ing. David Valdez Ochoa (Ayacucho road project AY-728/AY-729) established that:
1. Every protocol must present the physical paper-equivalent **5-box signature grid**:
   - Box 1: Especialista de Calidad (Ejecución / Contratista)
   - Box 2: Especialista de Calidad (Supervisión)
   - Box 3: Supervisor de Obra
   - Box 4: Residente de Obra
   - Box 5: Especialista de Estructuras (Supervisión)
2. Each signature box must be individually bindable to a licensed professional engineer account with their Colegiatura CIP number and personal 4-digit security PIN.
3. In Peruvian construction practice, engineers affix both a signature (*firma*) and an official rubber professional stamp (*sello*) containing their CIP number and title.

## Decision
1. **Dedicated Signatures Table (`signatures`)**:
   - Model individual approval slots linked to `protocols(id)`.
   - Track `signatory_id`, `signatory_name`, `role`, `sign_order`, `cip_number`, `status` (`PENDING` | `SIGNED`), `signed_at`, `signature_key`, and `stamp_key`.
2. **Cryptographic Traceability via `stamp_key`**:
   - When an engineer authorizes a protocol with their PIN via `POST /api/protocols/:id/sign`, generate and record a distinct `stamp_key` (opaque storage reference) and update the SHA-256 HMAC integrity hash of the protocol.
   - The initial submitter automatically signs Box 1 upon submission. Supervision and resident engineers sign their corresponding boxes through their device/account with their PIN.
3. **Dual PDF & UI Visual Representation**:
   - Render all 5 boxes in the web interface and vector PDF output, showing the engineer's name, role, CIP registration number, digital timestamp, and stamp verification badge.

## Consequences
- Completely satisfies Contraloría General de la República and OSITRAN audit requirements for electronic quality records.
- Eliminates physical paper circulation delays while maintaining strict individual accountability for every technical hold point (*punto de parada*).

## Reversibility
**Reversible in days**: Signature records are modular and stored in a standalone table linked by foreign key to `protocols`.
