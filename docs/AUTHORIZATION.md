# CADence NorthStar Authorization Model

## Authority

Authorization is enforced server-side by the secure gateway. React navigation, hidden buttons, request headers, and client-provided actor fields are usability aids only and never grant permission.

## Roles

NorthStar recognizes these normalized roles:

- System Administrator
- Laboratory Administrator
- Office Manager
- Customer Service
- CAD Technician
- Production Technician
- Ceramist
- QC Technician
- Shipping
- Billing
- Sales
- Doctor
- Read-only Auditor

Roles are tenant memberships, not global properties of a person. A future user may hold different roles in different tenants.

## Permission groups

Permissions are organized by domain and operation:

- dashboard.read
- practice.read / practice.manage
- doctor.read / doctor.manage
- patient.read / patient.manage
- case.read / case.manage
- production.read / production.manage
- qc.read / qc.manage
- shipping.read / shipping.manage
- billing.read / billing.manage
- audit.read

A route maps to one permission. Write methods require the corresponding `manage` permission. Permission evaluation is centralized and must not be duplicated in domain routers.

## Baseline permission matrix

| Role | Primary scope |
|---|---|
| System Administrator | All tenant resources and explicit administrative override |
| Laboratory Administrator | All laboratory ERP resources inside the tenant |
| Office Manager | Practice, patient, case, and operational read access with authorized patient/case management |
| Customer Service | Directory and case coordination with production/QC/shipping visibility |
| CAD Technician | Assigned case and production/CAD operations with QC visibility |
| Production Technician | Assigned production operations and related case visibility |
| Ceramist | Ceramics production operations and related case visibility |
| QC Technician | QC management plus required case, production, and shipping visibility |
| Shipping | Shipment management plus required case, QC, and directory visibility |
| Billing | Invoice/payment management plus required practice, case, and shipment visibility |
| Sales | Practice and Doctor management with read access to operational and financial context |
| Doctor | Read access limited to granted practices and associated records |
| Read-only Auditor | Read-only tenant visibility, including audit records |

The code-level permission matrix is authoritative for enforcement. This document describes intent and must be updated whenever the matrix changes.

## Tenant boundaries

Every authenticated session belongs to one tenant. The gateway supplies the trusted tenant ID to repositories and downstream services. Client-supplied tenant identifiers are ignored or rejected.

System and Laboratory Administrators may operate across locations within their tenant only when their membership grants those locations. Cross-tenant administrative operations require a future platform-control plane and are not granted by tenant administrator roles.

## Location boundaries

Memberships carry an allowed `location_ids` list. Current CP2 records are not all location-addressable, so location enforcement is applied where a location identifier exists and retained in request identity for future modules.

New location-aware modules must:

1. include `locationId` in durable records,
2. index tenant plus location,
3. filter reads by authorized locations,
4. validate writes against authorized locations, and
5. add cross-location authorization tests.

## Practice ownership

Memberships may contain explicit `practice_ids`. Non-override users with practice grants are denied access to request bodies, query filters, or route parameters that identify an unauthorized practice.

Doctor and portal roles must always receive explicit practice grants. Practice ownership propagates to Doctors, Patients, Cases, shipments, and invoices through relationship checks rather than trusting a standalone request parameter.

## Administrative override

Administrative override is an explicit membership flag. It is not inferred solely from a role label. Override:

- applies only inside the session tenant,
- is included in immutable audit context,
- does not bypass authentication or CSRF protection,
- does not grant cross-tenant access, and
- should be used only by reviewed administrator memberships.

Future sensitive operations may require step-up authentication even when override is present.

## Request evaluation order

1. Authenticate the server-side session.
2. Confirm the user is active.
3. Validate CSRF for mutations.
4. Determine the route permission.
5. Evaluate the role permission set.
6. Evaluate tenant, location, and practice scope.
7. attach trusted identity and audit context.
8. Execute the domain operation.
9. Record operation result.

Deny-by-default applies when a protected route has no recognized permission mapping or a role is unknown.

## Audit requirements

Authorization denials record user, role, tenant, session, path, method, required permission, scope identifier, timestamp, IP, user agent, and failure result. Successful authenticated mutations receive a security request audit event in addition to existing domain audit history.

## Testing requirements

Every role or permission change requires:

- permission-matrix tests,
- representative allowed and denied API tests,
- tenant and practice isolation tests,
- CSRF regression tests,
- session lifecycle tests,
- browser scenarios for materially different user experiences, and
- unchanged administrator regression coverage.

## Future policy evolution

The centralized evaluator is designed to evolve from RBAC toward RBAC plus attributes. Future attributes may include location, department, assigned technician, case ownership, practice relationship, shift, risk level, protected-health-information purpose, and step-up authentication state.

Policy-as-code or an external authorization engine should be adopted only when the rule set requires independent deployment, formal policy review, or cross-service evaluation. Domain services must continue receiving a verified principal and may never accept untrusted role headers from external clients.
