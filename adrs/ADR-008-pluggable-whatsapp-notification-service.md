# ADR-008: Pluggable WhatsApp Notification Service Architecture

## Context
WhatsApp is the project team's real-time communication medium. The Quality Specialist must be notified within 60 seconds when a protocol is submitted, when a Non-Conformance opens, when a 28-day cylinder fails, or when a protocol is overdue. WhatsApp is strictly an alert channel, not a data-entry interface. Production WhatsApp BSP credentials (Twilio / Meta Cloud API) may not be configured during early pilot staging.

## Decision
1. Implement an abstract `NotificationAdapter` interface with methods: `sendAlert(recipient, message, metadata)`.
2. Provide a default `DevConsoleNotificationAdapter` that records every message payload to the database `notifications` table and logs formatted alerts to stdout/console.
3. Provide a `TwilioWhatsAppAdapter` and `MetaCloudWhatsAppAdapter` that activate when corresponding environment variables (`TWILIO_ACCOUNT_SID`, `WHATSAPP_API_KEY`) are present.
4. If production credentials are missing, the system operates in dev mode with clear warnings and never pretends external delivery succeeded when it was only logged locally.

## Consequences
- Business logic is completely decoupled from the messaging vendor.
- Immediate local and automated testability without live external API dependencies.

## Reversibility
**Highly Reversible**. Adding new messaging channels (e.g. Telegram, Email, SMS) only requires implementing a new adapter class.
