# ADR-005: Strict Protocol Record Immutability & Append-Only Revision Chain

## Context
Quality protocols are formal construction legal artifacts. In Peruvian public works, modifying an existing inspection protocol after signature constitutes falsification of public records and exposes the Quality Specialist and Site Resident to criminal sanctions. When field corrections or rectifications occur, the original record must remain intact.

## Decision
1. Persisted rows in the `protocols` table are strictly immutable. Application-level update mutations are rejected, and an SQLite database trigger prevents `UPDATE` statements on persisted protocols.
2. If a protocol requires rectification, a new protocol record is submitted with a `supersedes_protocol_id` foreign key referencing the original protocol.
3. The protocol state machine permits state transitions only via documented domain events (e.g. 28-day cylinder laboratory results transition `PROVISIONAL_PASS` $\rightarrow$ `PASS` or `FAIL`), preserving full event logs in the `cylinders` and `notifications` tables.

## Consequences
- Guarantees forensic audit defensibility during Comptroller General (*Contraloría General de la República*) inspections.
- Prevents accidental or intentional tampering with historical inspection data.

## Reversibility
**Irreversible**. Allowing in-place edits undermines the legal integrity of the quality assurance system.
