# ADR-007: Offline-First Architecture via Service Worker & IndexedDB Queue

## Context
Peruvian road projects (such as section AY-728 to AY-729 in rural Ayacucho) operate in areas with intermittent or zero cellular connectivity. Field technicians must be able to record protocols, capture photos, and receive immediate local validation feedback without waiting for internet access.

## Decision
1. Deploy a Progressive Web App (PWA) with a Service Worker caching the entire UI shell.
2. Maintain an offline IndexedDB queue storing pending submissions, local photo blobs, and cached validation criteria.
3. Assign a client-generated UUID idempotency key to every submission.
4. When the browser detects an `online` event or visibility change, the background sync worker flushes queued items sequentially to `POST /protocols` using the idempotency key.
5. The server checks the idempotency key to prevent duplicate protocol creation upon retry.

## Consequences
- The technician can complete protocols under zero connectivity without interruption.
- Network restores trigger seamless synchronization without manual user intervention.

## Reversibility
**Reversible in weeks**.
