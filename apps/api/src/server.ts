import cors from 'cors';
import express from 'express';
import type { DashboardSnapshot } from '@northstar/shared';

const app = express();
const port = Number(process.env.PORT ?? 4000);
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_request, response) => response.json({ service: 'cadence-northstar-api', status: 'ok', version: '0.3.0' }));
app.get('/api/dashboard', (_request, response) => {
  const snapshot: DashboardSnapshot = { generatedAt: new Date().toISOString(), casesReceivedToday: 1, casesDueToday: 0, casesAtRisk: 0, casesInQc: 0, shipmentsReady: 0, monthRevenue: 0, activeDoctors: 1, activePractices: 1 };
  response.json(snapshot);
});
app.post('/api/auth/login', (request, response) => {
  const { email, password } = request.body as { email?: string; password?: string };
  if (email === 'dorianhabet@yahoo.com' && password === 'NorthStar!2026') return response.json({ user: { id: 'usr-admin', name: 'Dorian Habet', email, role: 'administrator', active: true } });
  return response.status(401).json({ error: 'Invalid credentials' });
});
app.listen(port, () => console.log(`CADence NorthStar API listening on http://localhost:${port}`));
