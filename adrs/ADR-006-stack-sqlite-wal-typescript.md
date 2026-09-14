# ADR-006: Stack Selection: Node.js 20+, TypeScript, SQLite with WAL Mode

## Context
Phase 0 requires an extremely fast, deterministic, single-project pilot backend deployable to a minimal server with zero maintenance overhead. The validation engine and state machine require strict type safety and relational query support.

## Decision
- Runtime: Node.js 20+ with TypeScript.
- Database: SQLite via `better-sqlite3` with Write-Ahead Logging (`PRAGMA journal_mode = WAL`) and enforced foreign keys (`PRAGMA foreign_keys = ON`).
- Web Server: Express with modular service architecture.

## Consequences
- Zero external database daemon dependencies needed for Phase 0 pilot.
- ACID compliance with concurrent reader performance.
- Relational schema mirrors standard PostgreSQL syntax, enabling painless migration to Postgres when multi-project Phase 1 begins.

## Reversibility
**Reversible in days**: Schema and queries use standard SQL foreign keys and relational patterns that port directly to PostgreSQL.
