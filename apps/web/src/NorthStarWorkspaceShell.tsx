import { ReactNode, useMemo } from 'react';

export type NorthStarWorkspace =
  | 'dashboard'
  | 'ecc'
  | 'uat'
  | 'intake'
  | 'intake-admin'
  | 'practices'
  | 'doctors'
  | 'patients'
  | 'cases'
  | 'production'
  | 'qc'
  | 'shipping'
  | 'billing'
  | 'commercial';

type NavigationItem = { id: NorthStarWorkspace; label: string; icon: string };

export const workspaceIcons: Record<NorthStarWorkspace, string> = {
  dashboard: '⌂', ecc: '◈', uat: '✓', intake: '⇩', 'intake-admin': '⌘',
  practices: '◫', doctors: '◉', patients: '◎', cases: '▤', production: '⇢',
  qc: '✓', shipping: '➤', billing: '$', commercial: '◌'
};

const workspaceGroups: Array<{ label: string; items: NorthStarWorkspace[] }> = [
  { label: 'Command Center', items: ['dashboard', 'ecc', 'uat'] },
  { label: 'Cases / Intake', items: ['intake', 'intake-admin', 'practices', 'doctors', 'patients', 'cases'] },
  { label: 'Operations', items: ['production', 'qc', 'shipping', 'billing'] },
  { label: 'Administration', items: ['commercial'] }
];

export function NorthStarCommandBar({
  title, subtitle, userName, roleLabel, isPlatformAdmin, onSignOut, children
}: {
  title: string; subtitle: string; userName: string; roleLabel: string; isPlatformAdmin: boolean;
  onSignOut: () => void; children?: ReactNode;
}) {
  const initials = userName.split(' ').map(value => value[0]).join('').slice(0, 2).toUpperCase();
  return <header className="ns-command-bar">
    <div className="ns-brand-lockup" aria-label="CADence NorthStar">
      <span className="ns-orbital-mark" aria-hidden="true"><i /></span>
      <div><strong>CADence NorthStar</strong><small>{isPlatformAdmin ? 'PLATFORM COMMAND' : 'OPERATIONAL WORKSPACE'}</small></div>
    </div>
    <div className="ns-context-bar">
      <div className="ns-context-chip ns-context-title"><h1>{title}</h1></div>
      <span className="ns-context-chip ns-context-subtitle">{subtitle}</span>
    </div>
    <div className="ns-command-actions">
      {children}
      <div className="ns-user-chip" title={roleLabel}><span>{initials || 'NS'}</span><div><strong>{userName}</strong><small>{roleLabel}</small></div></div>
      <button className="ns-icon-button ns-signout" type="button" onClick={onSignOut} aria-label="Sign out" title="Sign out">↗</button>
    </div>
  </header>;
}

export function NorthStarCommandRail({ navigation, active, onNavigate, isPlatformAdmin }: {
  navigation: NavigationItem[]; active: NorthStarWorkspace; onNavigate: (view: NorthStarWorkspace) => void; isPlatformAdmin: boolean;
}) {
  const primary = navigation.filter(item => !['commercial', 'uat', 'ecc', 'intake-admin', 'practices', 'doctors', 'patients'].includes(item.id));
  const admin = navigation.filter(item => item.id === 'commercial');
  return <nav className="ns-command-rail" aria-label="Workspace navigation">
    {primary.map(item => <RailButton key={item.id} item={item} active={active === item.id} onNavigate={onNavigate} />)}
    {!isPlatformAdmin && <a href="/design-studio.html" aria-label="CAD / Design Studio" title="CAD / Design Studio"><span aria-hidden="true">⬡</span><i>CAD / Design Studio</i></a>}
    <span className="ns-rail-spacer" />
    {!isPlatformAdmin && navigation.some(item => item.id === 'uat') && <RailButton item={navigation.find(item => item.id === 'uat')!} active={active === 'uat'} onNavigate={onNavigate} />}
    {admin.map(item => <RailButton key={item.id} item={item} active={active === item.id} onNavigate={onNavigate} />)}
  </nav>;
}

function RailButton({ item, active, onNavigate }: { item: NavigationItem; active: boolean; onNavigate: (view: NorthStarWorkspace) => void }) {
  return <button className={active ? 'active' : ''} type="button" onClick={() => onNavigate(item.id)} aria-label={item.label} title={item.label}>
    <span aria-hidden="true">{item.icon}</span><i>{item.label}</i>
  </button>;
}

export function WorkspaceToolPanel({ active, navigation, onNavigate, isPlatformAdmin }: {
  active: NorthStarWorkspace; navigation: NavigationItem[]; onNavigate: (view: NorthStarWorkspace) => void; isPlatformAdmin: boolean;
}) {
  const group = useMemo(() => workspaceGroups.find(candidate => candidate.items.includes(active)) ?? workspaceGroups[0], [active]);
  const items = [...new Set([...group.items, 'practices', 'doctors', 'patients', 'cases'] as NorthStarWorkspace[])]
    .map(id => navigation.find(item => item.id === id)).filter((item): item is NavigationItem => Boolean(item));
  const copy: Record<string, string> = {
    'Command Center': 'Live tenant-scoped operational telemetry and system context.',
    'Cases / Intake': 'Select a clinical entity or intake task without leaving the active workspace.',
    Operations: 'Technical work queues, inspection state, release readiness, and receivables.',
    Administration: 'Commercial fleet controls only. Tenant operational records remain unavailable.'
  };
  return <aside className="ns-tool-panel" aria-label={`${group.label} contextual tools`}>
    <section className="ns-panel-section">
      <div className="ns-panel-label"><span>WORKSPACE</span><b>{group.label}</b></div>
      <p>{copy[group.label]}</p>
    </section>
    <section className="ns-panel-section ns-tool-list">
      <div className="ns-panel-label"><span>CONTEXT TOOLS</span><b>{items.length}</b></div>
      {items.map(item => <button key={item.id} type="button" className={active === item.id ? 'active' : ''} onClick={() => onNavigate(item.id)}>
        <span aria-hidden="true">{item.icon}</span><div><strong>{item.label}</strong><small>{workspaceHint(item.id)}</small></div>
      </button>)}
    </section>
    {!isPlatformAdmin && <section className="ns-panel-section ns-object-status">
      <div className="ns-panel-label"><span>SESSION SCOPE</span><b className="ns-live">LIVE</b></div>
      <div><i className="ns-state-dot" /> Tenant-resolved access</div>
      <div><i className="ns-state-dot cyan" /> Server-backed workspace</div>
    </section>}
  </aside>;
}

function workspaceHint(view: NorthStarWorkspace) {
  const hints: Record<NorthStarWorkspace, string> = {
    dashboard: 'Operational telemetry', ecc: 'Executive analysis', uat: 'Operational checks', intake: 'Digital submissions', 'intake-admin': 'Rules and routing', practices: 'Laboratories & practices', doctors: 'Provider directory', patients: 'Patient records', cases: 'Clinical cases', production: 'Work queues', qc: 'Inspection & release', shipping: 'Dispatch readiness', billing: 'Accounts receivable', commercial: 'Commercial fleet control'
  };
  return hints[view];
}

export function WorkspaceInspector({ active, isPlatformAdmin }: { active: NorthStarWorkspace; isPlatformAdmin: boolean }) {
  const detail = inspectorDetail(active, isPlatformAdmin);
  return <aside className="ns-inspector" aria-label="Workspace inspector">
    <section className="ns-panel-section">
      <div className="ns-panel-label"><span>ACTIVE INSPECTOR</span><b>{detail.code}</b></div>
      <h2>{detail.title}</h2><p>{detail.copy}</p>
    </section>
    <section className="ns-panel-section ns-inspector-metrics">
      {detail.metrics.map(([label, value, tone]) => <div key={label}><span>{label}</span><b className={tone}>{value}</b></div>)}
    </section>
    <section className="ns-panel-section ns-inspector-note"><span>CONTEXT</span><p>{isPlatformAdmin ? 'Commercial authority is intentionally separate from laboratory operations.' : 'Actions and records are resolved through the authenticated tenant session.'}</p></section>
  </aside>;
}

function inspectorDetail(active: NorthStarWorkspace, isPlatformAdmin: boolean) {
  if (isPlatformAdmin) return { code: 'PLATFORM', title: 'Commercial Boundary', copy: 'Laboratory commercial state, activation, modules, seats, lifecycle, and immutable audit are available here.', metrics: [['AUTHORITY', 'COMMERCIAL', 'cyan'], ['OPERATIONS', 'DENIED', 'amber'], ['AUDIT', 'LIVE', 'green']] as Array<[string, string, string]> };
  const values: Partial<Record<NorthStarWorkspace, { code: string; title: string; copy: string; metrics: Array<[string, string, string]> }>> = {
    dashboard: { code: 'COMMAND', title: 'System Pulse', copy: 'Live workload, quality, shipping, and receivables context from the current tenant.', metrics: [['SESSION', 'SECURE', 'green'], ['SCOPE', 'TENANT', 'cyan'], ['SYNC', 'LIVE', 'green']] },
    cases: { code: 'CASE', title: 'Clinical Context', copy: 'Use the canvas to manage real intake records while keeping supporting context visible.', metrics: [['RECORDS', 'LIVE', 'green'], ['FILES', 'SCOPED', 'cyan'], ['ACCESS', 'ROLE', 'violet']] },
    production: { code: 'FLOW', title: 'Production State', copy: 'Track routing, assignment, SLA, and history in the active work queue.', metrics: [['QUEUE', 'LIVE', 'green'], ['SLA', 'TRACKED', 'cyan'], ['HISTORY', 'IMMUTABLE', 'violet']] },
    qc: { code: 'QC', title: 'Inspection Context', copy: 'Review checklist, defects, sign-off, and release state against the selected work.', metrics: [['STATUS', 'INSPECT', 'amber'], ['EVIDENCE', 'LIVE', 'green'], ['RELEASE', 'CONTROLLED', 'cyan']] },
    shipping: { code: 'SHIP', title: 'Dispatch Inspector', copy: 'Shipment readiness, packing, courier, tracking, and history remain in the active canvas.', metrics: [['QUEUE', 'READY', 'green'], ['TRACKING', 'LIVE', 'cyan'], ['HISTORY', 'RETAINED', 'violet']] },
    billing: { code: 'AR', title: 'Receivables Context', copy: 'Invoice, statement, balance, and aging activity remains linked to the laboratory account.', metrics: [['LEDGER', 'LIVE', 'green'], ['AGING', 'TRACKED', 'amber'], ['SCOPE', 'TENANT', 'cyan']] }
  };
  return values[active] ?? { code: 'NORTHSTAR', title: 'Workspace Context', copy: 'Current actions remain tied to the authenticated session and server-backed state.', metrics: [['SESSION', 'SECURE', 'green'], ['SCOPE', 'TENANT', 'cyan'], ['STATUS', 'READY', 'violet']] };
}

export function TelemetryBar({ active, isPlatformAdmin }: { active: NorthStarWorkspace; isPlatformAdmin: boolean }) {
  return <footer className="ns-telemetry-bar"><span className="ns-live">● SESSION SECURE</span><span>{isPlatformAdmin ? 'COMMERCIAL CONTROL PLANE' : 'TENANT-NATIVE WORKSPACE'}</span><span>{active.toUpperCase().replaceAll('-', ' ')} ACTIVE</span><span>API SYNCHRONIZED</span><span className="ns-build-label">CADence NorthStar</span></footer>;
}

export function WorkspaceCanvas({ children }: { children: ReactNode }) {
  return <main className="ns-workspace-canvas">{children}</main>;
}
