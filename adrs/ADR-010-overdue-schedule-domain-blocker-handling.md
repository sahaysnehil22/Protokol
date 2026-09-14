# ADR-010: R10 Overdue Protocol Schedule Handling (Domain Blocker Isolation)

## Context
Requirement R10 specifies that if an expected protocol has not been submitted 4 hours after its scheduled activity, the Quality Specialist must be notified. However, primary project evidence revealed that no single authoritative digital schedule exists; schedules are passed around via conflicting Excel spreadsheets (`Cronograma_Progresivas.xlsx`). Fabricating a synthetic scheduling algorithm would violate the core directive to never invent construction domain rules.

## Decision
1. Explicitly isolate the scheduling source as `DOMAIN_BLOCKER_1`.
2. Implement a configurable `protocol_schedules` database table storing `(project_id, activity, panel, chainage, scheduled_at, notified_overdue_at)`.
3. Provide an overdue monitoring service (`overdue.service.ts`) that evaluates scheduled items against submitted protocols where `current_time > scheduled_at + 4 hours`.
4. When overdue items are detected, send a WhatsApp alert to the Quality Specialist and set `notified_overdue_at = current_time` to prevent notification spam.
5. Provide API endpoints to import schedules from validated project files once the authoritative schedule source is formally designated.

## Consequences
- Satisfies Requirement R10 deterministically without hardcoding fake scheduling assumptions.
- Ready to ingest the real schedule once David and the Site Resident establish the single source of truth.

## Reversibility
**Reversible in days**.
