# Executive KPI Catalog

## Governance

Every KPI is tenant-scoped and versioned. Thresholds below are default architectural examples; each laboratory may configure approved targets without changing the business formula. Every displayed KPI includes `as_of`, freshness, formula version, source lineage and authorized drill-down.

## Production KPIs

| KPI | Business definition and formula | Sources | Cadence | Retention | Default target / warning / critical |
|---|---|---|---|---|---|
| Total Cases Received | Count distinct accepted operational cases with received time in period | Digital Intake, Case | near-real-time + daily snapshot | 7 years | tenant benchmark / -10% / -20% versus plan |
| Total Units Received | Sum production units on accepted cases in period | Prescription, Case | near-real-time + daily | 7 years | plan / -10% / -20% |
| Total Cases Completed | Count distinct cases reaching configured completion state in period | Production, QC | near-real-time + daily | 7 years | plan / -10% / -20% |
| Total Units Completed | Sum units on completed cases | Production, Prescription | near-real-time + daily | 7 years | plan / -10% / -20% |
| Production Throughput | Completed units ÷ productive labor hours; alternate case throughput remains separately named | Production, Time/assignment | hourly + daily | 7 years | tenant-defined / 90% / 80% target |
| Incoming vs Outgoing | Units received minus units completed in same period; ratio = completed ÷ received | Intake, Production | hourly + daily | 7 years | ratio ≥1.00 / <0.95 / <0.85 |
| Volume Growth | (current period units − comparison period units) ÷ comparison period units | KPI snapshots | daily/monthly | 10 years | plan / below plan / material decline |
| Volume Matrix | Sum units grouped by restoration category × material and selected dimensions | Prescription, Product Resolution | daily | 10 years | informational |

## Quality KPIs

| KPI | Formula | Sources | Cadence | Retention | Target / warning / critical |
|---|---|---|---|---|---|
| Global Remake % | Remake cases ÷ delivered cases eligible for remake measurement × 100 | QC, Case, Shipping | daily + monthly certified | 10 years | ≤2% / >2% / >4% |
| Global Repair % | Repair cases ÷ delivered cases eligible for repair measurement × 100 | QC, Case | daily + monthly | 10 years | ≤1% / >1% / >2.5% |
| Rework % | Internal rework outcomes ÷ completed QC inspections × 100 | QC | hourly + daily | 7 years | ≤5% / >5% / >10% |
| First-Pass Yield | Cases passing QC on first completed inspection ÷ cases with completed first inspection × 100 | QC | daily | 10 years | ≥95% / <95% / <90% |
| Defect Rate | Count defects ÷ completed units × 100 | QC, Production | daily | 10 years | tenant-defined |
| Root-Cause Concentration | Defects in top N root causes ÷ all defects × 100 | QC taxonomy | weekly/monthly | 10 years | informational Pareto |

All quality KPIs support restoration, material, Doctor, technician, department, scanner, location, reason and root-cause breakdowns.

## Communications KPIs

| KPI | Formula | Sources | Cadence | Retention | Target / warning / critical |
|---|---|---|---|---|---|
| Incoming Calls | Count inbound call events | Communications/CTI adapter | near-real-time + daily | 3 years | informational |
| Outgoing Calls | Count outbound call events | Communications/CTI | near-real-time + daily | 3 years | informational |
| Accepted Calls | Count inbound calls answered by authorized agent | CTI | near-real-time | 3 years | informational |
| Missed Calls | Inbound offered calls not answered and not intentionally abandoned before threshold | CTI | near-real-time | 3 years | ≤5% / >5% / >10% of offered |
| Average Wait Time | Sum(answered_at − offered_at) ÷ answered calls | CTI | 15 minutes + daily | 3 years | ≤30s / >30s / >60s |
| Average Handle Time | Sum(call_end − answer_time + wrap time) ÷ handled calls | CTI | hourly + daily | 3 years | tenant-defined |
| Abandonment % | Calls abandoned after configured short-abandon threshold ÷ offered calls × 100 | CTI | hourly + daily | 3 years | ≤5% / >5% / >10% |
| Unread Messages | Count authorized unread notification/message items as of time | Communications | real-time | rolling 1 year | 0 / >tenant threshold / aged critical |
| First Response Time | Median(first laboratory response − customer message time) | Communications | hourly + daily | 3 years | ≤2h / >2h / >8h business time |
| Communication Volume | Count events grouped by customer, department, channel and entity | Communications | hourly + daily | 5 years | informational |

## Financial KPIs

| KPI | Formula | Sources | Cadence | Retention | Target / warning / critical |
|---|---|---|---|---|---|
| Gross Production Value | Sum resolved standard production value before discounts, credits and tax; clearly labeled as non-GL operational value | Product Resolution, Pricing/Billing | daily | 10 years | plan-based |
| Revenue | Recognized revenue for period when Accounting exists; until then finalized invoice net amount is labeled billed revenue | Accounting; Billing fallback | daily + period certified | statutory + 10 years | plan / -5% / -10% |
| Average Case Value | Finalized invoice net product/service amount ÷ invoiced distinct cases | Billing | daily/monthly | 10 years | plan-based |
| Invoice Value | Sum finalized invoice total excluding voided invoices, with tax separately available | Billing | daily | 10 years | informational |
| Outstanding Checkout Value | Sum approved product-resolution value awaiting finalized invoice, explicitly estimated until Billing pricing completes | Product Resolution, Billing Review | real-time | 3 years | aging threshold |
| Accounts Receivable | Sum open invoice balance at as-of time | Billing | real-time + daily snapshot | 10 years | tenant-defined |
| AR Aging | Open balance grouped by days past due: current, 1–30, 31–60, 61–90, 91–120, 120+ | Billing | daily | 10 years | 120+ ≤2% / >2% / >5% |
| Collections | Sum payment amounts applied in period net of reversals/refunds | Billing/Payments | daily | 10 years | plan-based |
| Payment Velocity | Median paid-in-full date minus invoice issue date; DSO reported separately | Billing | daily/monthly | 10 years | ≤terms / >terms / >2×terms |
| Revenue Growth | (recognized revenue current − comparison) ÷ comparison | Accounting snapshots | monthly | 10 years | plan-based |
| Gross Margin | (recognized revenue − direct cost of revenue) ÷ recognized revenue ×100 | Accounting, Product cost | period certified | statutory + 10 years | tenant-defined |
| Net Margin | Net income ÷ recognized revenue ×100 | Accounting | period certified | statutory + 10 years | tenant-defined |
| Tax Liability | Sum finalized tax determinations less authorized remitted/adjusted amounts by filing period | Tax, Accounting | daily + filing period | statutory | zero overdue / due soon / overdue |
| Sales Tax Collected | Sum sales-tax components on finalized determinations | Tax | daily | statutory | reconciled to GL |
| Use Tax | Sum approved use-tax determinations | Tax | monthly | statutory | reconciled to GL |
| Tax by State | Taxable base and tax grouped by state jurisdiction and filing period | Tax | daily/monthly | statutory | informational |
| Subscription Revenue | NorthStar Platform recognized subscription revenue, Platform-authorized only | Platform Accounting | period certified | statutory | plan-based |

## Customer KPIs

| KPI | Formula | Sources | Cadence | Retention | Thresholds |
|---|---|---|---|---|---|
| Top Revenue Customers | Rank customer net revenue in selected period | Billing/Accounting | daily | 10 years | Top 10/15/20/30/40/50 |
| Top Volume Customers | Rank completed or received units, explicitly selected | Intake/Production | daily | 10 years | selectable N |
| Top Growth Customers | Rank period-over-period revenue or unit growth with minimum base-volume rule | KPI snapshots | monthly | 10 years | selectable N |
| Customer Retention | Customers active in prior comparison period and current period ÷ customers active in prior period ×100 | Case/Billing | monthly/quarterly | 10 years | ≥95% / <95% / <90% |
| Dormant Accounts | Customers with no accepted case for tenant-defined dormancy window but not closed | Case | daily | 7 years | alert-based |
| Lost Accounts | Customers formally closed or exceeding lost threshold after prior qualifying activity | CRM/Case policy | monthly | 10 years | alert-based |
| Customer Lifetime Value | Historical contribution margin plus approved forecast model; historical and predicted components displayed separately | Accounting, Billing, Forecast | monthly | 10 years | informational |
| Average Revenue per Doctor | Net revenue ÷ active revenue-generating Doctors in period | Accounting/Billing, Doctor | monthly | 10 years | plan-based |
| Average Units per Doctor | Units received or completed ÷ active Doctors, explicitly selected | Intake/Production | monthly | 10 years | plan-based |
| Revenue Concentration | Revenue from top N customers ÷ total tenant revenue ×100 | Accounting/Billing | monthly | 10 years | tenant risk threshold |
| Case/Material/Practice Mix | Share of units or revenue grouped by selected category | Intake, Product, Billing | daily/monthly | 10 years | informational |

## Operational KPIs

| KPI | Formula | Sources | Cadence | Retention | Target / warning / critical |
|---|---|---|---|---|---|
| On-Time Delivery | Delivered cases on/before committed date ÷ delivered cases with commitment ×100 | Shipping, Case | daily | 10 years | ≥95% / <95% / <90% |
| Average Turnaround | Average business duration from accepted/received milestone to delivered or configured completion milestone | Intake, Workflow, Shipping | daily | 10 years | product-category target |
| Production Backlog | Accepted cases not in terminal completed/cancelled state | Workflow/Production | real-time | daily snapshots 7 years | capacity-based |
| Department Backlog | Current accessible queue items grouped by department | Workflow projection | real-time | daily snapshots | capacity-based |
| Queue Aging | Current time minus queue-entry time, summarized median/P90/max | Workflow | real-time | 7 years | SLA-based |
| Cases Waiting | Count items in hold/waiting/clarification states | Workflow, Communications | real-time | 7 years | tenant-defined |
| Rush Volume | Rush cases or units ÷ all accepted cases or units ×100 | Intake | daily | 7 years | staffing threshold |
| Capacity Utilization | Productive workload hours ÷ available staffed capacity hours ×100 | Workflow, Staffing | hourly/daily | 7 years | 75–90% / >90% / >100% |
| Department Throughput | Completed units or transitions ÷ department productive hours | Production/Workflow | daily | 7 years | benchmark |
| Technician Productivity | Approved completed units weighted by configured complexity ÷ productive hours; never used without quality context | Production, QC, Time | daily/weekly | 7 years | benchmark plus quality guardrail |
| Equipment Utilization | Run time ÷ available scheduled time ×100, excluding approved maintenance | Equipment adapter | hourly/daily | 5 years | equipment-specific |

## Comparison and drill-down standards

All applicable KPIs support daily, weekly, monthly, quarterly, yearly, MoM, QoQ, YoY, rolling 12 months and fiscal-year comparisons. Drill-down dimensions are explicitly allowlisted and independently authorized. Financial KPIs do not expose Platform revenue to tenant users or tenant data to Platform users without approved scope.