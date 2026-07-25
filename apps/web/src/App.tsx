import { useEffect, useState } from 'react';
import type { DashboardSnapshot } from '@northstar/shared';

const fallback: DashboardSnapshot = {
  generatedAt: new Date().toISOString(),
  casesReceivedToday: 18,
  casesDueToday: 12,
  casesAtRisk: 3,
  casesInQc: 7,
  shipmentsReady: 5,
  monthRevenue: 84250,
  departments: [
    { name: 'Receiving', activeCases: 8, status: 'healthy' },
    { name: 'Model', activeCases: 11, status: 'healthy' },
    { name: 'CAD', activeCases: 19, status: 'attention' },
    { name: 'Mill / Print', activeCases: 13, status: 'healthy' },
    { name: 'Ceramics', activeCases: 17, status: 'attention' },
    { name: 'QC', activeCases: 7, status: 'healthy' },
    { name: 'Shipping', activeCases: 5, status: 'healthy' }
  ]
};

export function App() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(fallback);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((response) => {
        if (!response.ok) throw new Error('API unavailable');
        return response.json();
      })
      .then(setSnapshot)
      .catch(() => setSnapshot(fallback));
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">NS</span>
          <div>
            <strong>CADence</strong>
            <span>NorthStar</span>
          </div>
        </div>
        <nav>
          {['Laboratory', 'Cases', 'Doctors', 'Production', 'QC', 'Shipping', 'Billing', 'Reports'].map((item, index) => (
            <button className={index === 0 ? 'active' : ''} key={item}>{item}</button>
          ))}
        </nav>
        <div className="sidebar-footer">v0.1.0 Foundation</div>
      </aside>

      <main>
        <header>
          <div>
            <p className="eyebrow">KERAMOS DIGITAL TWIN</p>
            <h1>Laboratory Status</h1>
            <p className="subtitle">Live operational view of today's laboratory.</p>
          </div>
          <div className="user-card">
            <span className="user-avatar">DH</span>
            <div><strong>Dorian Habet</strong><span>Administrator</span></div>
          </div>
        </header>

        <section className="metrics">
          <Metric label="Received today" value={snapshot.casesReceivedToday} />
          <Metric label="Due today" value={snapshot.casesDueToday} />
          <Metric label="At risk" value={snapshot.casesAtRisk} emphasis />
          <Metric label="In QC" value={snapshot.casesInQc} />
          <Metric label="Ready to ship" value={snapshot.shipmentsReady} />
          <Metric label="Month revenue" value={snapshot.monthRevenue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} />
        </section>

        <section className="content-grid">
          <article className="panel">
            <div className="panel-heading"><div><p className="eyebrow">PRODUCTION FLOOR</p><h2>Department activity</h2></div><span className="live">Live</span></div>
            <div className="departments">
              {snapshot.departments.map((department) => (
                <div className="department-row" key={department.name}>
                  <div><span className={`status-dot ${department.status}`} /><strong>{department.name}</strong></div>
                  <span>{department.activeCases} active cases</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel priority-panel">
            <p className="eyebrow">PRIORITY CONTROL</p>
            <h2>Cases requiring attention</h2>
            <Priority caseNumber="NS-260724-014" doctor="Dr. Beibei Wu" reason="Implant records incomplete" />
            <Priority caseNumber="NS-260724-009" doctor="Dr. Evans" reason="QC contact adjustment" />
            <Priority caseNumber="NS-260723-031" doctor="Dr. Isakov" reason="Shipping deadline today" />
          </article>
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value, emphasis = false }: { label: string; value: string | number; emphasis?: boolean }) {
  return <article className={`metric ${emphasis ? 'emphasis' : ''}`}><span>{label}</span><strong>{value}</strong></article>;
}

function Priority({ caseNumber, doctor, reason }: { caseNumber: string; doctor: string; reason: string }) {
  return <div className="priority"><div><strong>{caseNumber}</strong><span>{doctor}</span></div><p>{reason}</p><button>Open case</button></div>;
}
