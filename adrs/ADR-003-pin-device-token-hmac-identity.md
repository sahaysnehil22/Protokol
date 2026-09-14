# ADR-003: Identity Model: Persistent Device Token + Hashed Technician PIN + GPS + Integrity Hash

## Context
Phase 0 field technicians operate in harsh physical environments (sunlight, dust, gloves, noise, weak connectivity) and need to complete protocols in under 5 minutes. Complex password managers, multi-factor SMS auth, or heavy OAuth flows fail in field conditions. Conversely, anonymous forms lack legal evidentiary validity.

## Decision
1. Issue a persistent UUID `device_token` (`dvc_...`) upon device initialization, stored in browser local storage.
2. Authenticate technicians using a 4-digit numeric PIN, stored only as a salted cryptographic hash (`pin_hash`), never plaintext.
3. Every protocol submission requires `(device_token, technician_pin, gps)`.
4. Calculate a cryptographic SHA-256 HMAC integrity hash across `(protocol_id, project_id, activity, recorded_at, gps, panel, chainage, measurements, technician_id, device_token)` stored on the protocol row.

## Consequences
- Frictionless <5 second technician sign-off on-site.
- Strong non-repudiation: associates the record with a specific physical phone, technician identity, geographic coordinates, and cryptographic proof of tamper resistance.

## Reversibility
**Irreversible**. Retrofitting identity requirements on existing unsigned protocol archives compromises the evidentiary chain of custody.
