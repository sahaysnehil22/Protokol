# ADR-001: Validation Criteria Stored as Database Records (Not in Code)

## Context
In Peruvian road infrastructure construction, technical criteria are not global constants. They are governed by each contract's specific *Expediente Técnico* (Master Technical File), local soil mechanics, environmental conditions, and accredited laboratory concrete mix design reports (*Diseño de Mezclas*). Hardcoding thresholds (such as slump ranges or compaction percentages) directly in application code would entangle the engine with a single project and cause false non-conformances whenever a mix design or specification changes.

## Decision
All validation criteria are stored exclusively as relational records in a dedicated `criteria` table, linked by `project_id` and `activity`. The validation engine reads criteria dynamically from the database and evaluates measurements using deterministic operators (`BETWEEN`, `GTE`, `LTE`, `EQ`).

## Consequences
- Multi-project support is preserved from day one without code alterations.
- Project-specific mix design updates can be applied dynamically via database seeding or administrative API.
- The system never makes assumptions about missing thresholds; missing values are flagged as `DOMAIN_BLOCKER` until formally provided by the project's quality management.

## Reversibility
**Irreversible**. Hardcoding criteria into business logic would require a total architectural overhaul across backend, database, and client layers.
