# CADence NorthStar Technical Debt Register

## Policy

Technical debt is tracked explicitly and may not disappear through roadmap edits. Every item requires priority, owner, recommended resolution and status. Owners are accountable roles until named individuals are assigned.

Priority: P0 release blocker, P1 high, P2 medium, P3 low/evidence-triggered.

| ID | Item | Category | Priority | Owner | Recommended resolution | Status |
|---|---|---|---:|---|---|---|
| TD-001 | Complete hands-on Business UAT for RC1 | Release assurance | P0 | Product Owner + UAT Lead | Execute walkthrough, record defects/enhancements, obtain business sign-off before Sprint 13B | Open |
| TD-002 | Repository version `0.3.0` differs from RC1 application/build `0.13.0` | Release/versioning | P1 | Release Engineering | Approve one semantic-version source and automate package/build/manifest consistency checks | Open |
| TD-003 | Playwright dependency uses `latest` | Dependency control | P1 | Engineering Reliability | Pin and renovate through controlled PRs with full browser validation | Open |
| TD-004 | No hosted Business UAT environment | Deployment/UAT | P1 | Platform Operations | Provision isolated UAT hosting with managed secrets, database, ObjectStorage policy and reset governance | Open |
| TD-005 | Business stakeholder startup still requires Node, pnpm and PostgreSQL | Usability/release | P1 | Release Engineering | Produce supported containerized launcher or hosted UAT path; retain manual path for engineering | Open |
| TD-006 | Large API route modules contain mixed application and persistence concerns | Maintainability | P2 | API Architecture | Extract typed application services and repositories incrementally without changing public behavior | Open |
| TD-007 | Some route handlers use direct SQL | Layering | P2 | API Architecture | Move domain persistence into canonical repositories with tenant-scoped contracts | Open |
| TD-008 | PostgreSQL ObjectStorage is not the final production object platform | Infrastructure | P1 before GA | Platform Operations | Implement managed provider adapter, encryption, signed access, backups and migration tooling | Open |
| TD-009 | Malware scanning, quarantine, retention and legal holds are deferred | Security/compliance | P1 before external deployment | Security + Platform Operations | Add upload pipeline controls and governed retention before broad customer use | Open |
| TD-010 | Production notification delivery providers are absent | Integration | P2 | Communications Owner | Add email/SMS/push adapters behind existing notification boundary | Open |
| TD-011 | Account and membership administration UI is incomplete | Identity operations | P2 | Identity Owner | Add tenant-scoped user/session/role administration after UAT priorities are confirmed | Open |
| TD-012 | SSO, SCIM, MFA/passkeys and step-up authentication are deferred | Security | P2/P1 before enterprise GA | Identity Owner | Implement based on commercial/security requirements with ADR and recovery paths | Open |
| TD-013 | Distributed rate limiting and risk-based authentication are deferred | Security/scale | P2 | Security Owner | Add shared rate-limit store and risk policy before multi-instance production | Open |
| TD-014 | Cross-domain asynchronous delivery lacks production transactional outbox | Reliability | P1 before Workflow/major integrations | Platform Architecture | Implement outbox, idempotent consumers, retries and dead-letter review before async orchestration | Open |
| TD-015 | Legacy Case Intake and Digital Intake coexist | Compatibility | P2 | Digital Intake Owner | Preserve both until an approved migration command, parity review and rollback plan exist | Accepted temporary |
| TD-016 | Pricing Schedule foundation lacks Billing-owned calculation runtime | Functional gap | P2 | Billing Owner | Implement eligibility/calculation through a Billing command in an approved sprint | Deferred |
| TD-017 | Post-QC Billing handoff is not event/outbox driven | Coupling | P2 | Billing + Platform Architecture | Introduce approved command/event contract after outbox foundation | Deferred |
| TD-018 | ECC preview is operational, not warehouse-backed | Analytics limitation | P2 | ECC/BI Owner | Keep preview read-only; implement governed BI only in Sprint 13E | Accepted preview |
| TD-019 | Sample Laboratory A does not support complete tenant-native ERP CRUD | UAT limitation | P1 for commercial multi-tenant proof | Tenant Platform Owner | Expand only in approved tenant-foundation/commercial work after RC1 UAT | Open |
| TD-020 | Platform/Tenant Owner UAT personas map to existing roles | Authorization simulation | P1 for Sprint 13B | Identity + Licensing Owner | Implement permanent commercial roles and explicit support grants in Sprint 13B | Open |
| TD-021 | Runtime and Sprint pipelines duplicate substantial setup | CI maintainability | P2 | Engineering Reliability | Extract reusable workflow actions while preserving independent certification purposes | Open |
| TD-022 | Engineering Reliability is not yet a named mandatory workflow stage | Process | P1 | Engineering Governance | Add documented reliability checklist and dedicated workflow before next RC | Open |
| TD-023 | Historical feature branches remain in repository | Repository hygiene | P3 | Repository Maintainer | Archive/delete only after confirming traceability is preserved by merged commits and PR history | Open |
| TD-024 | Some historical documentation still references prior baselines | Documentation | P2 | Documentation Owner | Link historical documents to current registries and mark their scope as historical | Open |
| TD-025 | Backup/restore automation and tenant recovery are architecture-only | Disaster recovery | P1 before GA | Platform Operations | Implement tested backups, PITR, object restore, tenant recovery and evidence schedule | Open |
| TD-026 | No production provider adapters for scanners, payments, shipping, tax or accounting | Integration | P2 | Domain Owners | Implement only through stable adapter contracts when commercial priority is approved | Deferred |
| TD-027 | Performance/load baselines are not formally certified | Performance | P2 | Engineering Reliability | Define representative UAT workload, measure API/browser/database baselines and alert thresholds | Open |
| TD-028 | Accessibility is baseline-tested but not formally audited | Accessibility | P2 | Web Experience Owner | Run WCAG-focused audit and remediate before GA | Open |
| TD-029 | Design Studio integration contracts are not yet formalized | Cross-product governance | P2 | Design Studio + NorthStar Architects | Define artifact, identity, authorization, event and version contracts without shared database coupling | Open |

## Known temporary workarounds

- UAT deterministic credentials are Development/UAT only.
- Development password-reset tokens are returned only in non-production environments.
- UAT personas simulate commercial roles that are architecture-approved but not implemented.
- ECC reads operational data directly until the BI warehouse exists.

## Closure policy

A debt item may be marked Resolved only when:

1. the corrective work is merged;
2. tests and validation pass;
3. documentation and registries are updated;
4. any replacement debt is recorded;
5. the resolution commit or release is referenced.