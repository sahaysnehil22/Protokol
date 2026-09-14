# ADR-009: Peruvian PPI Protocol PDF Generation & Quality Dossier Compiler

## Context
Peruvian state road supervision requires formal Inspection Point Program (*Programa de Puntos de Inspección - PPI*) documentation signed by the Quality Specialist, Resident, and Supervisor. Generic developer JSON dumps or unstyled reports are immediately rejected by state auditors. Additionally, closing a public works contract requires compiling all protocols, cylinder lab results, and non-conformances into a Quality Dossier (*Dosier de Calidad*).

## Decision
1. Implement server-side vector PDF generation using `pdfkit`.
2. Design the layout to mirror the standard Peruvian public works protocol format:
   - Official header with Project Name, Contract Number (`N° 81-2026-GRA-SEDECENTRAL-OAPF`), Entity (`Gobierno Regional de Ayacucho`), Section (`AY-728 a AY-729`).
   - Location block: Progresiva (chainage), Paño (panel), GPS coordinates, and capture timestamp.
   - Structured measurements table with evaluated criteria, units, and pass/fail badges.
   - Technician identification, device token, and cryptographic integrity verification code.
   - Embedded photo evidence panel with timestamps and GPS data.
3. Implement a dossier compilation service that generates an indexed master PDF compiling all completed protocols, laboratory strength curves, and non-conformance closure certificates.

## Consequences
- Produces inspection-ready legal documents that supervision and the Comptroller General can directly accept.

## Reversibility
**Reversible in days**: PDF rendering logic is isolated in `pdf.service.ts`.
