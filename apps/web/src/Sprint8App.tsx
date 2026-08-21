import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { FinancialDashboardSnapshot, User } from '@northstar/shared';
import { DoctorManagement, PracticeManagement } from './DirectoryManagement';
import { CaseManagement, PatientManagement } from './PatientCaseManagement';
import { ProductionManagement } from './ProductionManagement';
import { QCManagement } from './QCManagement';
import { ShippingManagement } from './ShippingManagement';
import { BillingManagement } from './BillingManagement';
import { Notifications } from './Notifications';
import { DigitalIntakeWorkspace } from './DigitalIntakeWorkspace';
import { IntakeAdministration } from './IntakeAdministration';
import { UatWorkspace } from './UatWorkspace';
import { setCsrfToken } from './security-client';
import { PlatformCommercialConsole } from './PlatformCommercialConsole';

type View = 'dashboard' | 'ecc' | 'uat' | 'intake' | 'intake-admin' | 'practices' | 'doctors' | 'patients' | 'cases' | 'production' | 'qc' | 'shipping' | 'billing' | 'commercial';
type PlatformRole = 'none' | 'platform-admin';
type AuthResponse = { user: User; csrfToken: string; session?: { platformRole?: PlatformRole } };
type Flag = { key: string; effective: boolean };
type NavigationItem = { id: View; label: string; code: string; signal: 'cyan' | 'green' | 'violet' | 'amber' };

const roleHome = (role: string, platformRole: PlatformRole): View => platformRole === 'platform-admin' ? 'commercial' : role === 'qc-technician' ? 'qc' : role === 'shipping' ? 'shipping' : role === 'billing' ? 'billing' : ['cad-technician', 'production-technician', 'ceramist'].includes(role) ? 'production' : ['doctor', 'doctor-portal-user', 'office-staff'].includes(role) ? 'cases' : 'dashboard';
const displayUserName = (value: string) => value.replace(/\bKeramos\b/gi, '').replace(/\s{2,}/g, ' ').trim() || 'Account user';

const roleAllows = (role: string, view: View) => {
  if (['system-administrator', 'laboratory-administrator', 'tenant-owner', 'tenant-administrator', 'platform-owner'].includes(role)) return true;
  const rules: Record<string, View[]> = {
    'office-manager': ['dashboard', 'uat', 'intake', 'practices', 'doctors', 'patients', 'cases', 'production', 'qc', 'shipping', 'billing'],
    'customer-service': ['dashboard', 'uat', 'intake', 'practices', 'doctors', 'patients', 'cases', 'production', 'qc', 'shipping'],
    'cad-technician': ['dashboard', 'uat', 'cases', 'production', 'qc'],
    'production-technician': ['dashboard', 'uat', 'cases', 'production', 'qc'], ceramist: ['dashboard', 'uat', 'cases', 'production', 'qc'],
    'qc-technician': ['dashboard', 'uat', 'cases', 'production', 'qc', 'shipping'], shipping: ['dashboard', 'uat', 'cases', 'shipping'],
    billing: ['dashboard', 'uat', 'practices', 'doctors', 'cases', 'shipping', 'billing'], sales: ['dashboard', 'uat', 'practices', 'doctors', 'cases', 'billing'],
    doctor: ['dashboard', 'uat', 'patients', 'cases'], 'doctor-portal-user': ['dashboard', 'uat', 'patients', 'cases'], 'office-staff': ['dashboard', 'uat', 'patients', 'cases'],
    'read-only-auditor': ['dashboard', 'ecc', 'uat', 'practices', 'doctors', 'patients', 'cases', 'production', 'qc', 'shipping', 'billing'],
  };
  return (rules[role] ?? ['dashboard']).includes(view);
};

const titles: Record<View, string> = { dashboard: 'Operations Overview', ecc: 'Executive Command Center', uat: 'Operational Validation', intake: 'Digital Intake Platform', 'intake-admin': 'Digital Intake Administration', practices: 'Practice Management', doctors: 'Doctor Management', patients: 'Patient Management', cases: 'Case Intake', production: 'Production Workflow', qc: 'Quality Control', shipping: 'Shipping & Logistics', billing: 'Billing & Financial Engine', commercial: 'Platform Commercial Management' };
const navigationItems: NavigationItem[] = [
  { id: 'dashboard', label: 'Dashboard', code: 'OV', signal: 'cyan' }, { id: 'ecc', label: 'Executive Command Center', code: 'EC', signal: 'violet' }, { id: 'uat', label: 'Validation', code: 'VA', signal: 'amber' }, { id: 'intake', label: 'Digital Intake', code: 'IN', signal: 'cyan' }, { id: 'intake-admin', label: 'Intake Administration', code: 'IA', signal: 'violet' }, { id: 'practices', label: 'Practices', code: 'PR', signal: 'green' }, { id: 'doctors', label: 'Doctors', code: 'DR', signal: 'green' }, { id: 'patients', label: 'Patients', code: 'PT', signal: 'cyan' }, { id: 'cases', label: 'Cases', code: 'CS', signal: 'cyan' }, { id: 'production', label: 'Production', code: 'PD', signal: 'violet' }, { id: 'qc', label: 'Quality Control', code: 'QC', signal: 'green' }, { id: 'shipping', label: 'Shipping', code: 'SH', signal: 'amber' }, { id: 'billing', label: 'Billing', code: 'BL', signal: 'amber' }, { id: 'commercial', label: 'Commercial Management', code: 'CM', signal: 'violet' },
];

export function Sprint8App() {
  const [session, setSession] = useState<User | null>(null);
  const [platformRole, setPlatformRole] = useState<PlatformRole>('none');
  const [checkingSession, setCheckingSession] = useState(true);
  const [view, setView] = useState<View>('dashboard');
  const [snapshot, setSnapshot] = useState<FinancialDashboardSnapshot | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const applySession = (value: AuthResponse) => { const nextPlatformRole = value.session?.platformRole ?? 'none'; setCsrfToken(value.csrfToken); setPlatformRole(nextPlatformRole); setSession(value.user); setView(roleHome(String(value.user.role), nextPlatformRole)); };

  useEffect(() => {
    let active = true;
    fetch('/api/auth/session').then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<AuthResponse>; }).then(value => { if (active) applySession(value); }).catch(() => { if (active) { setCsrfToken(null); setSession(null); setPlatformRole('none'); } }).finally(() => { if (active) setCheckingSession(false); });
    const expired = () => { setSession(null); setPlatformRole('none'); setSnapshot(null); setView('dashboard'); };
    window.addEventListener('northstar:session-expired', expired);
    return () => { active = false; window.removeEventListener('northstar:session-expired', expired); };
  }, []);

  useEffect(() => {
    if (!session || platformRole === 'platform-admin') { setSnapshot(null); setError(''); return; }
    Promise.all([fetch('/api/dashboard'), fetch('/api/feature-flags')]).then(async ([dashboardResponse, flagResponse]) => { if (!dashboardResponse.ok) throw new Error(); const dashboard = await dashboardResponse.json() as FinancialDashboardSnapshot; const flagList = flagResponse.ok ? await flagResponse.json() as Flag[] : []; setSnapshot(dashboard); setFlags(Object.fromEntries(flagList.map(flag => [flag.key, flag.effective]))); setError(''); }).catch(() => setError('Dashboard data is temporarily unavailable.'));
  }, [session, platformRole, revision]);

  const logout = async () => { try { await fetch('/api/auth/logout', { method: 'POST' }); } finally { setCsrfToken(null); setSession(null); setPlatformRole('none'); setView('dashboard'); } };
  if (checkingSession) return <LoadingShell />;
  if (!session) return <Login onLogin={applySession} />;

  const role = String(session.role); const isPlatformAdmin = platformRole === 'platform-admin'; const canAdmin = !isPlatformAdmin && ['system-administrator', 'laboratory-administrator', 'tenant-owner', 'tenant-administrator', 'platform-owner'].includes(role); const refresh = () => setRevision(value => value + 1); const userName = displayUserName(session.name);
  const navigation = navigationItems.filter(item => isPlatformAdmin ? item.id === 'commercial' : item.id !== 'commercial' && roleAllows(role, item.id) && (item.id !== 'intake-admin' || canAdmin) && (item.id !== 'ecc' || canAdmin || role === 'read-only-auditor') && flags[item.id] !== false);

  return <div className="nsdl-shell">
    <aside className="command-rail" aria-label="NorthStar command rail">
      <div className="rail-brand"><span className="rail-mark" aria-hidden="true">NS</span><span><strong>CADence</strong><small>NorthStar</small></span></div>
      <div className="rail-status"><span className="live-dot" />SYSTEM LINKED</div>
      <nav className="rail-navigation" aria-label="Application workspaces">{navigation.map(item => <button key={item.id} className={view === item.id ? 'active' : ''} data-signal={item.signal} onClick={() => setView(item.id)}><span className="rail-glyph" aria-hidden="true">{item.code}</span><span className="rail-label">{item.label}</span></button>)}</nav>
      <div className="rail-footer"><span>{isPlatformAdmin ? 'COMMERCIAL CONTROL' : 'TENANT WORKSPACE'}</span><button type="button" onClick={() => void logout()}>Sign out</button></div>
    </aside>
    <main className="workspace-stage">
      <header className="nsdl-topbar"><div className="workspace-title"><div className="title-signal"><span className={isPlatformAdmin ? 'signal-violet' : 'signal-cyan'} />LIVE WORKSPACE</div><p className="eyebrow">{isPlatformAdmin ? 'CADENCE PLATFORM COMMERCIAL CONTROL' : 'CADENCE NORTHSTAR'}</p><h1>{titles[view]}</h1><p className="subtitle">{isPlatformAdmin ? 'Commercial account administration only. Tenant operational data is intentionally unavailable.' : 'Secure operational workspace resolved from your tenant context.'}</p></div><div className="topbar-controls">{!isPlatformAdmin && <Notifications />}<div className="user-card"><span className="user-avatar">{userName.split(' ').map(value => value[0]).join('').slice(0, 2)}</span><div><strong>{userName}</strong><span>{isPlatformAdmin ? 'platform administrator' : role}</span></div></div></div></header>
      <div className="workspace-rule" />{error && <p className="error" role="alert">{error}</p>}
      <section className="workspace-frame" aria-label={`${titles[view]} workspace`}>
        {view === 'commercial' && isPlatformAdmin && <PlatformCommercialConsole />}{view === 'dashboard' && !isPlatformAdmin && <RoleDashboard role={role} snapshot={snapshot} onNavigate={setView} />}{view === 'ecc' && !isPlatformAdmin && <ExecutivePreview snapshot={snapshot} />}{view === 'uat' && !isPlatformAdmin && <UatWorkspace canAdmin={canAdmin} />}{view === 'intake' && !isPlatformAdmin && <DigitalIntakeWorkspace />}{view === 'intake-admin' && canAdmin && <IntakeAdministration />}{view === 'practices' && !isPlatformAdmin && <PracticeManagement onCountsChanged={refresh} />}{view === 'doctors' && !isPlatformAdmin && <DoctorManagement onCountsChanged={refresh} />}{view === 'patients' && !isPlatformAdmin && <PatientManagement onCountsChanged={refresh} />}{view === 'cases' && !isPlatformAdmin && <CaseManagement onCountsChanged={refresh} />}{view === 'production' && !isPlatformAdmin && <ProductionManagement onCountsChanged={refresh} />}{view === 'qc' && !isPlatformAdmin && <QCManagement onMetricsChanged={refresh} />}{view === 'shipping' && !isPlatformAdmin && <ShippingManagement onMetricsChanged={refresh} />}{view === 'billing' && !isPlatformAdmin && <BillingManagement onMetricsChanged={refresh} />}
      </section>
    </main>
  </div>;
}

function LoadingShell() { return <div className="login-page"><div className="login-card nsdl-loading"><span className="rail-mark">NS</span><p className="eyebrow">CADENCE NORTHSTAR</p><h1>Securing workspace</h1><p>Establishing your trusted session context…</p></div></div>; }

function Login({ onLogin }: { onLogin: (value: AuthResponse) => void }) {
  const [value, setEmail] = useState(''); const [password, setPassword] = useState(''); const [rememberMe, setRememberMe] = useState(false); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setLoading(true); setError(''); try { const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: value, password, rememberMe }) }); if (!response.ok) { setError(response.status === 423 ? 'Account temporarily locked. Try again later.' : 'Incorrect email or password.'); return; } const payload = await response.json() as AuthResponse; const sessionResponse = await fetch('/api/auth/session'); const current = sessionResponse.ok ? await sessionResponse.json() as AuthResponse : payload; onLogin(current); } catch { setError('Unable to reach the authentication service.'); } finally { setLoading(false); } };
  return <div className="login-page"><form className="login-card" onSubmit={submit}><div className="login-brand"><span className="rail-mark">NS</span><div><p className="eyebrow">CADENCE NORTHSTAR · SECURE OPERATIONS CONSOLE</p><h1>Welcome back</h1><p>Sign in to your protected workspace.</p></div></div><label>Email<input value={value} onChange={event => setEmail(event.target.value)} type="email" autoComplete="username" required /></label><label>Password<input value={password} onChange={event => setPassword(event.target.value)} type="password" autoComplete="current-password" required /></label><label className="checkbox"><input type="checkbox" checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} />Remember this device</label>{error && <p className="error" role="alert">{error}</p>}<button className="primary" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button><small>Use credentials provisioned by your administrator.</small></form></div>;
}

function RoleDashboard({ role, snapshot, onNavigate }: { role: string; snapshot: FinancialDashboardSnapshot | null; onNavigate: (view: View) => void }) {
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }); const cards = [['Open cases', snapshot?.openCases ?? 0], ['In production', snapshot?.productionInProgress ?? 0], ['In QC', snapshot?.casesInQc ?? 0], ['Ready to ship', snapshot?.shipmentsReady ?? 0], ['Outstanding AR', money.format(snapshot?.financial.outstandingAR ?? 0)], ['Unread notifications', 'Open']]; const quick: Record<string, Array<[View, string]>> = { billing: [['billing', 'Review invoices'], ['uat', 'Run billing validation']], shipping: [['shipping', 'Open shipping queue'], ['uat', 'Run shipping validation']], 'qc-technician': [['qc', 'Open QC queue'], ['uat', 'Run QC validation']], 'cad-technician': [['production', 'Open CAD queue'], ['cases', 'Review cases']], doctor: [['cases', 'View practice cases'], ['uat', 'Run portal validation']] }; const actions = quick[role] ?? [['intake', 'Create submission'], ['cases', 'Open cases'], ['uat', 'Open validation']];
  return <><section className="telemetry-grid">{cards.map(([label, value], index) => <article className="telemetry-card" data-tone={['cyan', 'violet', 'green', 'amber'][index % 4]} key={label}><span className="telemetry-index">0{index + 1}</span><span>{label}</span><strong>{value}</strong><i /></article>)}</section><section className="content-grid"><article className="panel command-panel"><p className="eyebrow">ROLE WORKSPACE</p><h2>{role.replaceAll('-', ' ')} command surface</h2><p>Live operational data and actions are filtered by your server-resolved role and tenant scope.</p><div className="settings-actions">{actions.map(([target, label]) => <button className="secondary" key={target} onClick={() => onNavigate(target)}>{label}<span aria-hidden="true">↗</span></button>)}</div></article><article className="panel pulse-panel"><div className="panel-heading"><div><p className="eyebrow">LIVE TELEMETRY</p><h2>Operational pulse</h2></div><span className="system-tag">NORTHSTAR LIVE</span></div>{[['Cases received today', snapshot?.casesReceivedToday ?? 0], ['Cases at risk', snapshot?.casesAtRisk ?? 0], ['Rush cases', snapshot?.rushCases ?? 0], ['QC pass rate', `${Math.round((snapshot?.qcPassRate ?? 0) * 100)}%`]].map(([label, value]) => <div className="department-row" key={label}><strong>{label}</strong><span>{value}</span></div>)}</article></section></>;
}

function ExecutivePreview({ snapshot }: { snapshot: FinancialDashboardSnapshot | null }) {
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }); const kpis = [['Production backlog', snapshot?.openCases ?? 0], ['On-time delivery', `${snapshot?.logistics.deliveredOnTime ?? 0}`], ['QC pass rate', `${Math.round((snapshot?.qcPassRate ?? 0) * 100)}%`], ['Revenue', money.format(snapshot?.financial.invoicedTotal ?? 0)], ['Outstanding AR', money.format(snapshot?.financial.outstandingAR ?? 0)], ['Active practices', snapshot?.activePractices ?? 0]]; const workload = useMemo(() => snapshot?.departmentWorkload ?? [], [snapshot]);
  return <><section className="telemetry-grid">{kpis.map(([label, value], index) => <article className="telemetry-card" data-tone={['violet', 'cyan', 'green', 'amber'][index % 4]} key={label}><span className="telemetry-index">0{index + 1}</span><span>{label}</span><strong>{value}</strong><i /></article>)}</section><section className="content-grid"><article className="panel"><p className="eyebrow">PRODUCTION INTELLIGENCE</p><h2>Cases by department</h2>{workload.map(item => <div className="department-row" key={item.department}><strong>{item.department}</strong><span>{item.total} total · {item.overdue} overdue</span></div>)}</article><article className="panel"><p className="eyebrow">FINANCIAL INTELLIGENCE</p><h2>AR aging preview</h2>{Object.entries(snapshot?.financial.aging ?? {}).map(([bucket, value]) => <div className="department-row" key={bucket}><strong>{bucket}</strong><span>{money.format(Number(value))}</span></div>)}<p className="note">Predictive analytics and governed historical comparisons remain available only to authorized roles.</p></article></section></>;
}
