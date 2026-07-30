# Financial Accounting Architecture

## Purpose

Define NorthStar's future tenant accounting foundation without redesigning the existing Billing domain. Billing continues to own invoices, credits, payments and statements. Accounting owns books, periods, journals, balances and financial reporting.

## Boundary

Accounting owns:

- chart of accounts;
- accounting periods and fiscal years;
- journal entries and journal lines;
- posting rules;
- general-ledger balances;
- revenue recognition schedules;
- deferred revenue;
- accounts-receivable and accounts-payable control accounts;
- deposits, refunds and adjustments as accounting events;
- closing, reopening and restatement procedures;
- accounting audit trail and exports.

Accounting does not own case pricing, invoice workflow, payment collection UX, Product Catalog, Pricing Schedules, tax-rate logic, subscriptions or operational production records.

## Domain model

- `accounting_entity`: tenant legal entity and reporting currency;
- `fiscal_calendar`: fiscal-year and period pattern;
- `accounting_period`: open, soft-closed, closed or reopened;
- `ledger`: general, tax, management or future statutory ledger;
- `account`: stable code, name, type, normal balance and effective status;
- `account_hierarchy`: reporting rollup;
- `journal_entry`: source, date, period, status, reference and idempotency key;
- `journal_line`: account, debit/credit, currency, dimensions and source reference;
- `posting_rule`: versioned mapping from approved domain events to journal templates;
- `revenue_schedule`: recognized/deferred amounts by obligation and period;
- `vendor` and `payable_document`: future AP boundary;
- `bank_deposit`: grouped receipts and reconciliation status;
- `accounting_adjustment`: authorized correction linked to original posting;
- `close_checklist`: controls, approvers, evidence and outcome.

## Double-entry invariant

Every posted journal entry balances by accounting entity, ledger and currency. Posted entries are immutable. Corrections use reversing and replacement entries. Draft entries may be edited only before approval/posting.

## Event integration

Domain events or dedicated application commands propose accounting postings:

- invoice finalized;
- credit memo issued;
- payment received/applied/refunded;
- tax determination finalized or reversed;
- shipment/delivery milestone where recognition policy requires it;
- subscription invoice and payment events for Platform books;
- vendor bill and payment events when AP is implemented.

A posting service validates period status, posting-rule version, dimensions, idempotency and balance before committing the journal and outbox event.

## Revenue recognition

Recognition policies are versioned and assigned by product/accounting category, contract or subscription obligation. The architecture supports immediate recognition, milestone recognition, over-time recognition and deferred revenue. Historical schedules retain the policy version and source evidence used.

## Accounts receivable

Billing remains the operational source for invoices, credits, payments and statements. Accounting consumes finalized events and maintains control-account balances and reconciliation. Subledger-to-ledger reconciliation must prove invoice balance, unapplied cash, credits and GL control accounts agree by period.

## Accounts payable

Future AP supports vendors, bills, approvals, purchase orders, payments, credits and aging. AP is a separate subledger integrated through posting rules and does not reuse customer Billing tables.

## Period close

Closing procedures include:

1. verify migrations/build and source completeness;
2. reconcile Billing, payments, tax and bank deposits;
3. review unposted or failed events;
4. validate balanced journals and control accounts;
5. execute accruals, deferrals and approved adjustments;
6. certify reporting snapshots;
7. collect approvals and close the period.

Reopening requires elevated permission, reason, approval, immutable audit and restatement disclosure.

## Dimensions

Journal lines may reference tenant location, department, customer, product category, restoration category, tax jurisdiction, project/campaign and other approved analytical dimensions. Dimensions enrich reporting but never substitute for account codes or authorization.

## Multi-tenant and Platform accounting

Each laboratory tenant has isolated books. NorthStar Platform subscription revenue belongs to a separate Platform accounting entity and is never mixed with tenant laboratory revenue. Cross-tenant consolidation requires authorized aggregate processes and does not expose tenant transactions.

## Security and audit

- separate create, approve, post, close and reopen permissions;
- configurable separation of duties;
- immutable posted entries and approval history;
- audited exports and period changes;
- support grants required for Platform access to tenant books;
- sensitive bank and tax data uses least privilege and encryption controls.

## Non-goals

No chart-of-accounts tables, posting runtime, AP module, bank integration, financial statements or accounting UI are implemented in this architecture sprint.