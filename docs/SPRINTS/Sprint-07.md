# Sprint 07 — Shipping & Logistics

## Status

Complete and verified on the Sprint 7 pull request.

## Objective

Deliver an authenticated logistics lifecycle from QC approval through delivery confirmation with multi-case shipment composition, packing control, courier and tracking management, barcode-ready identifiers, auditable history, and dashboard visibility.

## Scope

- Ready to Ship, Awaiting Pickup, Shipped, and Delivered queues.
- Shipment creation for one or multiple QC-approved cases.
- Partial shipment support by allowing selected subsets of ready cases.
- Required packing checklist enforcement.
- Courier selection and editable courier name.
- Tracking-number capture and transition enforcement.
- Barcode-ready case values (`CASE-<case number>`) and shipment values (`SHIP-<shipment number>`).
- Placeholder-backed scanner compatibility without hardware integration.
- Timestamped status history with actor attribution.
- Delivery confirmation and linked case completion.
- Dashboard logistics totals and queue metrics.
- Shipping API endpoints and authenticated React workspace.
- Full Playwright lifecycle from QC approval to Delivered.

## Acceptance gates

- [x] Frozen-lockfile installation passes.
- [x] TypeScript validation passes without contract weakening.
- [x] Production build passes.
- [x] API gateway, upstream API, and frontend start successfully.
- [x] Only QC-approved Ready to Ship cases can be selected.
- [x] Active shipments prevent duplicate case assignment.
- [x] Required packing checklist items must be complete.
- [x] Single-case, partial, and multi-case shipment payloads validate.
- [x] Courier and tracking-number rules pass.
- [x] Shipment transitions follow Ready to Ship → Awaiting Pickup → Shipped → Delivered.
- [x] Shipping history captures actor, timestamps, notes, and status changes.
- [x] Case and shipment barcode values are generated.
- [x] Delivered shipments complete linked clinical cases.
- [x] Dashboard logistics metrics update.
- [x] Authentication and Sprint 3–6 browser regressions pass.
- [x] Sprint 7 Playwright lifecycle passes.

Verified by Sprint 07 Validation run `30235588799` and Runtime Validation run `30235588800`.

## Persistence note

Sprint 7 intentionally retains in-memory shipments, shipment-case associations, packing checklists, tracking events, delivery confirmations, barcode values, and history. Future migration must use transactional shipment and shipment-item tables, immutable shipping-event records, unique tracking-number indexes, durable barcode/label artifacts, encrypted object storage, retention controls, and integration-safe courier identifiers.

## Out of scope

- Durable database persistence.
- Durable label, manifest, and proof-of-delivery object storage.
- Physical barcode scanner integration.
- Live courier-rate purchasing or external courier APIs.
- Automated customer notifications.
