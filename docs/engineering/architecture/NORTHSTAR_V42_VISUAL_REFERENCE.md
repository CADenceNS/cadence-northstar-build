# CADence NorthStar Visual Reference Authority

| Authority | Locked value |
| --- | --- |
| `NORTHSTAR_VISUAL_REFERENCE` | `CADence NorthStar v4.2 — Sculpt, Cut & Navigation` |
| `REFERENCE_SOURCE` | `owner-supplied CADence_NorthStar_v4_2_SCULPT_CUT_NAVIGATION_OPEN_FIRST.zip` |
| `V4_2_REFERENCE_ROLE` | visual / interaction / workspace architecture authority |
| `CURRENT_MAIN_ROLE` | functional / security / persistence / commercial authority |
| `OWNER_VISUAL_APPROVAL_REQUIRED_BEFORE_UI_MERGE` | `TRUE` |
| `PR40_VISUAL_STATUS` | `REJECTED` |

## Integration rule

The v4.2 reference controls the application command bar, compact workspace rail,
contextual tool panel, active canvas, contextual inspector, telemetry strip, visual
tokens, information hierarchy, and responsive collapse behavior. It does not authorize
restoring demo data, local persistence, prototype geometry behavior, obsolete APIs, or
any historical security assumption.

Current main remains the authority for all server-backed workflows, authentication,
CSRF, tenant isolation, commercial authorization, PostgreSQL persistence, API contracts,
and Design Studio geometry. A visual restoration branch must remain unmerged until the
owner reviews its deployed browser experience and explicitly approves it.

## v4.2-to-current implementation map

| v4.2 element inspected | Current NorthStar implementation target |
| --- | --- |
| 54px persistent top command bar | `NorthStarCommandBar`: identity, active workspace context, notifications, authenticated session controls |
| 64px icon command rail | `NorthStarCommandRail`: role-filtered Command Center, cases, CAD entry, production, QC, shipping, billing, and commercial navigation |
| 272px contextual left panel | `WorkspaceToolPanel`: workspace-specific real-module switching and session scope context |
| Central workspace / canvas | `WorkspaceCanvas`: existing authenticated React modules and their server-backed CRUD/actions |
| ~310px right inspector | `WorkspaceInspector`: non-authoritative context/analysis that does not expose tenant records to Platform Admin |
| 30px telemetry/status strip | `TelemetryBar`: secure session, tenant/native or platform control-plane scope, active workspace, and synchronization state |
| v4.2 token / motion system | `apps/web/src/styles.css`: source-derived dark canvas, panel colors, thin borders, restrained accents, and 200ms motion |
| CAD-oriented Design Studio entry | Existing Vite Design Studio output and current geometry code remain intact; only the surrounding NorthStar entry language is restored |
