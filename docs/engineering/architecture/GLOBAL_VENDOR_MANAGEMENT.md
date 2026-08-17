# Global Vendor Management (GVM)

Status: OPTIONAL ENTITLEMENT; PLANNED / NOT_STARTED.

GVM is a tenant-isolated commercial module for laboratories that license it. It is not required NorthStar Core functionality.

## Scope

GVM is planned to provide:

1. Vendor Analytics Dashboard
2. Operations Feed / Logistics Command Board
3. Vendor Directory & Configuration
4. Audit & System Logs

It must support case-level and component-level outsourcing. A single case may route different components differently, such as an external custom titanium abutment with an internally produced zirconia crown.

## Tenant and identity boundary

Each laboratory receives its own GVM environment. Vendor records, capabilities, rates, communications, shipments, margins, and policies are tenant-owned. Other laboratories must never see them. CADence platform administrators manage entitlement and service health without ordinary unrestricted access to tenant vendor pricing or internal finances.

## Planned vendor model

Vendor records may include:

- capabilities by restoration, appliance, material, and component;
- in-house versus outsource routing;
- versioned rate sheets, fabrication fees, rush surcharges, taxes, fees, shipping, cut-off times, grace windows;
- turnaround promises, carrier profiles, status, contact channels, and performance history.

Historical completed-case economics must retain the price and policy versions used at the time. Later rate-sheet edits must not rewrite history.

## Profitability

Planned analysis:

`Net Profit = Client Retail Price - (Vendor Fabrication Fee + Outbound Shipping + Inbound Shipping + Taxes/Fees)`

Store historical snapshots and distinguish known facts from forecasts. Margin ranges and warnings are configurable policies, not immutable clinical or financial truth.

## Vendor health

A configurable weighted score may include Quality 35%, Turnaround 25%, Cost/Margin 20%, Communication 10%, and Repair 10%. Targets such as remake rate, on-time rate, margin, response time, and repair time are policy defaults only.

Recommendations may include Increase Volume / Consolidate, Monitor, Renegotiate, Probation, and Do Not Use / Blocked. Recommendations never erase management authority and must retain evidence.

## Logistics and scheduling

A high-visibility wall-board mode is planned for past due, coming due, on track, critical rush, hold requested, and carrier exception. It may include appointment-based backward scheduling, transit estimates, geographic padding, carrier adapters, exceptions, route lock after fabrication begins, shipping upgrades, and reschedule candidates.

Safety buffers are configurable. A vendor or carrier API is not assumed to exist.

## Hold and cancellation truth

Cancellation states must distinguish:

- Cancellation Requested
- Vendor Acknowledged
- Cancellation Confirmed
- Cancellation Rejected / Production Started

A sent message is not cancellation proof. Support API-confirmed, vendor-confirmed, and manually verified cancellation. Add Suspend Production / Hold Requested with explicit acknowledgement states.

## Disclosure control

External vendor packages should disclose only what is needed for the outsourced work. Planned controls include:

- tokenized references such as `GVM-TX-9402`;
- internal mapping Tenant → Case → Token → Component → Vendor → Price Version → Shipment → Communications;
- minimization of patient and doctor/practice identity;
- metadata and filename sanitization;
- unbranded technical instructions;
- immutable disclosure audit.

Removing fields alone is not a HIPAA compliance claim.

## Communications and audit

Planned vendor communications may use approved email, WhatsApp provider, Slack, and phone escalation integrations. Preserve immutable requested, delivered, viewed-where-supported, acknowledged, confirmed, and escalated events. Never promise read/open evidence that a provider cannot supply.

GVM audit records are immutable. Administrators may acknowledge, resolve, supersede, or annotate, but may not erase historical warnings/events. Overrides classify as Operational Override Allowed, Manager Approval Required, or Hard Non-Overrideable. Every override records user, timestamp, prior state, requested state, reason, and authorization level.

## Architecture gates before implementation

Define tenant isolation, secret storage, capability/rate versioning, component routing, financial snapshots, disclosure controls, vendor-confirmation semantics, audit immutability, wall-board access, and fail-closed behavior before assigning implementation sprints. GVM remains optional and must be independently entitlement-controlled.
