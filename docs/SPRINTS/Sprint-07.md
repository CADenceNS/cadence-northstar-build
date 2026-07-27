# Sprint 07 — Shipping & Logistics

## Status

Implementation complete; validation pending on the Sprint 7 pull request.

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

- [ ] Frozen-lockfile installation passes.
- [ ] TypeScript validation passes without contract weakening.
- [ ] Production build passes.
- [ ] API gateway, upstream API, and frontend start successfully.
- [ ] Only QC-approved Ready to Ship cases can be selected.
- [ ] Active shipments prevent duplicate case assignment.
- [ ] Required packing checklist items must be complete.
- [ ] Single-case, partial, and multi-case shipment payloads validate.
- [ ] Courier and tracking-number rules pass.
- [ ] Shipment transitions follow Ready to Ship → Awaiting Pickup → Shipped → Delivered.
- [ ] Shipping history captures actor, timestamps, notes, and status changes.
- [ ] Case and shipment barcode values are generated.
- [ ] Delivered shipments complete linked clinical cases.
- [ ] Dashboard logistics metrics update.
- [ ] Authentication and Sprint 3–6 browser regressions pass.
- [ ] Sprint 7 Playwright lifecycle passes.

## Persistence note

Sprint 7 intentionally retains in-memory shipments, shipment-case associations, packing checklists, tracking events, delivery confirmations, barcode values, and history. Future migration must use transactional shipment and shipment-item tables, immutable shipping-event records, unique tracking-number indexes, durable barcode/label artifacts, encrypted object storage, retention controls, and integration-safe courier identifiers.

## Out of scope

- Durable database persistence.
- Durable label, manifest, and proof-of-delivery object storage.
- Physical barcode scanner integration.
- Live courier-rate purchasing or external courier APIs.
- Automated customer notifications.
