import cors from 'cors';
import express from 'express';
import type { DashboardSnapshot } from '@northstar/shared';

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

app.get('/health', (_request, response) => {
  response.json({ service: 'cadence-northstar-api', status: 'ok', version: '0.1.0' });
});

app.get('/api/dashboard', (_request, response) => {
  const snapshot: DashboardSnapshot = {
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
  response.json(snapshot);
});

app.listen(port, () => {
  console.log(`CADence NorthStar API listening on http://localhost:${port}`);
});
